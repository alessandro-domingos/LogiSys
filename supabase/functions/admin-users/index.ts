// Deno Edge Function: admin-users
// Creates a new user and assigns role atomically using service role
// Allows bootstrapping the first admin without authentication

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
  nome: z.string().trim().min(2).max(100),
  role: z.enum(["admin", "logistica", "armazem", "cliente", "comercial"]).default("cliente"),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
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

    const { email, password, nome, role } = parsed.data;

    // Service role client (bypasses RLS) - used for counting admins and writing system tables
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Determine if there are any admins using service role to avoid RLS issues
    const { count: adminCount, error: countError } = await serviceClient
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if (countError) {
      return new Response(
        JSON.stringify({ error: "Failed to check admin count", details: countError.message }),
        { status: 500, headers: { "content-type": "application/json", ...corsHeaders } },
      );
    }

    const noAdminsExist = (adminCount ?? 0) === 0;

    // If admins already exist, requester must be admin
    if (!noAdminsExist) {
      // Authenticated client using the caller's JWT
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

      const { data: isAdmin, error: roleCheckError } = await userClient.rpc("has_role", {
        _user_id: requester.id,
        _role: "admin",
      });

      if (roleCheckError) {
        return new Response(JSON.stringify({ error: "Role check failed", details: roleCheckError.message }), {
          status: 500,
          headers: { "content-type": "application/json", ...corsHeaders },
        });
      }

      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: Only admins can create users" }), {
          status: 403,
          headers: { "content-type": "application/json", ...corsHeaders },
        });
      }
    }

    // Create user (auto-confirm)
    const { data: created, error: createErr } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ error: "Failed to create user", details: createErr?.message }), {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    const newUserId = created.user.id;

    // Ensure profile exists BEFORE assigning role to satisfy FK constraints
    const { error: profileErr } = await serviceClient
      .from("profiles")
      .upsert({ id: newUserId, nome, email }, { onConflict: "id" });

    if (profileErr) {
      return new Response(JSON.stringify({ error: "Failed to create profile", details: profileErr.message }), {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    // Assign role (default "cliente" unless specified). Use upsert to avoid duplicates
    const { error: roleErr } = await serviceClient
      .from("user_roles")
      .upsert({ user_id: newUserId, role }, { onConflict: "user_id,role" });

    if (roleErr) {
      return new Response(JSON.stringify({ error: "Failed to assign role", details: roleErr.message }), {
        status: 500,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: newUserId }), {
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(JSON.stringify({ error: "Unexpected error occurred while creating user" }), {
      status: 500,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }
});