import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SIAT_GENERATED_TYPES_DIR,
  SIAT_TYPE_TARGETS,
  generateAllSiatTypes,
  generateTypesFromXsd,
} from './xsd-to-ts';

/** Wraps element declarations in a minimal schema with one root element. */
function schemaWith(elements: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="root"><xs:complexType><xs:sequence>${elements}</xs:sequence></xs:complexType></xs:element>
</xs:schema>`;
}

describe('xsd-to-ts generator', () => {
  describe('committed output', () => {
    it('matches the pinned XSD (run "npm run siat:types" if this fails)', () => {
      const generated = generateAllSiatTypes();

      for (const target of SIAT_TYPE_TARGETS) {
        const committed = readFileSync(
          join(SIAT_GENERATED_TYPES_DIR, target.outputFile),
          'utf8',
        );
        expect(committed).toBe(generated[target.outputFile]);
      }
    });
  });

  describe('mapping', () => {
    it('maps optional and nillable elements to "?" and "| null"', () => {
      const out = generateTypesFromXsd(
        schemaWith(
          '<xs:element name="a" type="xs:string" minOccurs="0" nillable="true"/>',
        ),
        'test',
      );

      expect(out).toContain('a?: string | null;');
    });

    it('maps repeated elements to arrays', () => {
      const out = generateTypesFromXsd(
        schemaWith(
          '<xs:element name="b" type="xs:integer" maxOccurs="unbounded"/>',
        ),
        'test',
      );

      expect(out).toContain('b: number[];');
    });

    it('maps a fixed value to a literal type', () => {
      const out = generateTypesFromXsd(
        schemaWith('<xs:element name="c" type="xs:integer" fixed="1"/>'),
        'test',
      );

      expect(out).toContain('c: 1;');
    });

    it('emits the xs:sequence order as a constant', () => {
      const out = generateTypesFromXsd(
        schemaWith(
          '<xs:element name="x" type="xs:string"/><xs:element name="y" type="xs:string"/>',
        ),
        'test',
      );

      expect(out).toContain(
        "export const ROOT_FIELD_ORDER = ['x', 'y'] as const;",
      );
    });

    it('documents facets in the JSDoc', () => {
      const out = generateTypesFromXsd(
        `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="root"><xs:complexType><xs:sequence>
    <xs:element name="m">
      <xs:simpleType><xs:restriction base="xs:decimal">
        <xs:minExclusive value="0"/><xs:totalDigits value="19"/><xs:fractionDigits value="2"/>
      </xs:restriction></xs:simpleType>
    </xs:element>
  </xs:sequence></xs:complexType></xs:element>
</xs:schema>`,
        'test',
      );

      expect(out).toContain(
        '/** xs:decimal · value > 0 · 19 digits, 2 decimals */',
      );
      expect(out).toContain('m: number;');
    });
  });

  describe('fails loudly on unsupported constructs', () => {
    it('rejects xs:choice', () => {
      const xsd = schemaWith(
        '<xs:choice><xs:element name="a" type="xs:string"/></xs:choice>',
      );

      expect(() => generateTypesFromXsd(xsd, 'test')).toThrow(
        'unsupported XSD construct "choice"',
      );
    });

    it('rejects enumerations, which are not yet generated', () => {
      const xsd =
        schemaWith(`<xs:element name="e"><xs:simpleType><xs:restriction base="xs:string">
        <xs:enumeration value="A"/></xs:restriction></xs:simpleType></xs:element>`);

      expect(() => generateTypesFromXsd(xsd, 'test')).toThrow(
        'unsupported XSD construct "enumeration"',
      );
    });

    it('rejects references to named types', () => {
      const xsd = schemaWith('<xs:element name="n" type="tns:Named"/>');

      expect(() => generateTypesFromXsd(xsd, 'test')).toThrow(
        'unsupported type "tns:Named"',
      );
    });

    it('rejects a schema with more than one root element', () => {
      const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="one" type="xs:string"/>
  <xs:element name="two" type="xs:string"/>
</xs:schema>`;

      expect(() => generateTypesFromXsd(xsd, 'test')).toThrow(
        'expected one root element, found 2',
      );
    });
  });
});
