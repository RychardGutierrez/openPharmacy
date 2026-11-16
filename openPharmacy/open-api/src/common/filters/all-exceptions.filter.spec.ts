import { ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';
import {
  SiatConfigError,
  SiatFaultError,
  SiatProtocolError,
  SiatUnavailableError,
} from '../../modules/siat/client/siat-errors';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn<void, [Record<string, unknown>]>();
  const status = jest
    .fn<{ json: typeof json }, [number]>()
    .mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/api/sales' }),
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);

  return {
    status: status.mock.calls[0][0],
    body: json.mock.calls[0][0],
  };
}

describe('AllExceptionsFilter', () => {
  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterAll(() => jest.restoreAllMocks());

  it('keeps the status of an HttpException', () => {
    expect(run(new NotFoundException('Sale not found'))).toMatchObject({
      status: 404,
      body: { statusCode: 404, message: 'Sale not found' },
    });
  });

  it('turns an unexpected error into a 500 without details', () => {
    const { status, body } = run(new Error('db password is wrong'));

    expect(status).toBe(500);
    expect(body.message).toBe('Internal server error');
  });

  it.each(['not-sent', 'unknown'] as const)(
    'maps a SIAT timeout to 503 with outcome "%s", not a generic 500',
    (outcome) => {
      expect(
        run(new SiatUnavailableError('SIAT total timeout', outcome)),
      ).toMatchObject({
        status: 503,
        body: { statusCode: 503, error: 'SiatUnavailable', outcome },
      });
    },
  );

  it('maps a SIAT fault to 502 without the SIN fault text', () => {
    const { status, body } = run(
      new SiatFaultError('soap:Server', 'internal detail from SIN'),
    );

    expect(status).toBe(502);
    expect(body.error).toBe('SiatFault');
    expect(JSON.stringify(body)).not.toContain('internal detail');
  });

  it('maps an unreadable SIAT response to 502', () => {
    expect(run(new SiatProtocolError('not a SOAP envelope'))).toMatchObject({
      status: 502,
      body: { error: 'SiatProtocolError' },
    });
  });

  it('keeps a SIAT configuration error as a 500 (our fault, not SIAT)', () => {
    expect(run(new SiatConfigError('SIAT_TOKEN is not set')).status).toBe(500);
  });
});
