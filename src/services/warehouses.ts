/**
 * Service layer for warehouse operations
 * Handles Edge Function calls and error normalization for warehouse creation
 */

interface CreateWarehousePayload {
  nome: string;
  email: string;
  cidade: string;
  estado: string;
  telefone?: string;
  endereco?: string;
  capacidade_total?: number;
}

interface CreateWarehouseResponse {
  success: boolean;
  status?: number;
  error?: string;
  details?: string;
  armazem?: Record<string, unknown>;
  senha?: string;
}

/**
 * Creates a new warehouse by calling the Edge Function 'create-armazem-user'
 * Normalizes errors and returns friendly messages for common scenarios
 * 
 * @param supabaseUrl - The Supabase project URL
 * @param supabaseAnonKey - The Supabase anonymous key
 * @param payload - Warehouse data
 * @param authToken - Optional authorization token (uses session token if not provided)
 * @returns Response with success status and normalized error messages
 */
export async function createWarehouse(
  supabaseUrl: string,
  supabaseAnonKey: string,
  payload: CreateWarehousePayload,
  authToken?: string
): Promise<CreateWarehouseResponse> {
  try {
    // Make manual fetch request for full control over response
    const response = await fetch(`${supabaseUrl}/functions/v1/create-armazem-user`, {
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
          details: 'Você não tem permissão para criar armazéns.'
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
            if (details.includes('armazens_nome_unique') || (details.includes('nome') && details.includes('duplicate'))) {
              duplicateMessage = 'Já existe um armazém com este nome.';
            } else if (details.includes('armazens_cidade_unique') || (details.includes('cidade') && details.includes('duplicate'))) {
              duplicateMessage = 'Já existe um armazém nesta cidade.';
            } else if (details.includes('email') && details.includes('duplicate')) {
              duplicateMessage = 'Este email já está cadastrado no sistema.';
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
      let errorMessage = 'Erro ao criar armazém';

      if (data) {
        // Extract error message from backend response
        const rawDetails = String(data.details || data.error || '');

        // Translate common Supabase messages
        if (rawDetails.includes('already been registered') || rawDetails.includes('already exists')) {
          errorMessage = 'Este email já está cadastrado no sistema.';
        } else if (rawDetails.includes('duplicate')) {
          const detailsLower = rawDetails.toLowerCase();
          if (detailsLower.includes('armazens_nome_unique') || (detailsLower.includes('nome'))) {
            errorMessage = 'Já existe um armazém com este nome.';
          } else if (detailsLower.includes('armazens_cidade_unique') || (detailsLower.includes('cidade'))) {
            errorMessage = 'Já existe um armazém nesta cidade.';
          } else if (detailsLower.includes('email')) {
            errorMessage = 'Este email já está cadastrado no sistema.';
          } else {
            errorMessage = 'Já existe um registro com estes dados.';
          }
        } else if (rawDetails.includes('armazens_nome_unique')) {
          errorMessage = 'Já existe um armazém com este nome.';
        } else if (rawDetails.includes('armazens_cidade_unique')) {
          errorMessage = 'Já existe um armazém nesta cidade.';
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
        } else if (data.stage === 'createArmazem') {
          // Duplicates already handled above
          errorMessage = data.details || 'Falha ao criar registro de armazém.';
        }
      }

      return {
        success: false,
        status: response.status,
        error: 'Erro ao criar armazém',
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
        armazem: data.armazem,
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
    console.error('❌ [ERROR] Exception in createWarehouse:', err);
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    return {
      success: false,
      error: 'Erro de conexão',
      details: errorMessage
    };
  }
}
