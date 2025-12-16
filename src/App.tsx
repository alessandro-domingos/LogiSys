import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { usePermissions } from "./hooks/usePermissions";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Estoque from "./pages/Estoque";
import Liberacoes from "./pages/Liberacoes";
import Agendamentos from "./pages/Agendamentos";
import Carregamentos from "./pages/Carregamentos";
import CarregamentoDetalhe from "./pages/CarregamentoDetalhe";
import Produtos from "./pages/Produtos";
import Armazens from "./pages/Armazens";
import Clientes from "./pages/Clientes";
import Colaboradores from "./pages/Colaboradores";
import AuthPage from "./pages/AuthPage";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";
import type { Resource } from "./hooks/usePermissions";

const queryClient = new QueryClient();

const ProtectedRoute = ({
  children,
  resource
}: {
  children: React.ReactNode;
  resource?: Resource;
}) => {
  const { user, loading: authLoading, needsPasswordChange, recoveryMode } = useAuth();
  const { canAccess, loading: permLoading } = usePermissions();
  const location = useLocation();

  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect to change password if needed or in recovery mode, but allow access to the change-password page itself
  if ((needsPasswordChange || recoveryMode) && location.pathname !== '/change-password') {
    console.log('🔍 [DEBUG] Redirecting to change password (needsPasswordChange:', needsPasswordChange, 'recoveryMode:', recoveryMode, ')');
    return <Navigate to="/change-password" replace />;
  }

  if (resource && !canAccess(resource, 'read')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/estoque"
              element={
                <ProtectedRoute resource="estoque">
                  <Layout>
                    <Estoque />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/liberacoes"
              element={
                <ProtectedRoute resource="liberacoes">
                  <Layout>
                    <Liberacoes />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agendamentos"
              element={
                <ProtectedRoute resource="agendamentos">
                  <Layout>
                    <Agendamentos />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/carregamentos"
              element={
                <ProtectedRoute resource="carregamentos">
                  <Layout>
                    <Carregamentos />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/carregamentos/:id"
              element={
                <ProtectedRoute resource="carregamentos">
                  <Layout>
                    <CarregamentoDetalhe />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/produtos"
              element={
                <ProtectedRoute resource="produtos">
                  <Layout>
                    <Produtos />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/armazens"
              element={
                <ProtectedRoute resource="armazens">
                  <Layout>
                    <Armazens />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/clientes"
              element={
                <ProtectedRoute resource="clientes">
                  <Layout>
                    <Clientes />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/colaboradores"
              element={
                <ProtectedRoute resource="colaboradores">
                  <Layout>
                    <Colaboradores />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/produtos"
              element={
                <ProtectedRoute resource="produtos">
                  <Layout>
                    <Produtos />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
