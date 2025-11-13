import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const emailSchema = z.string().trim().email().max(255);
const passwordSchema = z.string().min(6);
const nomeSchema = z.string().trim().min(2).max(100);

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  userRole: string | null;
  hasRole: (role: string) => boolean;
  needsPasswordChange: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const { toast } = useToast();

  const fetchUserRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar role:', error);
      setUserRole(null);
      return;
    }

    setUserRole(data?.role ?? null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          fetchUserRole(session.user.id);
          // Check if user needs to change password
          const forceChange = session.user.user_metadata?.force_password_change === true;
          setNeedsPasswordChange(forceChange);
          console.log('🔍 [DEBUG] Force password change:', forceChange);
        } else {
          setUserRole(null);
          setNeedsPasswordChange(false);
        }
      }
    );

    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserRole(session.user.id);
        // Check if user needs to change password
        const forceChange = session.user.user_metadata?.force_password_change === true;
        setNeedsPasswordChange(forceChange);
        console.log('🔍 [DEBUG] Force password change:', forceChange);
      }
      
      setLoading(false);
    };

    initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const emailResult = emailSchema.safeParse(email);
    const passwordResult = passwordSchema.safeParse(password);
    
    if (!emailResult.success || !passwordResult.success) {
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: "Email ou senha inválidos"
      });
      return { error: new Error("Validation failed") };
    }
    
    const { error } = await supabase.auth.signInWithPassword({ 
      email: emailResult.data, 
      password: passwordResult.data 
    });
    
    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao fazer login",
        description: error.message
      });
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string, nome: string) => {
    const emailResult = emailSchema.safeParse(email);
    const passwordResult = passwordSchema.safeParse(password);
    const nomeResult = nomeSchema.safeParse(nome);
    
    if (!emailResult.success || !passwordResult.success || !nomeResult.success) {
      toast({
        variant: "destructive",
        title: "Erro de validação",
        description: "Por favor, verifique os dados informados"
      });
      return { error: new Error("Validation failed") };
    }
    
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email: emailResult.data,
      password: passwordResult.data,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nome: nomeResult.data
        }
      }
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao criar conta",
        description: error.message
      });
    } else {
      toast({
        title: "Conta criada com sucesso!",
        description: "Você já pode fazer login com a role padrão de cliente."
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    toast({
      title: "Logout realizado",
      description: "Até logo!"
    });
  };

  const hasRole = (role: string) => userRole === role;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signIn,
      signUp,
      signOut,
      userRole,
      hasRole,
      needsPasswordChange
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
