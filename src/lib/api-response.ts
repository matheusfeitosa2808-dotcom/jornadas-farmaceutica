type ApiPayload = Record<string, any>;

export class ApiResponseError extends Error {
  code?: string;
  details?: unknown;
  conflicts?: unknown;

  constructor(message: string, payload: ApiPayload = {}) {
    super(message);
    this.name = "ApiResponseError";
    this.code = payload.code;
    this.details = payload.details;
    this.conflicts = payload.conflicts;
  }
}

function fallbackMessage(response: Response, fallback: string) {
  if (response.status === 413)
    return "O arquivo é muito grande. Escolha uma imagem de até 5 MB.";
  if ([502, 503, 504].includes(response.status))
    return "O servidor está temporariamente ocupado. Tente novamente em alguns segundos.";
  if (response.status >= 500)
    return "O servidor não conseguiu concluir a operação. Tente novamente.";
  return fallback;
}

/**
 * Lê respostas da API sem expor erros de JSON quando um proxy devolve HTML.
 */
export async function readApiResponse<T extends ApiPayload = ApiPayload>(
  response: Response,
  fallback = "Não foi possível concluir.",
): Promise<T> {
  const text = await response.text();
  let payload: ApiPayload | null = null;

  if (text) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") payload = parsed;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new ApiResponseError(
      typeof payload?.error === "string"
        ? payload.error
        : fallbackMessage(response, fallback),
      payload || {},
    );
  }

  if (!payload)
    throw new ApiResponseError(
      "O servidor enviou uma resposta inválida. Atualize a página e tente novamente.",
    );

  return payload as T;
}
