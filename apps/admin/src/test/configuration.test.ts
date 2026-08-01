/**
 * M14 against the mock API — and **AC-12**.
 *
 * The criterion is *"a new factory goes live without a code deploy"*, and white-label.md
 * says a new factory is a DNS record and a `client_config` row. So the first test here is
 * the criterion itself: every block of that row must be editable through this screen. A
 * module that covered the convenient fields and left one requiring a developer would make
 * AC-12 false while looking finished.
 *
 * The rest is about the thing that makes a config screen dangerous: **its edits reach
 * across every other module, and the person making them cannot see any of them from here.**
 * So the refusals are the interesting part, and the line they draw is money —
 *
 *  - turning off a feature that is holding a **liability** is refused (`flag-has-records`),
 *    because a savings balance disappearing from the only screen that reports it is not a
 *    preference the factory gets to express;
 *  - turning off a feature that merely shows something is allowed and warned about;
 *  - removing a collection point with leaf filed against it is refused (`point-in-use`),
 *    because a delivery names its point and nothing else.
 *
 * And one property that is easy to get wrong and invisible when you do: a saved config has
 * to reach the **public** `GET /config`, which is what the whole console is branded and
 * gated from. A form that saved into a private copy would look identical and change nothing.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { configImpact, type ConfigPatch } from '@tfd/domain';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { isApiError } from '@/services/api/errors';
import { auditRepository } from '@/services/repositories/auditRepository';
import { useAuthStore } from '@/auth/authStore';
import { tenantId } from '@/config/tenant';
import { signInAs, signInWithMfaAs, signOut } from './render';

const ADMIN = 'factoryadmin@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const CLERK = 'clerk@galabodatea.lk';

describe('M14 configuration', () => {
  beforeEach(() => {
    signOut();
  });

  it('exposes every block of the client_config row (AC-12)', async () => {
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();

    /**
     * The criterion, as a list. If a block appears in `RuntimeConfig` and not here, a
     * factory needs a developer for it and AC-12 is false.
     */
    for (const block of [
      'factory',
      'flags',
      'savings',
      'banks',
      'localization',
      'branding',
      'collectionPoints',
    ] as const) {
      expect(config[block], `${block} is not served to the configuration screen`).toBeDefined();
    }
    // And the usage counts the screen judges a change against.
    expect(usage.deliveriesByPoint).toBeDefined();
    expect(usage.suppliersByBank).toBeDefined();
    expect(usage.savingsBalances).toBeGreaterThan(0);
  });

  it('saves a section and leaves the others alone', async () => {
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();

    const saved = await adminConfigRepository.patch(
      { factory: { ...config.factory, telephone: '041-9999999' } },
      config,
      usage,
    );

    expect(saved.config.factory.telephone).toBe('041-9999999');
    // A `PATCH` of one section, so nothing else moved — the failure a whole-row `PUT`
    // produces when two administrators edit different sections.
    expect(saved.config.flags).toEqual(config.flags);
    expect(saved.config.banks).toEqual(config.banks);
    expect(saved.config.collectionPoints).toEqual(config.collectionPoints);
  }, 20_000);

  /**
   * The load-bearing assertion of the module: a saved flag must reach the **public**
   * `GET /config`, because that is what `RuntimeConfigProvider` reads and therefore what
   * makes the News row leave the sidebar and `/news` answer `feature-disabled`. A save that
   * only changed the authenticated copy would be a form that appears to work and gates
   * nothing.
   *
   * Driven with `fetch` against `galaboda` rather than through the repositories, and the
   * reason is worth recording: the axios client pins `X-Tenant` to the tenant resolved once
   * at module load, and under jsdom — whose hostname carries no subdomain — that is
   * `env.defaultTenant`, which has no fixture. So `configRepository.get()` is *always*
   * degraded in Vitest. Asserting through it would have been asserting the test environment.
   */
  it('reaches the public config, which is what the console is gated from', async () => {
    await signInAs(ADMIN);
    const token = useAuthStore.getState().accessToken;
    const headers = { Authorization: `Bearer ${token}`, 'X-Tenant': 'galaboda' };

    const before = await (await fetch('http://localhost/config', { headers })).json();
    expect(before.flags.enableNews).toBe(true);

    const saved = await fetch('http://localhost/admin/config', {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ flags: { enableNews: false } }),
    });
    expect(saved.status).toBe(200);

    const after = await (await fetch('http://localhost/config', { headers })).json();
    expect(after.flags.enableNews).toBe(false);
    // And the row still says which factory it belongs to — see `tenantConfig`.
    expect(after.tenantId).toBe('galaboda');
  }, 20_000);

  /**
   * **AC-07's second half, through the console rather than through a fixture.**
   *
   * The criterion is that a flag off removes the surface *and* the endpoint refuses. Until
   * now the endpoint half could only be asserted where some fixture tenant happened to have
   * a flag off — which is why status.md carried "`enableInquiry` has no off-tenant" as a gap.
   * With M14 the off-tenant is made rather than found.
   *
   * This test failed when it was written: the mock's `flagsOf` read the **seed**, so a flag
   * saved through M14 removed the sidebar row and the route while every endpoint behind them
   * went on answering. A console that hides a surface whose API still serves it is the exact
   * shape of the problem AC-07 is written about.
   */
  it('turns a flag off through this screen and the endpoint behind it refuses (AC-07)', async () => {
    /**
     * The clerk's session, taken **before** the flag changes and replayed after it.
     *
     * Two things at once: `inquiries` is the clerk's capability and not the administrator's
     * (§12.1), so this is the flag applying to somebody else's session rather than to the
     * person who changed it; and a token issued while the feature was on is exactly how a
     * replayed request or a hand-typed URL would arrive.
     */
    await signInAs(CLERK);
    const clerkToken = useAuthStore.getState().accessToken;
    // Explicit, because under Vitest the resolved tenant is `base` — the console's own
    // requests would not be answered from galaboda's row.
    const asClerk = { Authorization: `Bearer ${clerkToken}`, 'X-Tenant': 'galaboda' };

    // `enableInquiry` is on for every fixture tenant, which is what made this unassertable.
    expect((await fetch('http://localhost/admin/inquiries', { headers: asClerk })).status).toBe(200);

    signOut();
    await signInAs(ADMIN);
    const saved = await fetch('http://localhost/admin/config', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
        'X-Tenant': 'galaboda',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ flags: { enableInquiry: false } }),
    });
    expect(saved.status).toBe(200);

    const closed = await fetch('http://localhost/admin/inquiries', { headers: asClerk });
    expect(closed.status).toBe(403);
    expect(await closed.json()).toMatchObject({ code: 'feature-disabled' });
  }, 20_000);

  /**
   * The other consequence that has to actually arrive: **a language dropped here changes what
   * counts as a gap** (AC-08).
   *
   * M14 warns that dropping a language means "nothing will tell you it is out of date". That
   * warning is only true if the server stops counting it — and the same seed-versus-state bug
   * meant it went on counting Tamil as missing for a factory that no longer authored in it,
   * which is an office being told it has unfinished work it does not have.
   */
  it('stops counting a dropped language as a gap, which is what its warning promised', async () => {
    await signInAs(ADMIN);
    const token = useAuthStore.getState().accessToken;
    const headers = { Authorization: `Bearer ${token}`, 'X-Tenant': 'galaboda' };

    const countTamil = async () => {
      const page = await (await fetch('http://localhost/admin/news', { headers })).json();
      return page.items.filter((item: { missingLanguages: string[] }) =>
        item.missingLanguages.includes('ta'),
      ).length;
    };

    expect(await countTamil()).toBeGreaterThan(0);

    await fetch('http://localhost/admin/config', {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localization: { contentLanguages: ['en', 'si'] } }),
    });

    // Not a gap any more. The copy is untouched — it stops being *counted*, which is
    // precisely what the impact list said would happen.
    expect(await countTamil()).toBe(0);
  }, 20_000);

  it('refuses to hide a savings balance (flag-has-records)', async () => {
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();

    // The fixture holds balances for most suppliers, so this is the real case.
    expect(usage.savingsBalances).toBeGreaterThan(0);

    /**
     * Refused, and refused **on the client too** — the repository runs the same
     * `configImpact` the server does, so the editor is told before a round trip and the two
     * can never disagree about which change is the problem.
     */
    await expect(
      adminConfigRepository.patch({ flags: { enableSavings: false } }, config, usage),
    ).rejects.toMatchObject({ code: 'flag-has-records' });

    // And by the server, for a request that skipped the repository.
    const token = useAuthStore.getState().accessToken;
    const response = await fetch('http://localhost/admin/config', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant': tenantId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ flags: { enableSavings: false } }),
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { code: string; details: { impacts: unknown[] } };
    expect(body.code).toBe('flag-has-records');
    // The figure travels with the refusal: "that is not allowed" is a support ticket.
    expect(body.details.impacts.length).toBeGreaterThan(0);
  }, 20_000);

  it('allows turning off a feature that only shows something, and says what goes', async () => {
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();

    const impacts = adminConfigRepository.impactOf(
      { flags: { enableNews: false } },
      config,
      usage,
    );
    // A warning, not a block — a factory that has stopped running a news feed is entitled
    // to say so, and the console tells them the surface disappears end to end (AC-07).
    expect(impacts).toHaveLength(1);
    expect(impacts[0]).toMatchObject({ severity: 'warns', field: 'flags.enableNews' });

    await expect(
      adminConfigRepository.patch({ flags: { enableNews: false } }, config, usage),
    ).resolves.toBeTruthy();
  }, 20_000);

  it('refuses to remove a collection point with leaf filed against it', async () => {
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();

    const inUse = config.collectionPoints.find(
      (point) => (usage.deliveriesByPoint[point.name] ?? 0) > 0,
    )!;
    expect(inUse).toBeTruthy();

    await expect(
      adminConfigRepository.patch(
        { collectionPoints: config.collectionPoints.filter((point) => point.id !== inUse.id) },
        config,
        usage,
      ),
    ).rejects.toMatchObject({ code: 'point-in-use' });

    // Adding one is never a problem: a point with no leaf yet is how a new shed opens.
    await expect(
      adminConfigRepository.patch(
        { collectionPoints: [...config.collectionPoints, { id: 'cp-new', name: 'KAMBURUPITIYA' }] },
        config,
        usage,
      ),
    ).resolves.toBeTruthy();
  }, 20_000);

  it('refuses to drop the fallback language, and warns about the others', async () => {
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();

    // Every content fallback resolves to English (AC-08), so a record without it has
    // nothing to show anybody.
    await expect(
      adminConfigRepository.patch(
        { localization: { contentLanguages: ['si', 'ta'] } },
        config,
        usage,
      ),
    ).rejects.toMatchObject({ code: 'fallback-language-required' });

    // Dropping Tamil is allowed, and the warning names how much copy stops being counted.
    const impacts = adminConfigRepository.impactOf(
      { localization: { contentLanguages: ['si', 'en'] } },
      config,
      usage,
    );
    expect(impacts.every((impact) => impact.severity === 'warns')).toBe(true);
    expect(impacts.some((impact) => impact.messageKey.includes('languageDropped'))).toBe(true);
  }, 20_000);

  it('refuses an edit to the tenant id', async () => {
    await signInAs(ADMIN);
    const token = useAuthStore.getState().accessToken;

    /**
     * The subdomain is the authority (`config/tenant.ts`) and everything else is keyed on
     * it, so an editable copy would be a second source of truth for the one value that
     * decides whose records are served.
     */
    const response = await fetch('http://localhost/admin/config', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Tenant': tenantId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenantId: 'somebody-else' }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'tenant-immutable' });
  });

  it('audits a save with only the sections that changed', async () => {
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();
    await adminConfigRepository.patch({ factory: { ...config.factory, location: 'Matara' } }, config, usage);

    signOut();
    await signInWithMfaAs(MANAGER);
    const trail = await auditRepository.forEntity('config', config.tenantId);
    const entry = trail.items.find((one) => one.action === 'config.update');

    expect(entry).toBeTruthy();
    /**
     * Only the edited section, because a config row is large and an entry carrying the
     * whole thing on every save is an entry nobody reads — which defeats AC-09 for the one
     * record whose edits reach across every module.
     */
    expect(Object.keys(entry!.after as object)).toEqual(['factory']);
    expect((entry!.after as { factory: { location: string } }).factory.location).toBe('Matara');
  }, 20_000);

  it('lets a manager read the configuration and not change it (§12.1)', async () => {
    await signInWithMfaAs(MANAGER);
    const { config, usage } = await adminConfigRepository.get();
    /**
     * Asserted against the resolved tenant rather than a literal. Vitest runs in jsdom,
     * whose hostname carries no subdomain, so the tenant falls back to `env.defaultTenant`
     * — and a test hard-coding `galaboda` would be asserting the fixture rather than the
     * resolution.
     */
    expect(config.tenantId).toBe(tenantId);

    // §12.1 gives the manager `flagsAndBranding: R`. Reading is theirs; changing is not.
    const refused = await adminConfigRepository
      .patch({ factory: { ...config.factory, location: 'Nowhere' } }, config, usage)
      .catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
    expect(isApiError(refused) && refused.status).toBe(403);
  });

  it('gives a clerk read access and nothing more (§12.1)', async () => {
    await signInAs(CLERK);
    // `flagsAndBranding: R` — a clerk can see how the factory is set up.
    await expect(adminConfigRepository.get()).resolves.toBeTruthy();
  });
});

