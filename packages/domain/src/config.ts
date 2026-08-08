/**
 * M14 Configuration — the shared half.
 *
 * **This module is AC-12**: *"a new factory goes live without a code deploy."*
 * white-label.md puts it plainly — a new factory is a DNS record and a `client_config`
 * row — and M14 is the screen that edits that row. So the test of this module is not
 * whether it has a form for every field; it is whether the *last* field a factory needs is
 * in it. A single value that still requires a developer makes AC-12 false.
 *
 * The interesting logic is not the editing. It is **what a change costs**, because a
 * config row is the one record in the console whose edits reach across every other module:
 *
 *  - Turning a feature flag off removes a surface end to end (AC-07) — including surfaces
 *    that are holding money the factory owes suppliers.
 *  - Removing a collection point orphans delivery rows that reference it by name.
 *  - Removing a content language stops M11/M12 counting it as a gap, which silently
 *    changes what AC-08 reports.
 *
 * `configImpact` is where those are worked out, and it is shared so the console can warn
 * with the same numbers the API refuses with. A warning the server disagrees with is worse
 * than no warning: the office learns the screen is guessing.
 */

import type { FeatureFlagName, FeatureFlagSet } from './types/admin';
import type { LanguageCode } from './constants';
import type { ManureProduct } from './deductionRates';
import {
  BANK_ONLY_FIELDS,
  payoutTemplateProblems,
  type PayoutExportTemplate,
} from './payoutExport';
import { teaPacketPolicyProblems, type TeaPacketPolicy } from './teaPackets';

/**
 * What the office may change. `tenantId` is **not** here, and that is deliberate: it is
 * resolved from the subdomain (`config/tenant.ts`), so an editable copy would be a second
 * source of truth for the one value everything else is keyed on.
 */
export interface ConfigPatch {
  factory?: {
    name?: string;
    telephone?: string;
    regNo?: string;
    location?: string;
    supportEmail?: string;
    supportHours?: string;
    legalFooter?: string;
  };
  flags?: Partial<FeatureFlagSet>;
  savings?: { perKgOptions: number[]; withdrawalMonth?: number; annualInterestRate?: number };
  /** The fertilizer catalogue with bag sizes and prices (§21.10). */
  manureProducts?: ManureProduct[];
  /** What a packet of made tea is and what it costs (`enableTeaPackets`). */
  teaPackets?: TeaPacketPolicy;
  banks?: Array<{ name: string; branches: string[] }>;
  localization?: {
    defaultLanguage?: LanguageCode;
    supportedLanguages?: LanguageCode[];
    contentLanguages?: LanguageCode[];
  };
  branding?: { logoUrl?: string; logoDarkUrl?: string; faviconUrl?: string };
  theme?: { colors?: { light?: Record<string, string>; dark?: Record<string, string> } };
  push?: { topicPrefix?: string; categories?: string[]; defaultCategories?: string[] };
  /** M6's file layout — §21.17 as configuration. See `payoutExport.ts`. */
  payouts?: { export: PayoutExportTemplate };
  collectionPoints?: Array<{ id: string; name: string }>;
}

/** The counts a config change has to be judged against. Supplied by the server. */
export interface ConfigUsage {
  /** Suppliers holding a non-zero savings balance. */
  savingsBalances: number;
  /**
   * Payout runs that are not `completed`.
   *
   * v2 keeps the field and drops the flag it guarded: payouts are the factory's own
   * console now, but the count is still supplied by the same `GET /config/usage` and
   * removing it from the type would fork the payload. See `MONEY_BEARING_FLAGS`.
   */
  openPayoutRuns: number;
  /** Outstanding balance per credit facility. */
  outstandingCredit: { advance: number; loan: number; manure: number };
  /**
   * LKR of tea packets issued and not yet recovered on a `deductions.tea` line.
   *
   * Its own field rather than a fourth key on `outstandingCredit`, because that record is
   * `CreditFacility`-shaped and tea packets are deliberately not a facility — see
   * `AdminTeaPacketRequest`.
   */
  teaPacketsOutstanding: number;
  /** Delivery rows per collection point name. */
  deliveriesByPoint: Record<string, number>;
  /** Suppliers whose bank details name each bank. */
  suppliersByBank: Record<string, number>;
  /** Content records with copy written in each language. */
  contentByLanguage: Partial<Record<LanguageCode, number>>;
}

