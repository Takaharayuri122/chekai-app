import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('proteção da tela de consentimento', () => {
  it('impede iframe e cache da autorização OAuth', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8');

    expect(config).toContain("source: '/oauth/autorizar'");
    expect(config).toContain("{ key: 'X-Frame-Options', value: 'DENY' }");
    expect(config).toContain(`{ key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }`);
    expect(config).toContain("{ key: 'Cache-Control', value: 'no-store' }");
  });
});
