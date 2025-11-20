export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          created_at: string | null
          created_by: string
          data_retirada: string
          horario: string
          id: string
          liberacao_id: string
          motorista_documento: string
          motorista_nome: string
          observacoes: string | null
          placa_caminhao: string
          quantidade: number
          status: string | null
          tipo_caminhao: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          data_retirada: string
          horario: string
          id?: string
          liberacao_id: string
          motorista_documento: string
          motorista_nome: string
          observacoes?: string | null
          placa_caminhao: string
          quantidade: number
          status?: string | null
          tipo_caminhao?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          data_retirada?: string
          horario?: string
          id?: string
          liberacao_id?: string
          motorista_documento?: string
          motorista_nome?: string
          observacoes?: string | null
          placa_caminhao?: string
          quantidade?: number
          status?: string | null
          tipo_caminhao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_liberacao_id_fkey"
            columns: ["liberacao_id"]
            isOneToOne: false
            referencedRelation: "liberacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      armazens: {
        Row: {
          ativo: boolean | null
          cidade: string
          created_at: string | null
          estado: string
          id: string
          nome: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          cidade: string
          created_at?: string | null
          estado: string
          id?: string
          nome: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          cidade?: string
          created_at?: string | null
          estado?: string
          id?: string
          nome?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "armazens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      carregamentos: {
        Row: {
          agendamento_id: string
          created_at: string | null
          id: string
          numero_nf: string | null
          observacoes: string | null
          status: Database["public"]["Enums"]["status_carregamento"] | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          agendamento_id: string
          created_at?: string | null
          id?: string
          numero_nf?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_carregamento"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          agendamento_id?: string
          created_at?: string | null
          id?: string
          numero_nf?: string | null
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_carregamento"] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carregamentos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carregamentos_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque: {
        Row: {
          armazem_id: string
          id: string
          produto_id: string
          quantidade: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          armazem_id: string
          id?: string
          produto_id: string
          quantidade?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          armazem_id?: string
          id?: string
          produto_id?: string
          quantidade?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_armazem_id_fkey"
            columns: ["armazem_id"]
            isOneToOne: false
            referencedRelation: "armazens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos_carregamento: {
        Row: {
          carregamento_id: string
          created_at: string | null
          id: string
          tipo: Database["public"]["Enums"]["tipo_foto"]
          uploaded_by: string
          url: string
        }
        Insert: {
          carregamento_id: string
          created_at?: string | null
          id?: string
          tipo: Database["public"]["Enums"]["tipo_foto"]
          uploaded_by: string
          url: string
        }
        Update: {
          carregamento_id?: string
          created_at?: string | null
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_foto"]
          uploaded_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_carregamento_carregamento_id_fkey"
            columns: ["carregamento_id"]
            isOneToOne: false
            referencedRelation: "carregamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_carregamento_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      liberacoes: {
        Row: {
          armazem_id: string
          cliente_nome: string
          created_at: string | null
          created_by: string
          data_liberacao: string | null
          id: string
          pedido_interno: string
          produto_id: string
          quantidade_liberada: number
          quantidade_retirada: number
          status: Database["public"]["Enums"]["status_liberacao"] | null
        }
        Insert: {
          armazem_id: string
          cliente_nome: string
          created_at?: string | null
          created_by: string
          data_liberacao?: string | null
          id?: string
          pedido_interno: string
          produto_id: string
          quantidade_liberada: number
          quantidade_retirada?: number
          status?: Database["public"]["Enums"]["status_liberacao"] | null
        }
        Update: {
          armazem_id?: string
          cliente_nome?: string
          created_at?: string | null
          created_by?: string
          data_liberacao?: string | null
          id?: string
          pedido_interno?: string
          produto_id?: string
          quantidade_liberada?: number
          quantidade_retirada?: number
          status?: Database["public"]["Enums"]["status_liberacao"] | null
        }
        Relationships: [
          {
            foreignKeyName: "liberacoes_armazem_id_fkey"
            columns: ["armazem_id"]
            isOneToOne: false
            referencedRelation: "armazens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liberacoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liberacoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          unidade: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          unidade?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          unidade?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          id: string
          nome: string
          cnpj_cpf: string
          email: string
          telefone: string | null
          endereco: string | null
          cidade: string | null
          estado: string | null
          cep: string | null
          ativo: boolean | null
          user_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          nome: string
          cnpj_cpf: string
          email: string
          telefone?: string | null
          endereco?: string | null
          cidade?: string | null
          estado?: string | null
          cep?: string | null
          ativo?: boolean | null
          user_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          nome?: string
          cnpj_cpf?: string
          email?: string
          telefone?: string | null
          endereco?: string | null
          cidade?: string | null
          estado?: string | null
          cep?: string | null
          ativo?: boolean | null
          user_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          id: string
          nome: string
          cpf: string
          email: string
          telefone: string | null
          cargo: string | null
          departamento: string | null
          ativo: boolean | null
          user_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          nome: string
          cpf: string
          email: string
          telefone?: string | null
          cargo?: string | null
          departamento?: string | null
          ativo?: boolean | null
          user_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          nome?: string
          cpf?: string
          email?: string
          telefone?: string | null
          cargo?: string | null
          departamento?: string | null
          ativo?: boolean | null
          user_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_read: boolean | null
          can_update: boolean | null
          created_at: string | null
          id: string
          resource: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_read?: boolean | null
          can_update?: boolean | null
          created_at?: string | null
          id?: string
          resource: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_read?: boolean | null
          can_update?: boolean | null
          created_at?: string | null
          id?: string
          resource?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          nome: string
          roles: Database["public"]["Enums"]["user_role"][]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      update_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      status_carregamento:
        | "aguardando"
        | "liberado"
        | "carregando"
        | "carregado"
        | "nf_entregue"
      status_liberacao: "pendente" | "parcial" | "concluido"
      tipo_foto: "chegada" | "durante" | "carregado" | "saida"
      user_role: "logistica" | "comercial" | "cliente" | "armazem" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      status_carregamento: [
        "aguardando",
        "liberado",
        "carregando",
        "carregado",
        "nf_entregue",
      ],
      status_liberacao: ["pendente", "parcial", "concluido"],
      tipo_foto: ["chegada", "durante", "carregado", "saida"],
      user_role: ["logistica", "comercial", "cliente", "armazem", "admin"],
    },
  },
} as const
