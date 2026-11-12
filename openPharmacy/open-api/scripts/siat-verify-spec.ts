/**
 * Checks the pinned SIAT spec files against the hashes in spec/v3/SOURCES.md.
 * Fails if a file changed, is missing, or is not listed. Run with: npm run siat:verify-spec
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { SIAT_SPEC_V3_DIR } from '../src/modules/siat/xml/siat-xsd-validator';

const SOURCES_FILE = 'SOURCES.md';
const ROW = /^\|\s*`([^`]+)`\s*\|.*`([0-9a-f]{64})`/;

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

const listed = new Map<string, string>();
for (const line of readFileSync(
  join(SIAT_SPEC_V3_DIR, SOURCES_FILE),
  'utf8',
).split(/\r?\n/)) {
  const match = ROW.exec(line);
  if (match) listed.set(match[1].split('/').join(sep), match[2]);
}

const problems: string[] = [];
for (const [path, expected] of listed) {
  const full = join(SIAT_SPEC_V3_DIR, path);
  let actual: string;
  try {
    actual = createHash('sha256').update(readFileSync(full)).digest('hex');
  } catch {
    problems.push(`missing: ${path}`);
    continue;
  }
  if (actual !== expected) problems.push(`changed: ${path}`);
}

for (const file of listFiles(SIAT_SPEC_V3_DIR)) {
  const rel = relative(SIAT_SPEC_V3_DIR, file);
  if (rel === SOURCES_FILE) continue;
  if (!listed.has(rel)) problems.push(`not listed in ${SOURCES_FILE}: ${rel}`);
}

if (problems.length) {
  console.error(problems.map((p) => `  - ${p}`).join('\n'));
  console.error(
    `SIAT spec verification failed (${problems.length} problem(s)).`,
  );
  process.exit(1);
}
console.log(`SIAT spec verified: ${listed.size} files match ${SOURCES_FILE}.`);