describe('configImpact (the shared rule)', () => {
  const base = {
    flags: {
      enableSavings: true,
      enableAdvances: true,
      enableLoans: true,
      enableManure: true,
      enableInquiry: true,
      enableNews: true,
      enablePushNotifications: true,
      enablePromoBanner: true,
      enablePayouts: true,
      enableReports: true,
    },
    collectionPoints: [{ name: 'MAKADURA' }],
    banks: [{ name: 'Bank of Ceylon' }],
    contentLanguages: ['si', 'en', 'ta'] as const,
  };
  const empty = {
    savingsBalances: 0,
    openPayoutRuns: 0,
    outstandingCredit: { advance: 0, loan: 0, manure: 0 },
    deliveriesByPoint: {},
    suppliersByBank: {},
    contentByLanguage: {},
  };

  it('says nothing about turning a feature on', () => {
    // Only a turn-**off** costs anything. Turning a flag on reveals a surface with no data
    // in it, which is the normal way a factory buys a module.
    const impacts = configImpact(
      { flags: { enableNews: true } },
      { ...base, contentLanguages: [...base.contentLanguages] },
      empty,
    );
    expect(impacts).toEqual([]);
  });

  it('does not block a money flag when there is no money', () => {
    const impacts = configImpact(
      { flags: { enableSavings: false } },
      { ...base, contentLanguages: [...base.contentLanguages] },
      empty,
    );
    // A factory with no balances may close the scheme. The rule is about records, not
    // about the feature being important.
    expect(impacts.every((impact) => impact.severity === 'warns')).toBe(true);
  });

  it('sorts blocks before warnings', () => {
    const patch: ConfigPatch = {
      flags: { enableNews: false, enableSavings: false },
    };
    const impacts = configImpact(
      patch,
      { ...base, contentLanguages: [...base.contentLanguages] },
      { ...empty, savingsBalances: 9 },
    );
    // The reader has to fix the block before the warning matters, so it comes first.
    expect(impacts[0]?.severity).toBe('blocks');
    expect(impacts.at(-1)?.severity).toBe('warns');
  });
});
