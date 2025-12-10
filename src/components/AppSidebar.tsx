import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Calendar,
  Truck,
  Warehouse,
  Users,
  LogOut,
  Settings,
  BadgeCheck,
  Tag,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const upperMenuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    resource: null,
  },
  {
    title: "Estoque",
    url: "/estoque",
    icon: Package,
    resource: "estoque" as const,
  },
  {
    title: "Liberações",
    url: "/liberacoes",
    icon: ClipboardList,
    resource: "liberacoes" as const,
  },
  {
    title: "Agendamentos",
    url: "/agendamentos",
    icon: Calendar,
    resource: "agendamentos" as const,
  },
  {
    title: "Carregamentos",
    url: "/carregamentos",
    icon: Truck,
    resource: "carregamentos" as const,
  },
];

const lowerMenuItems = [
  {
    title: "Produtos",
    url: "/produtos",
    icon: Tag,
    resource: "produtos" as const,
  },
  {
    title: "Clientes",
    url: "/clientes",
    icon: Users,
    resource: "clientes" as const,
  },
  {
    title: "Armazéns",
    url: "/armazens",
    icon: Warehouse,
    resource: "armazens" as const,
  },
  {
    title: "Colaboradores",
    url: "/colaboradores",
    icon: BadgeCheck,
    resource: "colaboradores" as const,
    requiresRole: ["admin"] as const,
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { signOut, userRole } = useAuth();
  const { canAccess, loading: permissionsLoading } = usePermissions();
  const isCollapsed = state === "collapsed";

  const handleLogout = async () => {
    await signOut();
  };

  const filterMenuItems = (items: typeof upperMenuItems | typeof lowerMenuItems) => {
    return items.filter(item => {
      // Check role-based requirements (Colaboradores only for admin)
      if ('requiresRole' in item && item.requiresRole) {
        const hasRequiredRole = userRole ? item.requiresRole.includes(userRole) : false;
        if (!hasRequiredRole) {
          return false;
        }
      }
      if (!item.resource) {
        return true;
      }
      // 🚩 CORRIGIDO: admin e logistica SEMPRE podem ver o menu Clientes
      if (
        item.resource === "clientes" &&
        (userRole === "admin" || userRole === "logistica")
      ) {
        return true;
      }
      const hasAccess = canAccess(item.resource, 'read');
      return hasAccess;
    });
  };

  // Wait for permissions to load before filtering menu
  const visibleUpperMenuItems = permissionsLoading
    ? [upperMenuItems[0]]
    : filterMenuItems(upperMenuItems);

  const visibleLowerMenuItems = permissionsLoading
    ? []
    : filterMenuItems(lowerMenuItems);

  return (
    <Sidebar collapsible="icon">
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Package className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-sidebar-foreground">LogisticPro</span>
          </div>
        )}
        <SidebarTrigger />
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleUpperMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Cadastros</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleLowerMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  {!isCollapsed && <span>Sair</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
