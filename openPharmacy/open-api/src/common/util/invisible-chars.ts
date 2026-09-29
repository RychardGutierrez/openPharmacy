/**
 * Unicode "invisible"/format characters that sneak into values via copy-paste
 * (soft hyphen, zero-width space/joiner, word-joiner, BOM, and the BOM-like
 * U+FE00 block). None of them are ever legitimate in the identifiers we sanitize
 * (IANA timezones, base URLs), so removing them avoids cryptic validation errors.
 */
const INVISIBLE_CODE_POINTS = new Set([
  0x00ad, // SOFT HYPHEN
  0x200b, // ZERO WIDTH SPACE
  0x200c, // ZERO WIDTH NON-JOINER
  0x200d, // ZERO WIDTH JOINER
  0x2060, // WORD JOINER
  0xfeff, // ZERO WIDTH NO-BREAK SPACE / BOM
]);

/** Removes invisible formatting characters and trims surrounding whitespace. */
export function stripInvisible(value: string): string {
  let out = '';
  for (const char of value) {
    const cp = char.codePointAt(0);
    if (cp === undefined || !INVISIBLE_CODE_POINTS.has(cp)) out += char;
  }
  return out.trim();
}
