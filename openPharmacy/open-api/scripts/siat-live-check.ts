/**
 * Manual live check against the SIAT **pilot**: calls verificarComunicacion on the five services.
 * It confirms that the token delegado and the `apikey: TokenApi <token>` header are accepted.
 * verificarComunicacion has no fields and changes nothing in SIAT. Never run by `npm test`.
 *
 *   npm run siat:live-check              # check only
 *   npm run siat:live-check -- --record  # also save the responses as test fixtures
 *
 * Needs SIAT_TOKEN in your local .env (put it there yourself; never paste it in chat or commit it).
 * Refuses to run unless SIAT_ENV is pilot. The token is never printed or written to a fixture.
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSiatConfig } from '../src/modules/siat/config/siat.config';
import { staticSiatCredentials } from '../src/modules/siat/config/siat-credentials';
import { SiatHttpTransport } from '../src/modules/siat/client/siat-http-transport';
import { MemorySiatRequestLogSink } from '../src/modules/siat/client/siat-request-log';
import { SiatSoapClient } from '../src/modules/siat/client/siat-soap.client';
import { SiatHealthService } from '../src/modules/siat/client/siat-health.service';
import type { SiatServiceName } from '../src/modules/siat/client/siat-operations';

const SERVICES: SiatServiceName[] = [
  'FacturacionCodigos',
  'FacturacionSincronizacion',
  'FacturacionOperaciones',
  'ServicioFacturacionCompraVenta',
  'ServicioFacturacionDocumentoAjuste',
];

/** Read by siat-recorded-fixtures.spec.ts. */
const RECORDED_FIXTURES_DIR = join(
  __dirname,
  '..',
  'src',
  'modules',
  'siat',
  'client',
  '__fixtures__',
  'recorded',
);

async function main(): Promise<number> {
  const record = process.argv.includes('--record');
  const config = readSiatConfig();

  if (config.environment !== 'pilot') {
    console.error(
      `Refusing to run: SIAT_ENV is "${config.environment}". This script only calls the pilot.`,
    );
    return 2;
  }
  if (!config.token) {
    console.error(
      'SIAT_TOKEN is empty. Put the pilot token delegado in your local .env and run again.',
    );
    return 2;
  }

  const log = new MemorySiatRequestLogSink();
  const client = new SiatSoapClient(
    config,
    new SiatHttpTransport(),
    log,
    staticSiatCredentials({ token: config.token }),
  );
  const health = new SiatHealthService(client);

  console.log(`SIAT pilot: ${config.baseUrl}`);
  let failures = 0;

  for (const service of SERVICES) {
    const check = await health.checkConnection(service);
    const entry = log.entries.at(-1);
    const mensajes = check.mensajes
      .map((m) => `${m.codigo} ${m.descripcion}`)
      .join('; ');
    console.log(
      [
        check.status === 'ok' ? 'OK  ' : 'FAIL',
        service.padEnd(36),
        `${check.status}`.padEnd(15),
        `http=${entry?.httpStatus ?? '-'}`,
        `${check.durationMs} ms`,
        mensajes || check.detail || '',
      ].join('  '),
    );
    if (check.status !== 'ok') failures++;

    if (record && entry?.responseXml) {
      if (entry.responseXml.includes(config.token)) {
        throw new Error('A response contains the token. Nothing was saved.');
      }
      mkdirSync(RECORDED_FIXTURES_DIR, { recursive: true });
      const file = join(
        RECORDED_FIXTURES_DIR,
        `${service}.verificarComunicacion.${check.status}.xml`,
      );
      writeFileSync(file, entry.responseXml, 'utf8');
      console.log(`      saved ${file}`);
    }
  }

  console.log(
    failures === 0
      ? '\nAll services answered. The token and the apikey header are accepted.'
      : `\n${failures} service(s) did not answer "ok". See the status column above.`,
  );
  return failures === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
