import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..'); // apps/web/src

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });
}
const prod = walk(SRC).filter((f) => !/\.test\.(ts|tsx)$/.test(f));

const FORBIDDEN =
  /TRADING_PLATFORM_READ_URL|TRADING_PLATFORM_READ_TOKEN|TRADING_PLATFORM_REQUEST_TIMEOUT_MS|OFFICE_PLATFORM_ENABLED/;

describe('web layer never references platform secrets/config', () => {
  it.each(prod)('%s has no platform env references', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(FORBIDDEN);
  });
});
