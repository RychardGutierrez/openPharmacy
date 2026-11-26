/**
 * Errors thrown by the SIAT client.
 *
 * `outcome` answers the question the caller needs after a failure:
 *   - `not-sent`: the request never reached SIAT (for example, connection refused or a connect timeout).
 *     Retrying is safe.
 *   - `unknown`: the request may have been received. A timeout after sending does not mean the
 *     invoice was rejected. The caller must check the status (verificación) before resending.
 */
export type SiatOutcome = 'not-sent' | 'unknown';

export class SiatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** SIAT could not be reached or did not answer in time. The "outcome" tells the caller whether it may have been received. */
export class SiatUnavailableError extends SiatError {
  constructor(
    message: string,
    readonly outcome: SiatOutcome,
  ) {
    super(message);
  }
}

/** SIAT answered with a SOAP fault. */
export class SiatFaultError extends SiatError {
  constructor(
    readonly faultCode: string,
    readonly faultString: string,
  ) {
    super(`SIAT fault ${faultCode}: ${faultString}`);
  }
}

/** The response is not a SOAP envelope or does not have the expected structure. */
export class SiatProtocolError extends SiatError {}

/** Missing or invalid SIAT configuration, such as an empty token. */
export class SiatConfigError extends SiatError {}

/**
 * SIAT answered normally but refused the request (`transaccion=false` with no usable result).
 * `codes` are the `mensajesList` codes, which match the annex "Códigos Error SIAT" table.
 */
export class SiatRejectedError extends SiatError {
  constructor(
    readonly operation: string,
    readonly messages: ReadonlyArray<{ codigo: number; descripcion: string }>,
  ) {
    super(
      `SIAT rejected ${operation}: ${messages.map((m) => `${m.codigo} ${m.descripcion}`).join('; ') || 'no message'}`,
    );
  }

  get codes(): number[] {
    return this.messages.map((m) => m.codigo);
  }
}

/**
 * HTTP answer for a SIAT error that reaches a route, used by the global exception filter.
 * Returns undefined for anything else (and for SiatConfigError, which stays a 500: our fault).
 *
 * - SiatUnavailableError → 503, with `outcome` so the client knows whether to verify before resending.
 * - SiatFaultError / SiatProtocolError → 502: SIAT answered, but not with a usable response.
 *
 * SIN fault texts are not sent to the browser; they are in the request log and the server log.
 */
export function siatErrorToHttp(
  exception: unknown,
): { status: number; body: Record<string, unknown> } | undefined {
  if (exception instanceof SiatUnavailableError) {
    return {
      status: 503,
      body: {
        statusCode: 503,
        error: 'SiatUnavailable',
        message: 'SIAT is unavailable. Try again later.',
        outcome: exception.outcome,
      },
    };
  }
  if (exception instanceof SiatFaultError) {
    return {
      status: 502,
      body: {
        statusCode: 502,
        error: 'SiatFault',
        message: 'SIAT rejected the request.',
      },
    };
  }
  if (exception instanceof SiatRejectedError) {
    // The SIN message codes are safe to show (no SIN text): the admin looks them up in the annex.
    return {
      status: 422,
      body: {
        statusCode: 422,
        error: 'SiatRejected',
        message: 'SIAT rejected the request.',
        codes: exception.codes,
      },
    };
  }
  if (exception instanceof SiatProtocolError) {
    return {
      status: 502,
      body: {
        statusCode: 502,
        error: 'SiatProtocolError',
        message: 'SIAT returned a response that could not be read.',
      },
    };
  }
  return undefined;
}