/**
 * Flags whose data is **money the factory owes**, and the count that proves it.
 *
 * The distinction this table draws is the module's one real judgement. Turning off
 * `enableNews` hides a feed; turning off `enableSavings` hides balances the factory is
 * holding on suppliers' behalf, and a supplier asking for their passbook would be told the
 * factory does not run a savings scheme. The first is a preference. The second is a
 * liability disappearing from the only screen that reports it.
 *
 * So these are **refused while the records exist**, and every other flag is merely
 * warned about. Content can be turned off and back on; money cannot be un-owed.
 */
export const MONEY_BEARING_FLAGS: Partial<Record<FeatureFlagName, keyof ConfigUsage | 'credit'>> = {
  enableSavings: 'savingsBalances',
  enableAdvances: 'credit',
  enableLoans: 'credit',
  enableManure: 'credit',
  /**
   * Packets issued and not yet recovered. The same argument as the three above: the
   * supplier has the tea, the factory has not been paid for it, and a flag that hid the
   * queue would hide the debt with it.
   */
  enableTeaPackets: 'teaPacketsOutstanding',

  /* v1, kept for reference. `enablePayouts` no longer exists — M6 is the factory's own
   * console in v2 — so `openPayoutRuns` above guards nothing here any more:
   *
   *   enablePayouts: 'openPayoutRuns',
   */
};

export type ConfigImpactSeverity = 'blocks' | 'warns';

/**
 * One consequence of a proposed change, as a key and its parameters.
 *
 * A key rather than a sentence because the console localizes (BR-110) and this is shared
 * with an API that has no string table — the same shape `describeAudience` uses.
 */
export interface ConfigImpact {
  severity: ConfigImpactSeverity;
  /** i18n key. */
  messageKey: string;
  params: Record<string, string | number>;
  /** The field the reader has to go and change. */
  field: string;
}

const facilityFlag: Partial<Record<FeatureFlagName, 'advance' | 'loan' | 'manure'>> = {
  enableAdvances: 'advance',
  enableLoans: 'loan',
  enableManure: 'manure',
};

/**
 * Everything a patch would break or change, worst first.
 *
 * Returns **both** blocks and warnings from one pass, so a caller never has to ask twice
 * and can never show a warning while the server is about to refuse on something else.
 * `blocks` is what makes the save impossible; `warns` is what the office should read
 * before choosing to.
 */
