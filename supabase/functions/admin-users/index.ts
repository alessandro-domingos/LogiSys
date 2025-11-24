// Deno Edge Function: admin-users (V2 diagnostics)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

// ---- Helpers ----
function uuidV4(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  // RFC4122 layout
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = Array.from(buf).map(b => b.toString(16).padStart(2,'0'));
  return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
}

const WEAK_PASSWORDS = new Set(['123456','12345678','password','senha123','admin123','qwerty']);

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(128),
  nome: z.string().trim().min(2).max(100),
  role: z.enum(['admin','logistica'])
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders }
  });
}

Deno.serve(async (req) => {
  const request_id = uuidV4();
  const timestamp = new Date().toISOString();
  const logPrefix = '[admin-users]';

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed', stage: 'validation', request_id, timestamp }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const envStatus = { hasUrl: !!supabaseUrl, hasAnon: !!supabaseAnonKey, hasServiceRole: !!serviceRoleKey };
  if (!envStatus.hasUrl || !envStatus.hasAnon || !envStatus.hasServiceRole) {
    console.error(logPrefix, 'Missing env vars', envStatus);
    return jsonResponse({ error: 'Server not configured', details: envStatus, stage: 'env', request_id, timestamp }, 500);
  }

  let parsedData: z.infer<typeof BodySchema> | null = null;
  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid payload', details: parsed.error.flatten(), stage: 'validation', request_id, timestamp }, 400);
    }
    parsedData = parsed.data;
  } catch (e) {
    console.error(logPrefix, 'JSON parse error', e);
    return jsonResponse({ error: 'Invalid JSON body', details: String(e), stage: 'validation', request_id, timestamp }, 400);
  }

  const email = parsedData.email.toLowerCase();
  const password = parsedData.password;
  const nome = parsedData.nome;
  const role = parsedData.role;

  if (WEAK_PASSWORDS.has(password)) {
    return jsonResponse({
      error: 'Weak password',
      details: 'Choose a stronger password',
      stage: 'validation',
      request_id,
      timestamp,
      email,
      role,
      suggestions: ['Use letters, numbers and special characters']
    }, 400);
  }

  console.log(logPrefix, 'Start request', { email, role, request_id });

  const serviceClient = createClient(supabaseUrl!, serviceRoleKey!);

  const { count: adminCount, error: countError } = await serviceClient
    .from('user_roles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'admin');

  if (countError) {
    console.error(logPrefix, 'Admin count error', countError);
    return jsonResponse({ error: 'Failed to check admin count', details: countError.message, stage: 'adminCheck', request_id, timestamp, email, role }, 500);
  }

  const noAdminsExist = (adminCount ?? 0) === 0;
  console.log(logPrefix, 'Admin count', { adminCount, noAdminsExist });

  if (!noAdminsExist) {
    const userClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
    });
    const { data: userInfo } = await userClient.auth.getUser();
    const requester = userInfo?.user;
    if (!requester) {
      return jsonResponse({ error: 'Unauthorized', details: 'Missing or invalid auth token', stage: 'adminCheck', request_id, timestamp, email, role }, 401);
    }
    console.log(logPrefix, 'Requester', { id: requester.id });
    const { data: isAdmin, error: roleCheckError } = await userClient.rpc('has_role', { _user_id: requester.id, _role: 'admin' });
    if (roleCheckError) {
      console.error(logPrefix, 'Role check error', roleCheckError);
      return jsonResponse({ error: 'Role check failed', details: roleCheckError.message, stage: 'adminCheck', request_id, timestamp, email, role }, 500);
    }
    if (!isAdmin) {
      return jsonResponse({ error: 'Forbidden: Only admins can create users', details: 'Requester lacks admin role', stage: 'adminCheck', request_id, timestamp, email, role }, 403);
    }
  }

  const { data: created, error: createErr } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome }
  });

  if (createErr || !created?.user) {
    const msg = createErr?.message || 'Unknown creation error';
    const duplicate = /already exists|duplicate/i.test(msg);
    const status = duplicate ? 409 : 500;
    console.error(logPrefix, 'Create user error', createErr);
    return jsonResponse({
      error: 'Failed to create user',
      details: msg,
      stage: 'createUser',
      request_id,
      timestamp,
      email,
      role,
      supabase_error_code: (createErr as any)?.status
    }, status);
  }

  const newUserId = created.user.id;
  console.log(logPrefix, 'User created', { newUserId });

  // Post-create verification
  const verify = await serviceClient.auth.admin.getUserById(newUserId);
  if (!verify?.user) {
    console.error(logPrefix, 'Post-create verification failed, rolling back.');
    await serviceClient.auth.admin.deleteUser(newUserId);
    return jsonResponse({
      error: 'Post creation verification failed',
      details: 'User not retrievable after creation',
      stage: 'postCreateVerify',
      request_id,
      timestamp,
      email,
      role
    }, 500);
  }

  // Assign role with rollback
  const { error: roleError } = await serviceClient
    .from('user_roles')
    .upsert({ user_id: newUserId, role }, { onConflict: 'user_id,role' });

  if (roleError) {
    console.error(logPrefix, 'Role assignment error', roleError);
    await serviceClient.auth.admin.deleteUser(newUserId);
    return jsonResponse({
      error: 'Failed to assign role',
      details: roleError.message,
      stage: 'assignRole',
      request_id,
      timestamp,
      email,
      role
    }, 500);
  }

  // Non-critical profile upsert
  const { error: profileErr } = await serviceClient
    .from('profiles')
    .upsert({ id: newUserId, nome, email }, { onConflict: 'id' });
  if (profileErr) {
    console.error(logPrefix, 'Profile upsert error (non-fatal)', profileErr);
  }

  return jsonResponse({
    success: true,
    user_id: newUserId,
    email,
    role,
    timestamp,
    request_id,
    first_admin_bootstrap: noAdminsExist
  }, 200);
});
