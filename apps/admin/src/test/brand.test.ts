/**
 * The white-label machinery.
 *
 * Two failure modes worth a test, because both are invisible until a second
 * factory goes live:
 *
 *  - a subdomain resolving to the wrong tenant (or to `admin` as if it were one)
 *  - a served theme value that is not a colour reaching a style declaration
 */

import { describe, expect, it } from 'vitest';
import {
  KNOWN_TOKENS,
  applyTheme,
  brandForTenant,
  createTheme,
  isSafeColorValue,
  mergeThemeOverrides,
  resolveTenant,
  tenantIdFromHost,
  themeOverrideFromWire,
  themeToCssVars,
  apiBaseUrlForTenant,
} from '@tfd/brand';

describe('tenantIdFromHost', () => {
  it('reads the tenant from a deployment subdomain', () => {
    expect(tenantIdFromHost('galaboda.admin.teafactory.lk')).toBe('galaboda');
    expect(tenantIdFromHost('hillcountry.admin.teafactory.lk')).toBe('hillcountry');
  });

  it('ignores infrastructure subdomains', () => {
    // `admin.teafactory.lk` is the bare deployment, not a factory called "admin".
    expect(tenantIdFromHost('admin.teafactory.lk')).toBeNull();
    expect(tenantIdFromHost('www.teafactory.lk')).toBeNull();
  });

  it('returns null for local hosts and IPs', () => {
    expect(tenantIdFromHost('localhost')).toBeNull();
    expect(tenantIdFromHost('127.0.0.1')).toBeNull();
    expect(tenantIdFromHost('192.168.1.10')).toBeNull();
  });

  it('strips a port', () => {
    expect(tenantIdFromHost('galaboda.admin.localhost:5273')).toBe('galaboda');
  });
});

describe('resolveTenant', () => {
  it('honours ?tenant= only when overrides are allowed', () => {
    expect(
      resolveTenant({ host: 'localhost', search: '?tenant=highland', allowOverride: true }),
    ).toEqual({ tenantId: 'highland', source: 'override' });

    // In production the URL bar must not be a tenant-switch primitive.
    expect(
      resolveTenant({ host: 'localhost', search: '?tenant=highland', allowOverride: false }),
    ).toEqual({ tenantId: 'base', source: 'fallback' });
  });

  it('prefers the override over the subdomain in development', () => {
    expect(
      resolveTenant({
        host: 'galaboda.admin.localhost',
        search: '?tenant=highland',
        allowOverride: true,
      }).tenantId,
    ).toBe('highland');
  });

  it('rejects a malformed override', () => {
    expect(
      resolveTenant({ host: 'localhost', search: '?tenant=../etc', allowOverride: true }).source,
    ).toBe('fallback');
  });
});

describe('apiBaseUrlForTenant', () => {
  it('substitutes the placeholder when one is present', () => {
    expect(apiBaseUrlForTenant('https://{tenant}.api.teafactory.lk/v1', 'galaboda')).toBe(
      'https://galaboda.api.teafactory.lk/v1',
    );
  });

  it('leaves a fixed origin alone', () => {
    expect(apiBaseUrlForTenant('https://api.teafactory.lk/v1', 'galaboda')).toBe(
      'https://api.teafactory.lk/v1',
    );
  });
});

describe('brandForTenant', () => {
  it('returns the neutral base for an unknown tenant', () => {
    // Not another factory's colours: a clerk pointed at the wrong deployment must
    // be able to tell.
    expect(brandForTenant('nope').tenantId).toBe('base');
    expect(brandForTenant(null).theme).toEqual({});
  });
});

describe('themeToCssVars', () => {
  const theme = createTheme('light', brandForTenant('galaboda').theme);
  const vars = themeToCssVars(theme);

  it('kebab-cases token names', () => {
    expect(vars['--brand-color-primary-contrast']).toBeDefined();
    expect(vars['--brand-color-table-row-hover']).toBeDefined();
  });

  it('turns dp into px — the one place that translation happens', () => {
    expect(vars['--brand-space-lg']).toBe('16px');
    expect(vars['--brand-radius-md']).toBe('10px');
    expect(vars['--brand-icon-md']).toBe('20px');
  });

  it('emits a complete typography variant', () => {
    expect(vars['--brand-font-size-data-cell']).toBe('13px');
    expect(vars['--brand-line-height-data-cell']).toBe('18px');
    expect(vars['--brand-font-weight-data-cell']).toBe('400');
  });

  it('applies the tenant override over the base palette', () => {
    expect(vars['--brand-color-primary']).toBe('#2E8B57');
  });
});

describe('applyTheme', () => {
  it('writes the properties onto the element', () => {
    const element = document.createElement('div');
    const written = applyTheme(element, createTheme('light'));
    expect(written.length).toBeGreaterThan(50);
    expect(element.style.getPropertyValue('--brand-color-primary')).toBe('#128C7E');
    expect(element.dataset.scheme).toBe('light');
  });
});

describe('isSafeColorValue', () => {
  it('accepts the shapes a factory would enter', () => {
    for (const value of ['#fff', '#128C7E', 'rgb(1, 2, 3)', 'hsl(200 50% 40%)', 'transparent']) {
      expect(isSafeColorValue(value)).toBe(true);
    }
  });

  it('rejects anything that could break out of a declaration', () => {
    // Served theme values are factory-authored content, so they are validated the
    // same way the app validates a promo banner's action URL.
    for (const value of ['red; background: url(x)', 'url(javascript:alert(1))', '}', '']) {
      expect(isSafeColorValue(value)).toBe(false);
    }
  });
});

describe('themeOverrideFromWire', () => {
  it('drops token names this build does not know', () => {
    const result = themeOverrideFromWire(
      { colors: { light: { primary: '#123456', notAToken: '#ffffff' } } },
      KNOWN_TOKENS,
    );
    expect(result.colors?.light).toEqual({ primary: '#123456' });
  });

  it('drops unsafe values but keeps the safe ones alongside', () => {
    const result = themeOverrideFromWire(
      { colors: { light: { primary: '#123456', secondary: 'red; }' } } },
      KNOWN_TOKENS,
    );
    expect(result.colors?.light).toEqual({ primary: '#123456' });
  });

  it('drops out-of-range scale values', () => {
    const result = themeOverrideFromWire({ radius: { md: -4, lg: 18 } }, KNOWN_TOKENS);
    expect(result.radius).toEqual({ lg: 18 });
  });
});

describe('mergeThemeOverrides', () => {
  it('lets a served value win per token without resetting the rest', () => {
    // The M14 case: the office changes only `primary`, and the bundled palette's
    // `secondary` must survive.
    const merged = mergeThemeOverrides(
      { colors: { light: { primary: '#111111', secondary: '#222222' } } },
      { colors: { light: { primary: '#333333' } } },
    );
    expect(merged.colors?.light).toEqual({ primary: '#333333', secondary: '#222222' });
  });
});
