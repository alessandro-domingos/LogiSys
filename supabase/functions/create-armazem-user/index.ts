// Edge Function to create armazem (warehouse) users with service role
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// Blacklist de senhas fracas
const WEAK_PASSWORDS = new Set(['123456', '12345678', 'password', 'senha123', 'admin123', 'qwerty']);

// Validar senha gerada
const validatePassword = (password: string): boolean => {
  return password.length >= 6 && 
         password.length <= 128 && 
         !WEAK_PASSWORDS.has(password.toLowerCase());
};

const BodySchema = z.object({
  nome: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  cidade: z.string().trim().min(2),
  estado: z.string().length(2),
  armazem_id: z.string().uuid().optional(), // If linking to existing armazem
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

    const { nome, email, cidade, estado, armazem_id } = parsed.data;

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
      return new Response(JSON.stringify({ error: "Forbidden: Only admin or logistica can create armazem users" }), {
        status: 403,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    // Generate random password
    const gerarSenha = (): string => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let senha = "Armazem";
      for (let i = 0; i < 4; i++) {
        senha += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return senha;
    };

    let senhaTemporaria = gerarSenha();

    // Garantir que a senha não está na blacklist (com limite de tentativas)
    let attempts = 0;
    const MAX_ATTEMPTS = 10;
    while (!validatePassword(senhaTemporaria) && attempts < MAX_ATTEMPTS) {
      senhaTemporaria = gerarSenha();
      attempts++;
    }

    // Se após MAX_ATTEMPTS ainda não gerou uma senha válida, retornar erro
    if (!validatePassword(senhaTemporaria)) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Não foi possível gerar uma senha válida",
          stage: "validation"
        }),
        { status: 500, headers: { "content-type": "application/json", ...corsHeaders } },
      );
    }

    // Service role client
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Create Auth user
    const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password: senhaTemporaria,
      email_confirm: true,
      user_metadata: {
        nome,
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

    // Helper function to rollback user creation if role assignment fails
    const assignRoleOrRollback = async (uid: string, desiredRole: string) => {
      const { error: roleError } = await serviceClient
        .from("user_roles")
        .upsert({ user_id: uid, role: desiredRole }, { onConflict: "user_id,role" });

      if (roleError) {
        console.error("Role assignment failed, rolling back user:", roleError);
        // Rollback: delete the auth user
        const { error: deleteError } = await serviceClient.auth.admin.deleteUser(uid);
        if (deleteError) {
          console.error("Failed to rollback user creation:", deleteError);
        }
        throw new Error(`Failed to assign role: ${roleError.message}`);
      }
    };

    // 2. Assign role "armazem" with rollback on error
    try {
      await assignRoleOrRollback(userId, "armazem");
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Falha ao atribuir role. Usuário não foi criado. Tente novamente ou contate suporte.",
          details: error instanceof Error ? error.message : "Unknown error"
        }),
        { status: 500, headers: { "content-type": "application/json", ...corsHeaders } },
      );
    }

    // 3. Link to armazem or create new armazem
    let armazemData;
    if (armazem_id) {
      // Link to existing armazem
      const { data, error: updateError } = await serviceClient
        .from("armazens")
        .update({ user_id: userId })
        .eq("id", armazem_id)
        .select()
        .single();

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to link armazem", details: updateError.message }),
          { status: 500, headers: { "content-type": "application/json", ...corsHeaders } },
        );
      }
      armazemData = data;
    } else {
      // Create new armazem
      const { data, error: createError } = await serviceClient
        .from("armazens")
        .insert({
          nome,
          cidade,
          estado,
          user_id: userId,
          ativo: true,
        })
        .select()
        .single();

      if (createError) {
        return new Response(
          JSON.stringify({ error: "Failed to create armazem", details: createError.message }),
          { status: 500, headers: { "content-type": "application/json", ...corsHeaders } },
        );
      }
      armazemData = data;
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        armazem: armazemData,
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
      JSON.stringify({ error: "Unexpected error occurred while creating armazem user" }),
      {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders },
      },
    );
  }
});
