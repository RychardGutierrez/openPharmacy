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
