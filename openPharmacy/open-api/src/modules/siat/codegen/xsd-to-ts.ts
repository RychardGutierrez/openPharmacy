import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';

/**
 * Generates TypeScript interfaces from the pinned SIAT XSD files.
 *
 * Supported XSD subset (the constructs used by the V3 Computarizada schemas):
 *   element (name, type, fixed, minOccurs, maxOccurs, nillable), complexType with a single
 *   xs:sequence, and simpleType/restriction over string, integer, decimal, dateTime and
 *   boolean with length, value-range and digit facets.
 *
 * Anything else (choice, attribute, enumeration, extension, named types, any) throws.
 * An unsupported construct must fail the build, not produce a wrong type.
 */

/** Source XSD and generated output pairs. */
export const SIAT_TYPE_TARGETS = [
  {
    xsdFile: 'facturaComputarizadaCompraVenta.xsd',
    outputFile: 'facturaComputarizadaCompraVenta.types.ts',
  },
  {
    xsdFile: 'notaComputarizadaCreditoDebito.xsd',
    outputFile: 'notaComputarizadaCreditoDebito.types.ts',
  },
] as const;

export const SIAT_SPEC_XSD_DIR = join(__dirname, '..', 'spec', 'v3', 'xsd');
export const SIAT_GENERATED_TYPES_DIR = join(
  __dirname,
  '..',
  'types',
  'generated',
);

const SCALAR_TYPES: Record<string, string> = {
  string: 'string',
  integer: 'number',
  int: 'number',
  long: 'number',
  decimal: 'number',
  dateTime: 'string',
  boolean: 'boolean',
};

const SUPPORTED_FACETS = [
  'minLength',
  'maxLength',
  'minInclusive',
  'minExclusive',
  'maxInclusive',
  'maxExclusive',
  'totalDigits',
  'fractionDigits',
  'pattern',
];

const ELEMENT_KEYS = [
  '@_name',
  '@_type',
  '@_fixed',
  '@_minOccurs',
  '@_maxOccurs',
  '@_nillable',
  'simpleType',
  'complexType',
];

/** A parsed XML node. Attributes are keyed with a "@_" prefix. */
type XsdNode = Record<string, unknown>;

interface Member {
  name: string;
  tsType: string;
  optional: boolean;
  nullable: boolean;
  isArray: boolean;
  doc: string;
}

interface Declaration {
  name: string;
  members: Member[];
}

interface TypeRef {
  tsType: string;
  doc: string;
}

export function generateTypesFromXsd(
  xsdText: string,
  sourceLabel: string,
): string {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });
  const schema = asNode(asNode(parser.parse(xsdText))?.schema);
  if (!schema) {
    throw new Error(`${sourceLabel}: missing <schema> root`);
  }
  assertKeys(schema, ['@_', 'element'], `${sourceLabel} <schema>`);

  const roots = toList(schema.element);
  if (roots.length !== 1) {
    throw new Error(
      `${sourceLabel}: expected one root element, found ${roots.length}`,
    );
  }

  const declarations: Declaration[] = [];
  const rootName = pascal(requiredText(roots[0]['@_name'], sourceLabel));
  visitElement(roots[0], rootName, declarations, sourceLabel);

  const sha = createHash('sha256').update(xsdText).digest('hex');
  return renderFile(declarations, sourceLabel, sha);
}

