# LogiSys - Sistema de Gestão Logística

Sistema de gestão logística para controle de estoque, liberações, agendamentos e carregamentos.

## Project info

**URL**: https://lovable.dev/projects/33312794-693a-46b8-9f88-66de37f3597f

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/33312794-693a-46b8-9f88-66de37f3597f) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/33312794-693a-46b8-9f88-66de37f3597f) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

---

## Architecture & User Management

### User Model

LogiSys uses a role-based access control (RBAC) system where users are linked directly to entity tables:

#### Entity Tables
- **clientes**: Customer users with `user_id` FK to `auth.users`
- **armazens**: Warehouse users with `user_id` FK to `auth.users`
- **colaboradores**: Employee/Staff users with `user_id` FK to `auth.users`

Each entity table contains:
- Business-specific data (e.g., CNPJ, address for clientes)
- A nullable `user_id` field linking to `auth.users(id)`
- Active/inactive status flag

#### User Roles

Available roles (defined in `user_role` enum):
- **admin**: Full system access
- **logistica**: Logistics team - manages products, stock, liberations, warehouses
- **comercial**: Sales team - can view data and create/manage releases
- **armazem**: Warehouse operators - manage loading operations
- **cliente**: Customers - can create scheduling requests and view their data

Roles are stored in the `user_roles` table with a many-to-one relationship to `auth.users`.

### User Creation Flow

#### Creating a Cliente (Customer):
1. Admin/Logística accesses the Clientes page
2. Fills out customer information (nome, CNPJ/CPF, email, etc.)
3. System calls the `create-customer-user` edge function
4. Edge function:
   - Creates user in `auth.users` with temporary password
   - Assigns the "cliente" role in `user_roles`
   - Creates record in `clientes` table with `user_id` link
   - Returns temporary credentials
5. Temporary password must be changed on first login

#### Creating a Colaborador (Employee):
1. Admin/Logística accesses the Colaboradores page
2. Fills out employee information (nome, CPF, email, cargo, departamento)
3. Selects role (logistica, comercial, or admin)
4. System calls the `create-colaborador-user` edge function
5. Edge function:
   - Creates user in `auth.users` with temporary password
   - Assigns the selected role in `user_roles`
   - Creates record in `colaboradores` table with `user_id` link
   - Returns temporary credentials
6. Temporary password must be changed on first login

#### Creating an Armazém User (Warehouse):
1. Admin/Logística accesses the Armazéns page
2. Can either:
   - Create a new warehouse with user, or
   - Link user to existing warehouse
3. System calls the `create-armazem-user` edge function
4. Edge function:
   - Creates user in `auth.users` with temporary password
   - Assigns the "armazem" role in `user_roles`
   - Creates/updates record in `armazens` table with `user_id` link
   - Returns temporary credentials
5. Temporary password must be changed on first login

### Permissions System

Permissions are managed through the `role_permissions` table, which defines CRUD permissions for each role on different resources:

```sql
role_permissions (
  role: user_role,
  resource: text,
  can_create: boolean,
  can_read: boolean,
  can_update: boolean,
  can_delete: boolean
)
```

The frontend `usePermissions` hook queries this table to dynamically show/hide menu items and control access to features.

### Database Schema Changes (Migration from profiles table)

**Previous Architecture (Deprecated):**
- Used a `profiles` table as an intermediary between `auth.users` and business entities
- All FKs pointed to `profiles(id)`

**Current Architecture:**
- Direct link from entity tables to `auth.users(id)` via `user_id`
- No profiles table - business entities are the single source of truth
- `user_roles` table links roles directly to `auth.users(id)`

**Migration Notes:**
If upgrading from an old version with the `profiles` table:
1. Run migrations in order (found in `supabase/migrations/`)
2. Data should be migrated from `profiles` to appropriate entity tables
3. All FK constraints are updated to point to `auth.users(id)` instead of `profiles(id)`
4. The `profiles` table is dropped in the final migration

### Row Level Security (RLS)

All tables have RLS policies enabled that check:
- User authentication (`auth.uid()`)
- User roles via the `has_role()` function
- User ownership (e.g., customers can only see their own data)

Example policy:
```sql
CREATE POLICY "Clientes podem ver próprio perfil"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

### Edge Functions

Located in `supabase/functions/`:
- `create-customer-user`: Creates cliente users
- `create-colaborador-user`: Creates colaborador users  
- `create-armazem-user`: Creates armazem users
- `admin-users`: Generic admin user creation (deprecated, use specific functions above)

All edge functions:
- Use service role for admin operations
- Validate requester permissions
- Generate secure temporary passwords
- Force password change on first login
- Return credentials for the admin to share with the user

---

## Development

### Running locally
```bash
npm install
npm run dev
```

### Building for production
```bash
npm run build
```

### Linting
```bash
npm run lint
```
