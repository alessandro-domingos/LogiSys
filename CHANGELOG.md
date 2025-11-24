# Changelog

All notable changes to the LogiSys project will be documented in this file.

## 2025-11-24: Dropped legacy roles table

- **Removed obsolete `public.roles` table** (columns: `name`, `description`)
  - This table was no longer referenced in frontend or backend code after the RBAC refactor
  - Backup retained in `roles_backup_20251124` for safety
- **Current RBAC architecture uses:**
  - `user_role` enum for defining available roles (`admin`, `logistica`, `armazem`, `cliente`)
  - `user_roles` table for assigning roles to users
  - `role_permissions` table for defining granular permissions per role
- **Migration file:** `supabase/migrations/20251124_drop_roles_table.sql`
- **Note:** Any prior static `roles` catalog table has been fully deprecated and removed

## 2025-11-24: Removed "comercial" Role

- The `comercial` role has been completely removed from the system as it was not being used (0 users)
- Updated `user_role` enum to only include: `admin`, `logistica`, `armazem`, `cliente`
- Migration: `supabase/migrations/20251124_remove_comercial_role.sql`
- All references removed from codebase, documentation, and UI

## Earlier Changes

For information about the profiles table removal and other architectural changes, see:
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Detailed migration steps
- [REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md) - Complete refactor overview
