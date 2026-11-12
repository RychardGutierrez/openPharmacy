import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SIAT_SPEC_V3_DIR, SiatXsdValidator } from './siat-xsd-validator';

const EXAMPLE_PATH = join(
  SIAT_SPEC_V3_DIR,
  'examples',
  'facturaComputarizadaCompraVenta.xml',
);
const XSD = 'facturaComputarizadaCompraVenta.xsd' as const;

/** Replaces `search` with `replacement` and fails the test if the edit did not change the XML. */
function edit(
  xml: string,
  search: string | RegExp,
  replacement: string,
): string {
  const changed = xml.replace(search, replacement);
  if (changed === xml) {
    throw new Error(`Test fixture edit did not match: ${String(search)}`);
  }
  return changed;
}

describe('SiatXsdValidator (Computarizada Compra-Venta, V3)', () => {
  let validator: SiatXsdValidator;
  let example: string;

  beforeAll(async () => {
    validator = new SiatXsdValidator();
    example = await readFile(EXAMPLE_PATH, 'utf8');
  });

  it('accepts the annex example XML', async () => {
    const result = await validator.validate(example, XSD, 'example.xml');

    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('rejects a document missing a required field', async () => {
    const broken = edit(example, /<nitEmisor>[^<]*<\/nitEmisor>/, '');

    const result = await validator.validate(broken, XSD);

    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.message).join('\n')).toMatch(/nitEmisor/);
  });

  it('rejects elements in the wrong sequence order', async () => {
    // xs:sequence is order-sensitive: swap the first two header fields.
    const broken = edit(
      example,
      /(<nitEmisor>[^<]*<\/nitEmisor>)\s*(<razonSocialEmisor>[^<]*<\/razonSocialEmisor>)/,
      '$2$1',
    );

    const result = await validator.validate(broken, XSD);

    expect(result.valid).toBe(false);
  });

  it('rejects a digital signature node, which the Computarizada XSD does not allow', async () => {
    const signed = edit(
      example,
      /<facturaComputarizadaCompraVenta([^>]*)>/,
      '<facturaComputarizadaCompraVenta$1><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"/>',
    );

    const result = await validator.validate(signed, XSD);

    expect(result.valid).toBe(false);
  });

  it('rejects a value outside its facet range (nitEmisor minimum is 1)', async () => {
    const broken = edit(
      example,
      /<nitEmisor>[^<]*<\/nitEmisor>/,
      '<nitEmisor>0</nitEmisor>',
    );

    const result = await validator.validate(broken, XSD);

    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('reports line numbers for issues', async () => {
    const broken = edit(
      example,
      /<nitEmisor>[^<]*<\/nitEmisor>/,
      '<nitEmisor>0</nitEmisor>',
    );

    const result = await validator.validate(broken, XSD);

    expect(result.issues.some((i) => typeof i.line === 'number')).toBe(true);
  });
});

describe('SiatXsdValidator (Computarizada Nota de Crédito-Débito, V3)', () => {
  const NOTA_XSD = 'notaComputarizadaCreditoDebito.xsd' as const;
  let validator: SiatXsdValidator;
  let example: string;

  beforeAll(async () => {
    validator = new SiatXsdValidator();
    example = await readFile(
      join(SIAT_SPEC_V3_DIR, 'examples', 'notaComputarizadaCreditoDebito.xml'),
      'utf8',
    );
  });

  it('accepts the annex example XML', async () => {
    const result = await validator.validate(example, NOTA_XSD, 'example.xml');

    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('rejects a document missing the original invoice CUF', async () => {
    const broken = edit(
      example,
      /<numeroAutorizacionCuf>[^<]*<\/numeroAutorizacionCuf>/,
      '',
    );

    const result = await validator.validate(broken, NOTA_XSD);

    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.message).join('\n')).toMatch(
      /numeroAutorizacionCuf/,
    );
  });

  it('rejects a document whose detail count is below the minimum of 2', async () => {
    // The schema requires at least two <detalle> lines. The example has three, so remove two.
    const details = [...example.matchAll(/<detalle>[\s\S]*?<\/detalle>/g)];
    expect(details.length).toBe(3);
    const broken = example
      .replace(details[1][0], '')
      .replace(details[2][0], '');

    const result = await validator.validate(broken, NOTA_XSD);

    expect(result.valid).toBe(false);
  });
});
