/**
 * Service layer for customer operations
 * Handles Edge Function calls and error normalization for customer creation
 */

export interface CreateCustomerPayload {
  nome: string;
  cnpj_cpf: string;
  email: string;
  telefone?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

export interface CreateCustomerResponse {
  success: boolean;
  status?: number;
  error?: string;
  details?: string;
  cliente?: Record<string, unknown>;
  senha?: string;
}

/**
 * Creates a new customer by calling the Edge Function 'create-customer-user'
 * Always parses JSON response and prioritizes showing friendly backend 'details'
 */
export async function createCustomer(
  supabaseUrl: string,
  supabaseAnonKey: string,
  payload: CreateCustomerPayload,
  authToken?: string
): Promise<CreateCustomerResponse> {
  try {
    // Always normalize CNPJ/CPF before sending
    const normalizedPayload = {
      ...payload,
      cnpj_cpf: payload.cnpj_cpf.replace(/\D/g, '')
    };

    // Manual fetch – never use supabase.functions.invoke
    const response = await fetch(`${supabaseUrl}/functions/v1/create-customer-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken ?? ''}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify(normalizedPayload)
    });

    let data: Record<string, unknown> | null = null;
    try {
      data = await response.json();
    } catch (parseError) {
      console.error('❌ [ERROR] Failed to parse response JSON:', parseError);
      return {
        success: false,
        status: response.status,
        error: 'Resposta inválida do servidor',
        details: 'Não foi possível processar a resposta do servidor. Verifique os logs para mais detalhes.'
      };
    }

    console.log('🔍 [DEBUG] Edge Function response:', { status: response.status, data });

    // Show backend's friendly messages for all errors!
    if (!response.ok) {
      const errorMessage = (data?.details as string) || (data?.error as string) || 'Ocorreu um erro ao processar sua solicitação.';
      const errorType = data?.error || 'Erro ao criar cliente';
      return {
        success: false,
        status: response.status,
        error: String(errorType),
        details: String(errorMessage)
      };
    }

    if (!data) {
      return {
        success: false,
        status: response.status,
        error: 'Resposta vazia',
        details: 'O servidor não retornou dados.'
      };
    }

    if (data.success) {
      return {
        success: true,
        status: response.status,
        cliente: data.cliente,
        senha: data.senha
      };
    } else {
      return {
        success: false,
        status: response.status,
        error: 'Erro inesperado',
        details: data.error || data.details || 'Resposta inesperada do servidor'
      };
    }
  } catch (err) {
    console.error('❌ [ERROR] Exception in createCustomer:', err);
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    return {
      success: false,
      error: 'Erro de conexão',
      details: errorMessage
    };
  }
}
