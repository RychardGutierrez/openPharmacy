import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateXML } from 'xmllint-wasm';

/** Pinned V3 spec copies (see spec/v3/SOURCES.md). */
export const SIAT_SPEC_V3_DIR = join(__dirname, '..', 'spec', 'v3');
export const SIAT_XSD_DIR = join(SIAT_SPEC_V3_DIR, 'xsd');

/** The only schemas the validator can load. A union keeps file names out of user input. */
export type SiatXsdName =
  | 'facturaComputarizadaCompraVenta.xsd'
  | 'notaComputarizadaCreditoDebito.xsd';

export interface XmlValidationIssue {
  line: number | null;
  message: string;
}

export interface XmlValidationResult {
  valid: boolean;
  issues: XmlValidationIssue[];
}

/**
 * Validates SIAT XML documents against the pinned XSD files before they are sent.
 * It makes no network calls. Schema files are read once and cached.
 */
@Injectable()
export class SiatXsdValidator {
  private readonly schemaCache = new Map<SiatXsdName, Promise<string>>();

  async validate(
    xml: string,
    xsd: SiatXsdName,
    fileName = 'document.xml',
  ): Promise<XmlValidationResult> {
    const schema = await this.loadSchema(xsd);
    const result = await validateXML({
      xml: [{ fileName, contents: xml }],
      schema: [schema],
    });

    return {
      valid: result.valid,
      issues: result.errors.map((error) => ({
        line: error.loc?.lineNumber ?? null,
        message: error.message,
      })),
    };
  }

  private loadSchema(xsd: SiatXsdName): Promise<string> {
    let schema = this.schemaCache.get(xsd);
    if (!schema) {
      schema = readFile(join(SIAT_XSD_DIR, xsd), 'utf8');
      // Do not keep a failed read in the cache, so a later call can retry.
      schema.catch(() => this.schemaCache.delete(xsd));
      this.schemaCache.set(xsd, schema);
    }
    return schema;
  }
}
