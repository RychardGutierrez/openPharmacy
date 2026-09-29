import { isLocalUrl, normalizeBaseUrl } from './public-url.util';

describe('normalizeBaseUrl', () => {
  it('strips trailing slashes', () => {
    expect(normalizeBaseUrl('https://farm.example/', 'x')).toBe(
      'https://farm.example',
    );
    expect(normalizeBaseUrl('https://farm.example///', 'x')).toBe(
      'https://farm.example',
    );
  });
  it('falls back when blank or whitespace', () => {
    expect(normalizeBaseUrl('', 'http://localhost:3001')).toBe(
      'http://localhost:3001',
    );
    expect(normalizeBaseUrl('   ', 'fb')).toBe('fb');
    expect(normalizeBaseUrl(undefined, 'fb')).toBe('fb');
    expect(normalizeBaseUrl(null, 'fb')).toBe('fb');
  });
  it('trims surrounding whitespace on a real value', () => {
    expect(normalizeBaseUrl('  https://farm.example  ', 'fb')).toBe(
      'https://farm.example',
    );
  });
});

describe('isLocalUrl', () => {
  it('flags local hosts', () => {
    expect(isLocalUrl('http://localhost:3001')).toBe(true);
    expect(isLocalUrl('http://127.0.0.1:4200')).toBe(true);
    expect(isLocalUrl('http://0.0.0.0:3000')).toBe(true);
  });
  it('accepts public hosts', () => {
    expect(isLocalUrl('https://farm.example')).toBe(false);
    expect(isLocalUrl('http://192.168.1.10:3001')).toBe(false);
  });
  it('returns false for invalid URLs (never throws)', () => {
    expect(isLocalUrl('not a url')).toBe(false);
  });
});
