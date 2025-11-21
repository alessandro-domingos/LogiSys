# Migration Guide: Profiles Table Removal

This guide explains the major architectural change in LogiSys where the `profiles` table has been removed and replaced with direct entity-based user management.

## Overview

The system has migrated from a centralized `profiles` table to a distributed entity-based user model where users are linked directly to their respective entity tables (`clientes`, `armazens`, `colaboradores`) via `user_id` foreign keys to `auth.users`.

## What Changed

### Database Schema

#### Removed:
- ❌ `public.profiles` table
- ❌ `handle_new_user()` trigger function
- ❌ `on_auth_user_created` trigger
- ❌ All RLS policies on profiles table
- ❌ Foreign key constraints from other tables to `profiles(id)`

#### Added:
- ✅ `public.colaboradores` table with `user_id` FK to `auth.users(id)`
- ✅ `user_id` column in `armazens` table (FK to `auth.users(id)`)
- ✅ Updated `clientes` table already has `user_id` column
- ✅ Updated FK constraints: all now point to `auth.users(id)` directly
- ✅ New `get_users_with_roles()` function that aggregates from entity tables
- ✅ New edge functions: `create-armazem-user`, `create-colaborador-user`

### Entity Tables Structure

Each entity table now contains:

**clientes:**
```sql
- id (PK)
- nome, cnpj_cpf, email, telefone
- endereco, cidade, estado, cep
- ativo (boolean)
- user_id (FK to auth.users, nullable)
- created_at, updated_at
```

**armazens:**
```sql
- id (PK)
- nome, cidade, estado
- ativo (boolean)
- user_id (FK to auth.users, nullable)
- created_at
```

**colaboradores:**
```sql
- id (PK)
- nome, cpf, email, telefone
- cargo, departamento
- ativo (boolean)
- user_id (FK to auth.users, nullable)
- created_at, updated_at
```

### User Creation Flow Changes

#### Before (Using Profiles):
1. Create auth.users
2. Auto-create profiles via trigger
3. Auto-assign default 'cliente' role via trigger
4. Assign role to user_roles (references profiles.id)
5. Optionally create entity record

#### After (Entity-Based with Explicit Role Assignment):
1. Create auth.users
2. **Explicitly assign appropriate role** in user_roles (references auth.users.id)
3. **Rollback user creation if role assignment fails**
4. Create entity record with user_id link
5. No profiles table involved
6. No automatic default role assignment via trigger

**Important:** As of migration 20251121173817, the `assign_default_role()` function and its associated triggers have been removed. All edge functions now explicitly assign roles during user creation and implement rollback mechanisms to prevent orphaned users without proper permissions.

## Migration Steps for Existing Deployments

### Prerequisites
- Backup your database before starting
- Ensure you have Supabase CLI installed
- Have service role key available

### Step 1: Apply Migrations

Run migrations in order:

```bash
# 1. Create colaboradores table
supabase db push supabase/migrations/20251120_create_colaboradores_table.sql

# 2. Add user_id to armazens
supabase db push supabase/migrations/20251120_add_user_id_to_armazens.sql

# 3. Update FK constraints
supabase db push supabase/migrations/20251120_update_fks_to_auth_users.sql

# 4. Update get_users_with_roles function
supabase db push supabase/migrations/20251120_update_get_users_function.sql

# 5. Remove profiles dependencies
supabase db push supabase/migrations/20251120_remove_profiles_dependencies.sql

# 6. Drop profiles table (FINAL STEP - NO ROLLBACK)
supabase db push supabase/migrations/20251120_drop_profiles_table.sql

# 7. Remove default role trigger (Migration 20251121173817)
supabase db push supabase/migrations/20251121173817_remove_default_role_trigger.sql
```

### Step 2: Data Migration (If Needed)

If you have existing users in the `profiles` table that need to be migrated to entity tables, run this SQL:

```sql
-- Identify users without entity links
SELECT 
  p.id,
  p.nome,
  p.email,
  ur.role,
  'No entity record' as status
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN clientes c ON c.user_id = p.id
LEFT JOIN armazens a ON a.user_id = p.id
LEFT JOIN colaboradores col ON col.user_id = p.id
WHERE c.id IS NULL 
  AND a.id IS NULL 
  AND col.id IS NULL;

-- For each orphaned profile, create appropriate entity record
-- Example for a cliente:
INSERT INTO clientes (nome, cnpj_cpf, email, user_id, ativo)
VALUES ('Nome', 'CNPJ', 'email@example.com', 'user-id-uuid', true);

-- Example for a colaborador:
INSERT INTO colaboradores (nome, cpf, email, user_id, ativo)
VALUES ('Nome', 'CPF', 'email@example.com', 'user-id-uuid', true);

-- Example for an armazem (link existing warehouse to user):
UPDATE armazens 
SET user_id = 'user-id-uuid'
WHERE id = 'armazem-id-uuid';
```

### Step 3: Deploy Edge Functions

```bash
supabase functions deploy create-armazem-user
supabase functions deploy create-colaborador-user
supabase functions deploy create-customer-user
```

### Step 4: Update Frontend

Deploy the new frontend code which includes:
- Updated TypeScript types
- New Colaboradores page
- Updated routing
- Updated permissions

## Testing Checklist

After migration, verify:

- [ ] Existing users can still login
- [ ] User roles are correctly associated
- [ ] Menu items show based on permissions
- [ ] Creating new cliente works
- [ ] Creating new colaborador works
- [ ] Creating/linking armazem user works
- [ ] Admin page shows all users correctly
- [ ] RLS policies work (users see only their data)
- [ ] All CRUD operations work correctly

## Rollback Plan

If issues occur, rollback is possible BEFORE step 6 (dropping profiles):

```sql
-- Restore FK constraints to profiles (if needed)
ALTER TABLE user_roles
  DROP CONSTRAINT user_roles_user_id_fkey,
  ADD CONSTRAINT user_roles_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.profiles(id) 
    ON DELETE CASCADE;

-- Restore other FK constraints similarly
-- Re-create handle_new_user trigger
-- Re-enable profiles RLS policies
```

**Important:** After step 6 (dropping profiles table), full rollback requires restoring from backup.

## Breaking Changes

### For Developers:

1. **No more profiles table queries**
   - Old: `SELECT * FROM profiles WHERE id = auth.uid()`
   - New: Query the appropriate entity table with `user_id = auth.uid()`

2. **User creation requires entity specification**
   - Must use appropriate edge function for user type
   - Cannot create generic users without entity

3. **Foreign keys changed**
   - All `created_by`, `updated_by` fields now reference `auth.users(id)`
   - Update any queries joining to profiles

4. **TypeScript types updated**
   - `profiles` table types removed
   - New `clientes`, `colaboradores`, `armazens` types added with `user_id`

### For End Users:

No breaking changes in functionality. The user experience remains the same.

## Benefits of This Change

1. **Simplified Architecture**: Direct relationship between users and business entities
2. **Better Data Integrity**: Single source of truth for user data
3. **Improved Security**: RLS policies directly on entity tables
4. **Clearer User Types**: Each user type has its own table with relevant fields
5. **Easier Maintenance**: No intermediate table to manage
6. **Better Performance**: One less join for most queries

## Support

If you encounter issues during migration:
1. Check logs in Supabase dashboard
2. Verify all migrations applied successfully
3. Check RLS policies are active
4. Verify edge functions deployed correctly
5. Contact development team if issues persist

## Additional Notes

- All temporary passwords generated for new users require change on first login
- User credentials should be securely transmitted to users
- Backup database regularly
- Monitor RLS policy performance after migration
- Update any custom scripts or integrations that query the profiles table
