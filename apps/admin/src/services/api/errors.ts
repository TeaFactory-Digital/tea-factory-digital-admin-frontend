/**
 * The error the whole console branches on.
 *
 * `code` is the machine-readable domain code; `message` is English-only and
 * treated as a fallback for when there is no better local string (§17.4).
 * Localized copy lives in the i18n tables — a server-translated message would
 * need an `Accept-Language` round trip and still not match the console's wording.
 */

export interface ApiErrorInit {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status;
    this.details = init.details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Codes produced by the client itself rather than the server, so a screen can
 * tell "the factory said no" apart from "the office wifi dropped".
 */
export const TRANSPORT_CODES = {
  network: 'network',
  timeout: 'timeout',
  cancelled: 'cancelled',
} as const;

/**
 * Does this error mean the request never reached the API?
 *
 * Worth distinguishing because the remedy differs: a domain rejection is final
 * and needs explaining, a transport failure is worth a retry button.
 */
export function isTransportError(error: unknown): boolean {
  return isApiError(error) && Object.values(TRANSPORT_CODES).includes(error.code as never);
}
