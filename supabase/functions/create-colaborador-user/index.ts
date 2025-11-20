// Edge Function to create colaborador (employee/staff) users with service role
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const BodySchema = z.object({
  nome: z.string().trim().min(2).max(100),
  cpf: z.string().trim().min(11).max(14),
  email: z.string().trim().email().max(255),
  telefone: z.string().trim().optional().nullable(),
  cargo: z.string().trim().optional().nullable(),
  departamento: z.string().trim().optional().nullable(),
  role: z.enum(["logistica", "comercial", "admin"]).default("comercial"),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid payload", details: parsed.error.flatten() }),
        { status: 400, headers: { "content-type": "application/json", ...corsHeaders } },
      );
    }

    const { nome, cpf, email, telefone, cargo, departamento, role } = parsed.data;

    // Check if requester is admin or logistica
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data: userInfo } = await userClient.auth.getUser();
    const requester = userInfo?.user;
    if (!requester) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    // Check if user has admin or logistica role
    const { data: hasPermission } = await userClient.rpc("has_role", {
      _user_id: requester.id,
      _role: "admin",
    });

    const { data: hasLogisticaRole } = await userClient.rpc("has_role", {
      _user_id: requester.id,
      _role: "logistica",
    });

    if (!hasPermission && !hasLogisticaRole) {
      return new Response(JSON.stringify({ error: "Forbidden: Only admin or logistica can create colaborador users" }), {
        status: 403,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    // Generate random password
    const gerarSenha = (): string => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let senha = "Staff";
      for (let i = 0; i < 5; i++) {
        senha += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return senha;
    };

    const senhaTemporaria = gerarSenha();

    // Service role client
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Create Auth user
    const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password: senhaTemporaria,
      email_confirm: true,
      user_metadata: {
        nome,
        cpf,
        force_password_change: true,
      },
    });

    if (authError || !authUser?.user) {
      return new Response(
        JSON.stringify({ error: "Failed to create user", details: authError?.message }),
        { status: 500, headers: { "content-type": "application/json", ...corsHeaders } },
      );
    }

    const userId = authUser.user.id;

    // 2. Assign role (logistica, comercial, or admin)
    const { error: roleError } = await serviceClient
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });

    if (roleError) {
      console.error("Role assignment error:", roleError);
    }

    // 3. Create colaborador record
    const { data: colaborador, error: colaboradorError } = await serviceClient
      .from("colaboradores")
      .insert({
        nome,
        cpf,
        email,
        telefone: telefone || null,
        cargo: cargo || null,
        departamento: departamento || null,
        user_id: userId,
        ativo: true,
      })
      .select()
      .single();

    if (colaboradorError) {
      return new Response(
        JSON.stringify({ error: "Failed to create colaborador", details: colaboradorError.message }),
        { status: 500, headers: { "content-type": "application/json", ...corsHeaders } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        colaborador,
        senha: senhaTemporaria,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json", ...corsHeaders },
      },
    );
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: "Unexpected error occurred while creating colaborador user" }),
      {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders },
      },
    );
  }
});