function visitElement(
  element: XsdNode,
  typeName: string,
  declarations: Declaration[],
  label: string,
): TypeRef {
  const name = requiredText(element['@_name'], label);
  assertKeys(element, ELEMENT_KEYS, `${label} element "${name}"`);

  const xsdType = textOf(element['@_type']);
  if (xsdType !== undefined) {
    const ref = scalarFromXsdType(xsdType, label, name);
    const fixed = textOf(element['@_fixed']);
    if (fixed !== undefined) {
      // A fixed value is a single allowed value, so the compiler should reject any other.
      return {
        tsType: fixedLiteral(fixed, ref.tsType, `${label}.${name}`),
        doc: `${ref.doc} · fixed ${fixed}`,
      };
    }
    return ref;
  }

  const simpleType = asNode(element.simpleType);
  if (simpleType) {
    return scalarFromSimpleType(simpleType, `${label}.${name}`);
  }

  const complex = asNode(element.complexType);
  if (complex) {
    assertKeys(complex, ['sequence'], `${label} complexType "${name}"`);
    const sequence = asNode(complex.sequence);
    if (!sequence) {
      throw new Error(
        `${label}: complexType "${name}" has no sequence (unsupported)`,
      );
    }
    assertKeys(sequence, ['element'], `${label} sequence "${name}"`);

    const members = toList(sequence.element).map((child): Member => {
      const childName = requiredText(child['@_name'], label);
      const ref = visitElement(
        child,
        typeName + pascal(childName),
        declarations,
        label,
      );
      return {
        name: childName,
        tsType: ref.tsType,
        optional: textOf(child['@_minOccurs']) === '0',
        nullable: textOf(child['@_nillable']) === 'true',
        isArray: isMany(textOf(child['@_maxOccurs'])),
        doc: ref.doc,
      };
    });

    declarations.push({ name: typeName, members });
    return { tsType: typeName, doc: '' };
  }

  throw new Error(`${label}: element "${name}" has no type or definition`);
}

function scalarFromXsdType(
  xsdType: string,
  label: string,
  elementName: string,
): TypeRef {
  const base = localName(xsdType);
  const tsType = SCALAR_TYPES[base];
  if (!tsType) {
    throw new Error(
      `${label}: element "${elementName}" uses unsupported type "${xsdType}"`,
    );
  }
  return { tsType, doc: `xs:${base}` };
}

function scalarFromSimpleType(simpleType: XsdNode, label: string): TypeRef {
  assertKeys(simpleType, ['restriction'], `${label} simpleType`);
  const restriction = asNode(simpleType.restriction);
  if (!restriction) {
    throw new Error(`${label}: simpleType without restriction (unsupported)`);
  }
  assertKeys(
    restriction,
    ['@_base', ...SUPPORTED_FACETS],
    `${label} restriction`,
  );

  const baseAttr = textOf(restriction['@_base'], label) ?? '';
  const base = localName(baseAttr);
  const tsType = SCALAR_TYPES[base];
  if (!tsType) {
    throw new Error(`${label}: restriction base "${baseAttr}" is unsupported`);
  }

  const facets: string[] = [];
  const lengthBounds = [
    bound('>=', facet(restriction, 'minLength')),
    bound('<=', facet(restriction, 'maxLength')),
  ].filter(isText);
  if (lengthBounds.length) {
    facets.push(`length ${lengthBounds.join(' and ')}`);
  }

  const valueBounds = [
    bound('>=', facet(restriction, 'minInclusive')),
    bound('>', facet(restriction, 'minExclusive')),
    bound('<=', facet(restriction, 'maxInclusive')),
    bound('<', facet(restriction, 'maxExclusive')),
  ].filter(isText);
  if (valueBounds.length) {
    facets.push(`value ${valueBounds.join(' and ')}`);
  }

  const totalDigits = facet(restriction, 'totalDigits');
  if (totalDigits !== undefined) {
    const fractionDigits = facet(restriction, 'fractionDigits') ?? '0';
    facets.push(`${totalDigits} digits, ${fractionDigits} decimals`);
  }

  const pattern = facet(restriction, 'pattern');
  if (pattern !== undefined) {
    facets.push(`pattern ${pattern}`);
  }

  return { tsType, doc: [`xs:${base}`, ...facets].join(' · ') };
}

