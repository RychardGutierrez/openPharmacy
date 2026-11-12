/**
 * Regenerates the committed SIAT TypeScript types from the pinned XSD files.
 * Run with: npm run siat:types
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SIAT_GENERATED_TYPES_DIR,
  generateAllSiatTypes,
} from '../src/modules/siat/codegen/xsd-to-ts';

mkdirSync(SIAT_GENERATED_TYPES_DIR, { recursive: true });

for (const [fileName, content] of Object.entries(generateAllSiatTypes())) {
  const target = join(SIAT_GENERATED_TYPES_DIR, fileName);
  writeFileSync(target, content, 'utf8');
  console.log(`wrote ${target}`);
}
