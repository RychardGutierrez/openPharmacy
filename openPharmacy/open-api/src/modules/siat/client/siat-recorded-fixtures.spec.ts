import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SIAT_OPERATIONS, type SiatServiceName } from './siat-operations';
import { parseResponse } from './siat-soap-envelope';

/**
 * Real SIAT pilot responses, recorded with `npm run siat:live-check -- --record`.
 * File name: <Service>.<operation>.<status>.xml. The token is checked out before saving.
 */
const DIR = join(__dirname, '__fixtures__', 'recorded');
const FILE = /^(\w+)\.(\w+)\.(ok|rejected)\.xml$/;

const fixtures = existsSync(DIR)
  ? readdirSync(DIR)
      .map((file) => FILE.exec(file))
      .filter((match): match is RegExpExecArray => match !== null)
  : [];

describe('Recorded SIAT pilot responses', () => {
  if (fixtures.length === 0) {
    it.todo('record them with: npm run siat:live-check -- --record');
    return;
  }

  it.each(fixtures.map((m) => [m[0], m[1], m[2], m[3]] as const))(
    '%s parses to the recorded status',
    (file, service, operation, status) => {
      const group = SIAT_OPERATIONS[service as SiatServiceName] as Record<
        string,
        (typeof SIAT_OPERATIONS)['FacturacionCodigos']['verificarComunicacion']
      >;
      const xml = readFileSync(join(DIR, file), 'utf8');

      const result = parseResponse(xml, group[operation]);

      expect(result.transaccion).toBe(status === 'ok');
    },
  );
});
