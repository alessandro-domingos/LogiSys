// Deno Edge Function: admin-users V2
// Creates a new user and assigns role atomically using service role
// Allows bootstrapping the first admin without authentication
// Enhanced with stage-based error diagnostics, weak password checking, and verification
//
// Security Note: email/role are echoed in error responses to help clients correlate
// failed requests. This does NOT enable user enumeration because:
// - We echo back what the client sent (not revealing if users exist)
// - 409 Duplicate errors intentionally reveal existence (required for proper handling)
// - All errors occur in context of CREATE operations, not user lookup

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
  nome: z.string().trim().min(2).max(100),
  role: z.enum(["admin", "logistica"]),
});

// Weak password blacklist (as Set for O(1) lookup)
const WEAK_PASSWORDS = new Set([
  '123456',
  '12345678',
  'password',
  'senha123',
  'admin123',
  'qwerty'
]);

// Type definitions for better type safety
interface SupabaseError {
  message: string;
  code?: string;
  status?: number;
  details?: string;
  hint?: string;
}

interface ErrorResponse {
  error: string;
  details: string;
  stage: string;
  email?: string;
  role?: string;
  timestamp: string;
  request_id: string;
  supabase_error_code?: string | number;
  envStatus?: {
    hasUrl: boolean;
    hasAnon: boolean;
    hasServiceRole: boolean;
  };
  suggestions?: string[];
}

// Custom error class for role assignment failures
class RoleAssignmentError extends Error {
  code: string;
  details: string;
  
  constructor(message: string, code: string, details: string) {
    super(message);
    this.name = 'RoleAssignmentError';
    this.code = code;
    this.details = details;
  }
}

// Type guard for SupabaseError
function isSupabaseError(error: unknown): error is SupabaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