export function configImpact(
  patch: ConfigPatch,
  current: { flags: FeatureFlagSet; collectionPoints: Array<{ name: string }>; banks: Array<{ name: string }>; contentLanguages: LanguageCode[] },
  usage: ConfigUsage,
): ConfigImpact[] {
  const out: ConfigImpact[] = [];

  /* ── Feature flags being turned off ────────────────────────────────────── */
  for (const [name, value] of Object.entries(patch.flags ?? {}) as Array<
    [FeatureFlagName, boolean]
  >) {
    // Only a turn-**off** costs anything. Turning a flag on reveals a surface with no data
    // in it, which is the normal way a factory buys a module.
    if (value !== false || current.flags[name] === false) continue;

    const money = MONEY_BEARING_FLAGS[name];
    if (money === 'credit') {
      const facility = facilityFlag[name]!;
      const outstanding = usage.outstandingCredit[facility];
      if (outstanding > 0) {
        out.push({
          severity: 'blocks',
          messageKey: 'config.impact.creditOutstanding',
          params: { amount: outstanding, facility },
          field: `flags.${name}`,
        });
      }
      continue;
    }
    if (money) {
      const count = usage[money] as number;
      if (count > 0) {
        /**
         * A key per source, not a default. `count` means a different thing in each — 23
         * suppliers, LKR 41,200 of tea — and one shared sentence would have to be vague
         * enough to cover both, which is the opposite of what this message is for.
         */
        const messageKey =
          money === 'savingsBalances'
            ? 'config.impact.savingsHeld'
            : money === 'teaPacketsOutstanding'
              ? 'config.impact.teaPacketsOutstanding'
              : 'config.impact.payoutRunsOpen';
        out.push({
          severity: 'blocks',
          messageKey,
          params: { count },
          field: `flags.${name}`,
        });
      }
      continue;
    }

    // Everything else: a surface disappears end to end (AC-07). Worth saying, not worth
    // refusing — a factory that has stopped running a news feed is entitled to.
    out.push({
      severity: 'warns',
      messageKey: 'config.impact.surfaceRemoved',
      params: { flag: name },
      field: `flags.${name}`,
    });
  }

  /* ── Collection points ────────────────────────────────────────────────── */
  if (patch.collectionPoints) {
    const keeping = new Set(patch.collectionPoints.map((point) => point.name));
    for (const point of current.collectionPoints) {
      if (keeping.has(point.name)) continue;
      const rows = usage.deliveriesByPoint[point.name] ?? 0;
      if (rows > 0) {
        /**
         * Refused, because a delivery references its point **by name** and nothing else.
         * Removing the point would leave rows filed against a place the factory no longer
         * lists — unreadable in a report and unfixable without a migration.
         */
        out.push({
          severity: 'blocks',
          messageKey: 'config.impact.pointInUse',
          params: { point: point.name, count: rows },
          field: 'collectionPoints',
        });
      }
    }
  }

  /* ── Banks ────────────────────────────────────────────────────────────── */
  if (patch.banks) {
    const keeping = new Set(patch.banks.map((bank) => bank.name));
    for (const bank of current.banks) {
      if (keeping.has(bank.name)) continue;
      const suppliers = usage.suppliersByBank[bank.name] ?? 0;
      if (suppliers > 0) {
        // A warning, not a block: existing bank details keep the name they were saved
        // with. Removing the bank only stops it being *offered* on a new change request.
        out.push({
          severity: 'warns',
          messageKey: 'config.impact.bankInUse',
          params: { bank: bank.name, count: suppliers },
          field: 'banks',
        });
      }
    }
  }

  /* ── Content languages ────────────────────────────────────────────────── */
  if (patch.localization?.contentLanguages) {
    const keeping = new Set(patch.localization.contentLanguages);
    for (const lang of current.contentLanguages) {
      if (keeping.has(lang)) continue;
      const records = usage.contentByLanguage[lang] ?? 0;
      out.push({
        severity: 'warns',
        messageKey: records > 0 ? 'config.impact.languageDroppedWithCopy' : 'config.impact.languageDropped',
        params: { lang, count: records },
        field: 'localization.contentLanguages',
      });
    }
    // The fallback cannot be dropped: M11 and M12 have nothing to fall back to without it,
    // and every gap check in `content.ts` is written against it.
    if (!keeping.has('en')) {
      out.push({
        severity: 'blocks',
        messageKey: 'config.impact.fallbackLanguageRequired',
        params: {},
        field: 'localization.contentLanguages',
      });
    }
  }

  /* ── The payout file layout (§21.17) ──────────────────────────────────── */
  if (patch.payouts?.export) {
    const template = patch.payouts.export;

    /**
     * Every template problem **blocks**, and none of them warns.
     *
     * The rest of this function draws its line at money the factory owes. This section is
     * on the same side of it for a blunter reason: the output of a bad template is a file
     * the bank rejects, and the person who discovers that is a supplier who was not paid.
     * There is no version of "save it anyway and see" that is cheap here.
     */
    for (const problem of payoutTemplateProblems(template)) {
      out.push({
        severity: 'blocks',
        messageKey: `config.impact.payoutTemplate.${problem}`,
        params: {},
        field: 'payouts.export',
      });
    }

    /**
     * A bank column on a template that also serves cheque and cash runs.
     *
     * A warning, not a block: one template for all three methods is a perfectly reasonable
     * thing to want, and the column simply comes out empty on the runs that have no bank
     * details. But an empty column in a file somebody is about to upload should not be a
     * surprise, so it is said here rather than discovered in Excel.
     */
    const bankColumns = template.columns.filter((column) =>
      BANK_ONLY_FIELDS.includes(column.field),
    );
    if (bankColumns.length > 0) {
      out.push({
        severity: 'warns',
        messageKey: 'config.impact.payoutTemplateBankColumns',
        params: { count: bankColumns.length },
        field: 'payouts.export',
      });
    }
  }

  /* ── The tea-packet policy ────────────────────────────────────────────── */
  if (patch.teaPackets) {
    /**
     * All three problems block, and the reason is the same as the payout template's: the
     * output is a figure on a supplier's account. A zero pack size or a negative price
     * does not fail visibly — it prices every request in the queue at something wrong,
     * and the person who finds out is holding a slip with it deducted.
     */
    for (const problem of teaPacketPolicyProblems(patch.teaPackets)) {
      out.push({
        severity: 'blocks',
        messageKey: `config.impact.teaPacketPolicy.${problem}`,
        params: {},
        field: 'teaPackets',
      });
    }
  }

  // Blocks first: the reader has to fix those before the warnings matter.
  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'blocks' ? -1 : 1));
}

/** Is this patch saveable at all? */
export function isConfigPatchAllowed(impacts: readonly ConfigImpact[]): boolean {
  return !impacts.some((impact) => impact.severity === 'blocks');
}
