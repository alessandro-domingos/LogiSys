/**
 * Service layer for customer operations
 * Handles Edge Function calls and error normalization for customer creation
 */

interface CreateCustomerPayload {
  nome: string;
  cnpj_cpf: string;
  email: string;
  telefone?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

interface CreateCustomerResponse {
  success: boolean;
  status?: number;
  error?: string;
  details?: string;
  cliente?: Record<string, unknown>;
  senha?: string;
}

/**
 * Creates a new customer by calling the Edge Function 'create-customer-user'
 * Normalizes errors and returns friendly messages for common scenarios
 * 
 * @param supabaseUrl - The Supabase project URL
 * @param supabaseAnonKey - The Supabase anonymous key
 * @param payload - Customer data
 * @param authToken - Optional authorization token (uses session token if not provided)
 * @returns Response with success status and normalized error messages
 */
export async function createCustomer(
  supabaseUrl: string,
  supabaseAnonKey: string,
  payload: CreateCustomerPayload,
  authToken?: string
): Promise<CreateCustomerResponse> {
  try {
    // Make manual fetch request for full control over response
    const response = await fetch(`${supabaseUrl}/functions/v1/create-customer-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify(payload)
    });

    // Parse response body
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

    // Handle non-2xx responses
    if (!response.ok) {
      console.error('❌ [ERROR] Edge Function returned non-2xx status:', response.status);

      // Handle 401 - Not authenticated
      if (response.status === 401) {
        return {
          success: false,
          status: 401,
          error: 'Não autenticado',
          details: 'Sessão expirada. Faça login novamente.'
        };
      }

      // Handle 403 - Forbidden/No permission
      if (response.status === 403) {
        return {
          success: false,
          status: 403,
          error: 'Sem permissão',
          details: 'Você não tem permissão para criar clientes.'
        };
      }

      // Handle 409 - Conflict/Duplicate or explicit Duplicidade error
      if (response.status === 409 || (data && String(data.error) === 'Duplicidade')) {
        // Prefer backend's details message if available and meaningful
        let duplicateMessage = 'Já existe um registro com estes dados.';
        
        if (data?.details && typeof data.details === 'string') {
          // Use backend message if it's already user-friendly (starts with "Já existe")
          if (data.details.startsWith('Já existe')) {
            duplicateMessage = data.details;
          } else {
            // Otherwise, parse the backend message for specifics
            const details = data.details.toLowerCase();
            if (details.includes('clientes_email_unique') || details.includes('email')) {
              duplicateMessage = 'Este email já está cadastrado no sistema.';
            } else if (details.includes('clientes_cnpj_cpf_unique') || details.includes('cnpj') || details.includes('cpf')) {
              duplicateMessage = 'Este CNPJ/CPF já está cadastrado no sistema.';
            }
          }
        }

        return {
          success: false,
          status: response.status,
          error: 'Duplicidade',
          details: duplicateMessage
        };
      }

      // Handle other error status codes
      let errorMessage = 'Erro ao criar cliente';

      if (data) {
        // Extract error message from backend response
        const rawDetails = String(data.details || data.error || '');

        // Translate common Supabase messages
        if (rawDetails.includes('already been registered') || rawDetails.includes('already exists')) {
          errorMessage = 'Este email já está cadastrado no sistema.';
        } else if (rawDetails.includes('duplicate') && rawDetails.includes('email')) {
          errorMessage = 'Este email já está cadastrado no sistema.';
        } else if (rawDetails.includes('duplicate') && (rawDetails.includes('cnpj') || rawDetails.includes('cpf'))) {
          errorMessage = 'Este CNPJ/CPF já está cadastrado no sistema.';
        } else if (rawDetails.includes('clientes_email_unique')) {
          errorMessage = 'Este email já está cadastrado no sistema.';
        } else if (rawDetails.includes('clientes_cnpj_cpf_unique')) {
          errorMessage = 'Este CNPJ/CPF já está cadastrado no sistema.';
        } else if (data.details) {
          errorMessage = data.details;
        } else if (data.error) {
          errorMessage = data.error;
        }

        // Specific messages by stage
        if (data.stage === 'validation' && data.error?.includes('Weak password')) {
          errorMessage = 'Senha gerada muito fraca. Por favor, tente novamente.';
        } else if (data.stage === 'createUser') {
          if (rawDetails.includes('already been registered') || rawDetails.includes('already exists')) {
            errorMessage = 'Este email já está cadastrado no sistema.';
          }
        } else if (data.stage === 'createCliente') {
          // Duplicates already handled above
          errorMessage = data.details || 'Falha ao criar registro de cliente.';
        }
      }

      return {
        success: false,
        status: response.status,
        error: 'Erro ao criar cliente',
        details: errorMessage
      };
    }

    // Success case - verify we have valid data
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
      // Unexpected response structure
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