// Simple UUID v4 generator for request_id
function generateRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Generate request ID early so it's available in all error handlers
  const requestId = generateRequestId();
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }

  console.log(`[admin-users] Starting request ${requestId}`);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Environment verification
  const envStatus = {
    hasUrl: !!supabaseUrl,
    hasAnon: !!supabaseAnonKey,
    hasServiceRole: !!serviceRoleKey
  };

  if (!envStatus.hasUrl || !envStatus.hasAnon || !envStatus.hasServiceRole) {
    console.error(`[admin-users] Environment verification failed:`, envStatus);
    return new Response(JSON.stringify({ 
      error: "Server not configured",
      details: "Missing required environment variables",
      stage: "env",
      envStatus,
      timestamp: new Date().toISOString(),
      request_id: requestId
    }), {
      status: 500,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      console.log(`[admin-users] Validation failed for request ${requestId}`);
      return new Response(
        JSON.stringify({ 
          error: "Invalid payload", 
          details: parsed.error.flatten(),
          stage: "validation",
          timestamp: new Date().toISOString(),
          request_id: requestId
        }),
        { status: 400, headers: { "content-type": "application/json", ...corsHeaders } },
      );
    }

    const { email: rawEmail, password, nome, role } = parsed.data;
    
    // Normalize email to lowercase
    const email = rawEmail.toLowerCase();
    
    // Weak password check (case-insensitive, exact match only, O(1) lookup)
    if (WEAK_PASSWORDS.has(password.toLowerCase())) {
      console.log(`[admin-users] Weak password detected, request_id: ${requestId}`);
      return new Response(
        JSON.stringify({
          error: "Weak password",
          details: "The provided password is too common and easily guessable",
          stage: "validation",
          suggestions: ["Use letters, numbers and special characters"],
          email,
          role,
          timestamp: new Date().toISOString(),
          request_id: requestId
        }),
        { status: 400, headers: { "content-type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[admin-users] Creating user with role: ${role}, request_id: ${requestId}`);

    // Service role client (bypasses RLS) - used for counting admins and writing system tables
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    // Determine if there are any admins using service role to avoid RLS issues
    const { count: adminCount, error: countError } = await serviceClient
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");

    if (countError) {
      console.error(`[admin-users] Failed to check admin count:`, countError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to check admin count", 
          details: countError.message,
          stage: "adminCheck",
          email,
          role,
          timestamp: new Date().toISOString(),
          request_id: requestId
        }),
        { status: 500, headers: { "content-type": "application/json", ...corsHeaders } },
      );
    }

    const noAdminsExist = (adminCount ?? 0) === 0;
    console.log(`[admin-users] Admin count: ${adminCount ?? 0}, bootstrap mode: ${noAdminsExist}`);

    // If admins already exist, requester must be admin
    if (!noAdminsExist) {
      // Authenticated client using the caller's JWT
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
      });

      const { data: userInfo } = await userClient.auth.getUser();
      const requester = userInfo?.user;
      if (!requester) {
        console.log(`[admin-users] Unauthorized request - no valid auth token`);
        return new Response(JSON.stringify({ 
          error: "Unauthorized",
          details: "Authentication required to create users",
          stage: "adminCheck",
          email,
          role,
          timestamp: new Date().toISOString(),
          request_id: requestId
        }), {
          status: 401,
          headers: { "content-type": "application/json", ...corsHeaders },
        });
      }

      console.log(`[admin-users] Request authenticated, request_id: ${requestId}`);

      const { data: isAdmin, error: roleCheckError } = await userClient.rpc("has_role", {
        _user_id: requester.id,
        _role: "admin",
      });

      if (roleCheckError) {
        console.error(`[admin-users] Role check failed:`, roleCheckError);
        return new Response(JSON.stringify({ 
          error: "Role check failed", 
          details: roleCheckError.message,
          stage: "adminCheck",
          email,
          role,
          timestamp: new Date().toISOString(),
          request_id: requestId
        }), {
          status: 500,
          headers: { "content-type": "application/json", ...corsHeaders },
        });
      }

      if (!isAdmin) {
        console.log(`[admin-users] Forbidden - requester is not admin, request_id: ${requestId}`);
        return new Response(JSON.stringify({ 
          error: "Forbidden: Only admins can create users",
          details: "Your account does not have admin privileges",
          stage: "adminCheck",
          email,
          role,
          timestamp: new Date().toISOString(),
          request_id: requestId
        }), {
          status: 403,
          headers: { "content-type": "application/json", ...corsHeaders },
        });
      }
    }

    // Create user (auto-confirm)
    console.log(`[admin-users] Creating auth user, request_id: ${requestId}`);
    const { data: created, error: createErr } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (createErr || !created?.user) {
      console.error(`[admin-users] User creation failed, request_id: ${requestId}:`, createErr);
      
      // Check for duplicate user pattern using both error code and message
      let errorCode: string | undefined;
      let errorMsg = '';
      let errorDetails = "Database error creating new user";
      
      if (isSupabaseError(createErr)) {
        errorCode = createErr.code || createErr.status?.toString();
        errorMsg = createErr.message?.toLowerCase() || '';
        errorDetails = createErr.message;
      }
      
      const isDuplicate = errorCode === '23505' || // PostgreSQL unique violation
                          errorCode === 'PGRST116' || // PostgREST unique violation
                          errorMsg.includes('already exists') ||
                          errorMsg.includes('duplicate') ||
                          errorMsg.includes('unique');
      
      const statusCode = isDuplicate ? 409 : 500;
      const errorResponse: ErrorResponse = {
        error: isDuplicate ? "User already exists" : "Failed to create user",
        details: errorDetails,
        stage: "createUser",
        email,
        role,
        timestamp: new Date().toISOString(),
        request_id: requestId
      };
      
      // Add supabase error code if available
      if (errorCode) {
        errorResponse.supabase_error_code = errorCode;
      }
      
      return new Response(JSON.stringify(errorResponse), {
        status: statusCode,
        headers: { "content-type": "application/json", ...corsHeaders },
      });
    }

    const newUserId = created.user.id;
    console.log(`[admin-users] User created, request_id: ${requestId}`);

    // Post-creation verification
    console.log(`[admin-users] Verifying user creation, request_id: ${requestId}`);
    const { data: verifiedUser, error: verifyError } = await serviceClient.auth.admin.getUserById(newUserId);
    
    if (verifyError || !verifiedUser?.user) {
      console.error(`[admin-users] Post-creation verification failed, request_id: ${requestId}:`, verifyError);
      // Rollback: delete the auth user
      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(newUserId);
      if (deleteError) {
        console.error(`[admin-users] CRITICAL: Failed to rollback user after verification failure, request_id: ${requestId}:`, deleteError);
      }
      return new Response(
        JSON.stringify({
          error: "User creation verification failed",
          details: "Created user could not be verified, operation rolled back",
          stage: "postCreateVerify",
          email,
          role,
          timestamp: new Date().toISOString(),
          request_id: requestId
        }),
        { status: 500, headers: { "content-type": "application/json", ...corsHeaders } }
      );
    }
    
    console.log(`[admin-users] User verified successfully, request_id: ${requestId}`);

    // Helper function to rollback user creation if role assignment fails
    const assignRoleOrRollback = async (uid: string, desiredRole: string) => {
      const { error: roleError } = await serviceClient
        .from("user_roles")
        .upsert({ user_id: uid, role: desiredRole }, { onConflict: "user_id,role" });

      if (roleError) {
        console.error(`[admin-users] Role assignment failed, rolling back user, request_id: ${requestId}:`, roleError);
        // Rollback: delete the auth user
        const { error: deleteError } = await serviceClient.auth.admin.deleteUser(uid);
        if (deleteError) {
          console.error(`[admin-users] Failed to rollback user creation, request_id: ${requestId}:`, deleteError);
        }
        // Throw custom error with structured details
        if (isSupabaseError(roleError)) {
          throw new RoleAssignmentError(
            roleError.message,
            roleError.code || 'ROLE_ASSIGNMENT_FAILED',
            roleError.details || roleError.hint || 'Database error during role assignment'
          );
        } else {
          throw new RoleAssignmentError(
            'Unknown role assignment error',
            'ROLE_ASSIGNMENT_FAILED',
            'Database error during role assignment'
          );
        }
      }
    };

    // Assign role (admin or logistica only) with rollback on error
    console.log(`[admin-users] Assigning role: ${role}, request_id: ${requestId}`);
    try {
      await assignRoleOrRollback(newUserId, role);
    } catch (error) {
      console.error(`[admin-users] Role assignment error, request_id: ${requestId}:`, error);
      
      if (error instanceof RoleAssignmentError) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Falha ao atribuir role. Usuário não foi criado. Tente novamente ou contate suporte.",
            details: error.message,
            code: error.code,
            stage: "assignRole",
            email,
            role,
            timestamp: new Date().toISOString(),
            request_id: requestId
          }),
          { status: 500, headers: { "content-type": "application/json", ...corsHeaders } },
        );
      }
      
      // Fallback for unexpected errors
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Falha ao atribuir role. Usuário não foi criado. Tente novamente ou contate suporte.",
          details: error instanceof Error ? error.message : "Unknown error",
          code: "UNKNOWN",
          stage: "assignRole",
          email,
          role,
          timestamp: new Date().toISOString(),
          request_id: requestId
        }),
        { status: 500, headers: { "content-type": "application/json", ...corsHeaders } },
      );
    }

    console.log(`[admin-users] User creation completed successfully, request_id: ${requestId}`);
    return new Response(JSON.stringify({ 
      success: true, 
      user_id: newUserId,
      email,
      role,
      timestamp: new Date().toISOString(),
      first_admin_bootstrap: noAdminsExist,
      request_id: requestId
    }), {
      status: 200,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    console.error("[admin-users] Unexpected error:", e);
    return new Response(JSON.stringify({ 
      error: "Unexpected error occurred while creating user",
      details: e instanceof Error ? e.message : "Unknown error",
      stage: "unexpected",
      timestamp: new Date().toISOString(),
      request_id: requestId
    }), {
      status: 500,
      headers: { "content-type": "application/json", ...corsHeaders },
    });
  }
});