function renderFile(
  declarations: Declaration[],
  sourceLabel: string,
  sha: string,
): string {
  const out: string[] = [
    '/* eslint-disable */',
    '// AUTO-GENERATED by src/modules/siat/codegen/xsd-to-ts.ts. Do not edit by hand.',
    `// Source: ${sourceLabel} (sha256 ${sha})`,
    '// Regenerate with: npm run siat:types',
    '',
  ];

  for (const decl of declarations) {
    out.push(`export interface ${decl.name} {`);
    for (const m of decl.members) {
      if (m.doc) {
        out.push(`  /** ${m.doc} */`);
      }
      const typeExpr = m.isArray
        ? `${m.tsType}[]`
        : m.nullable
          ? `${m.tsType} | null`
          : m.tsType;
      out.push(`  ${m.name}${m.optional ? '?' : ''}: ${typeExpr};`);
    }
    out.push('}');
    out.push('');
    out.push(
      '/** Element order required by xs:sequence. Serialize in this order. */',
    );
    const order = decl.members.map((m) => `'${m.name}'`).join(', ');
    out.push(
      `export const ${snakeUpper(decl.name)}_FIELD_ORDER = [${order}] as const;`,
    );
    out.push('');
  }

  return out.join('\n');
}

/** Generated files for every target, keyed by output file name. */
export function generateAllSiatTypes(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const target of SIAT_TYPE_TARGETS) {
    const xsdText = readFileSync(
      join(SIAT_SPEC_XSD_DIR, target.xsdFile),
      'utf8',
    );
    result[target.outputFile] = generateTypesFromXsd(
      xsdText,
      `spec/v3/xsd/${target.xsdFile}`,
    );
  }
  return result;
}

/** Throws on any key not in `allowed`. Keys ending in "_" are prefixes (attributes). */
function assertKeys(node: XsdNode, allowed: string[], label: string): void {
  for (const key of Object.keys(node)) {
    const ok = allowed.some((a) =>
      a.endsWith('_') ? key.startsWith(a) : key === a,
    );
    if (!ok) {
      throw new Error(
        `${label}: unsupported XSD construct "${key.replace('@_', '@')}"`,
      );
    }
  }
}

function asNode(value: unknown): XsdNode | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as XsdNode)
    : undefined;
}

function toList(value: unknown): XsdNode[] {
  if (value === undefined) return [];
  const items = Array.isArray(value) ? (value as unknown[]) : [value];
  return items.map((item) => {
    const node = asNode(item);
    if (!node) throw new Error('unexpected non-element node in XSD');
    return node;
  });
}

/** Reads a text value (attribute or facet value). Returns undefined for missing or non-scalar values. */
function textOf(value: unknown, label?: string): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value === undefined) return undefined;
  throw new Error(`${label ?? 'XSD'}: expected a text value`);
}

function requiredText(value: unknown, label: string): string {
  const text = textOf(value, label);
  if (text === undefined) {
    throw new Error(`${label}: missing required attribute`);
  }
  return text;
}

function facet(restriction: XsdNode, name: string): string | undefined {
  return textOf(asNode(restriction[name])?.['@_value']);
}

function bound(
  operator: string,
  value: string | undefined,
): string | undefined {
  return value === undefined ? undefined : `${operator} ${value}`;
}

function isText(value: string | undefined): value is string {
  return value !== undefined;
}

function localName(qualified: string): string {
  return qualified.split(':').pop() ?? qualified;
}

function isMany(maxOccurs: string | undefined): boolean {
  return maxOccurs !== undefined && maxOccurs !== '1';
}

function fixedLiteral(value: string, tsType: string, label: string): string {
  if (tsType === 'number') {
    if (!Number.isFinite(Number(value))) {
      throw new Error(`${label}: fixed value ${value} is not numeric`);
    }
    return String(Number(value));
  }
  if (tsType === 'string') return JSON.stringify(value);
  throw new Error(`${label}: fixed values are not supported for ${tsType}`);
}

function pascal(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function snakeUpper(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
}
