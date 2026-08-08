/**
 * The module map, as data.
 *
 * Every row carries two gates, and the order they apply in matters:
 *
 *  1. **`flag`** — does this factory buy the feature at all? A tenant without
 *     manure has no manure row, and no manure endpoint either (AC-07).
 *  2. **`capability`** — may *this* user see it? A courtesy: the server enforces
 *     per endpoint, and hiding a lever that would 403 is kinder than offering it.
 *
 * There used to be a third gate — `status: 'built' | 'planned'`, which rendered a
 * disabled row with a *Planned* chip so a walkthrough could see the shape of the
 * whole console. Every row became `built` and the branch that rendered the other
 * case was unreachable. It is gone rather than kept warm: a rendering path no row
 * can reach and no test can exercise is a path that rots.
 *
 * ---
 *
 * ## v2 — what this console is for
 *
 * **This console manages the mobile app. It does not run the factory.**
 *
 * v1 built §18.1's seventeen modules, which was the right scope when the console
 * was going to be "the other half of every flow the app can only ask for". The
 * factory already has its own console for its internal processes — leaf coming in,
 * the auction rate, the month closing, bills, money going out — so six of those
 * seventeen were building a second answer to questions that already had one. Two
 * systems recording the same weighing is not redundancy; it is a reconciliation
 * somebody does by hand every month.
 *
 * What is left is everything the **app** needs an office for, and the test for a
 * row is one question: *if this console did not exist, what would the supplier's
 * phone do wrong?*
 *
 *  - A change request would sit `pending` for ever (M9).
 *  - A credit or tea-packet request would never be decided (M7, M18).
 *  - A message would go unanswered (M10).
 *  - The feed, the banner, the FAQ and the push would be empty (M11, M12, M13).
 *  - The flags, the brand and the bank list would need a deploy to change (M14).
 *
 * The internal-process rows are **commented out below rather than deleted**, and
 * their screens are still in the tree. They are a working implementation of §18.1
 * that the factory's own console can be read against, and deleting them would
 * throw away the only executable statement of what those flows require.
 */

import type { Capability, FeatureFlagName, QueueKey } from '@tfd/domain';
import type { LucideIcon } from 'lucide-react';
import {
  BadgeDollarSign,
  Bell,
  ClipboardList,
  FileText,
  Gauge,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Newspaper,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
} from 'lucide-react';
/* v1 icons, for the rows commented out below: Landmark (M6), PiggyBank (M8), Scale (M3). */

export interface NavItem {
  /** The §18.1 module id, so a bug report can cite it. */
  module: string;
  /** i18n key — never a literal (BR-110). */
  labelKey: string;
  to: string;
  icon: LucideIcon;
  capability: Capability;
  /**
   * The flag this row needs. An **array means any one of them**, which exists for
   * exactly one row: a factory may lend against leaf but not against income
   * history, and gating the credit queue on `enableAdvances` alone would hide it
   * from a factory that only does loans.
   */
  flag?: FeatureFlagName | FeatureFlagName[];
  /**
   * Reads the pending count for a badge from the dashboard summary. An array is
   * summed — the credit row is three queues behind one link, and a badge showing
   * only the advances would under-report the inbox it opens.
   */
  queue?: QueueKey | QueueKey[];
}

/** Every flag a row needs, as a list, so callers do not branch on the shape. */
export function flagsOf(item: NavItem): FeatureFlagName[] {
  if (!item.flag) return [];
  return Array.isArray(item.flag) ? item.flag : [item.flag];
}

/** Every queue a row's badge counts. */
export function queuesOf(item: NavItem): QueueKey[] {
  if (!item.queue) return [];
  return Array.isArray(item.queue) ? item.queue : [item.queue];
}

export interface NavSection {
  titleKey: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    titleKey: 'nav.sectionOverview',
    items: [
      {
        module: 'M1',
        labelKey: 'nav.dashboard',
        to: '/',
        icon: LayoutDashboard,
        capability: 'reports',
      },
      {
        module: 'M2',
        labelKey: 'nav.suppliers',
        to: '/suppliers',
        icon: Users,
        capability: 'suppliers',
      },
    ],
  },
  /* ────────────────────────────────────────────────────────────────────────────
   * v1 § "Operations" and "Money" — the factory's internal processes.
   *
   * Commented out in v2, not deleted. Every screen behind these rows still builds
   * and every mock handler still answers; what has gone is the claim that *this*
   * console is where the work happens. The factory's own console records the leaf,
   * enters the rate, closes the month and pays the suppliers, and a second set of
   * screens doing the same job is two systems to reconcile.
   *
   * M5 is the one exception and it is **not** here: bills survive as a read-only
   * support view, because the app puts a bill in front of the supplier and the
   * office has to be able to answer a question about the figure on their phone.
   * Reading it is app support; producing it is not. See `router.tsx`.
   *
   *   {
   *     titleKey: 'nav.sectionOperations',
   *     items: [
   *       {
   *         module: 'M3',
   *         labelKey: 'nav.deliveries',
   *         to: '/deliveries',
   *         icon: Scale,
   *         capability: 'deliveries',
   *       },
   *     ],
   *   },
   *   {
   *     titleKey: 'nav.sectionMoney',
   *     items: [
   *       {
   *         module: 'M4',
   *         labelKey: 'nav.rates',
   *         to: '/rates',
   *         icon: Gauge,
   *         capability: 'ratesAndMonthClose',
   *       },
   *       {
   *         module: 'M6',
   *         labelKey: 'nav.payouts',
   *         to: '/payouts',
   *         icon: Landmark,
   *         capability: 'payouts',
   *         flag: 'enablePayouts',
   *       },
   *       {
   *         module: 'M8',
   *         labelKey: 'nav.savings',
   *         to: '/savings',
   *         icon: PiggyBank,
   *         // `billing`, not a capability of its own: §12.1 has no savings row, and
   *         // the scheme is a view over bills. Inventing one here would be a
   *         // permission the matrix has never granted anybody.
   *         capability: 'billing',
   *         flag: 'enableSavings',
   *       },
   *     ],
   *   },
   * ──────────────────────────────────────────────────────────────────────────── */
  {
    titleKey: 'nav.sectionQueues',
    items: [
      {
        module: 'M9',
        labelKey: 'nav.changeRequests',
        to: '/change-requests',
        icon: ClipboardList,
        capability: 'changeRequests',
        queue: 'changeRequests',
      },
      {
        module: 'M7',
        labelKey: 'nav.credit',
        to: '/credit',
        icon: BadgeDollarSign,
        capability: 'creditRequests',
        // **Any** of the three, not advances alone: a factory may lend against
        // leaf but not against income history, or the other way round. The screen
        // then offers only the facilities that are on, and the API refuses the
        // rest with `feature-disabled` (AC-07).
        flag: ['enableAdvances', 'enableLoans', 'enableManure'],
        queue: ['advanceRequests', 'loanRequests', 'manureRequests'],
      },
      {
        /**
         * M18 — the queue v1 never had.
         *
         * Its own row rather than a fourth filter on M7: a tea-packet request has no
         * eligibility working to show, so it would have been the one row in that queue
         * with three empty figures and an AC-05 obligation it cannot meet.
         */
        module: 'M18',
        labelKey: 'nav.teaPackets',
        to: '/tea-packets',
        icon: Package,
        capability: 'creditRequests',
        flag: 'enableTeaPackets',
        queue: 'teaPacketRequests',
      },
      {
        module: 'M10',
        labelKey: 'nav.inquiries',
        to: '/inquiries',
        icon: MessageSquare,
        capability: 'inquiries',
        flag: 'enableInquiry',
        queue: 'inquiries',
      },
    ],
  },
  {
    titleKey: 'nav.sectionSupport',
    items: [
      {
        /**
         * M5, reduced to what app support needs.
         *
         * A supplier telephones about the figure on their phone, and the clerk has to be
         * able to see the same account. That is a read, and it stays. Generating a run
         * and publishing a month are the factory's own console's, and the controls for
         * them are commented out on the screen itself.
         */
        module: 'M5',
        labelKey: 'nav.bills',
        to: '/bills',
        icon: FileText,
        capability: 'billing',
      },
    ],
  },
  {
    titleKey: 'nav.sectionContent',
    items: [
      {
        module: 'M11',
        labelKey: 'nav.news',
        to: '/news',
        icon: Newspaper,
        capability: 'content',
        flag: 'enableNews',
      },
      {
        /**
         * The banner editor — §18.1 puts it inside M11 and it gets its own row, because
         * v1 proved the alternative: the flag shipped, the app type shipped, and with no
         * row and no screen a factory could turn the feature on and find nothing behind
         * it. A surface reachable only from inside another module's detail page is a
         * surface the office does not know it has.
         *
         * Gated on `enablePromoBanner`, not `enableNews` — see `router.tsx`.
         */
        module: 'M11',
        labelKey: 'nav.banners',
        to: '/banners',
        icon: Megaphone,
        capability: 'content',
        flag: 'enablePromoBanner',
      },
      {
        module: 'M12',
        labelKey: 'nav.content',
        to: '/content',
        icon: ScrollText,
        capability: 'content',
      },
      {
        module: 'M13',
        labelKey: 'nav.notifications',
        to: '/notifications',
        icon: Bell,
        capability: 'content',
        flag: 'enablePushNotifications',
      },
    ],
  },
  {
    titleKey: 'nav.sectionAdmin',
    items: [
      {
        /**
         * M16, reduced to the one report this console is about: `channelShift`.
         *
         * §19.3 calls app adoption and channel shift *"the two KPIs that justify the
         * project"*, which makes it the only report an app-management console owes
         * anybody. The other three — dormant suppliers, leaf by collection point, the
         * month summary — are the factory's own console's, and are commented out in
         * `reports/hooks.ts` rather than deleted.
         *
         * **No flag.** `enableReports` was console-only and is gone with M6's; the same
         * argument as M12 and M15 applies to what is left — a factory does not decline
         * to know whether its own app is being used.
         */
        module: 'M16',
        labelKey: 'nav.reports',
        to: '/reports',
        icon: Gauge,
        capability: 'reports',
      },
      {
        module: 'M17',
        labelKey: 'nav.audit',
        to: '/audit',
        icon: ShieldCheck,
        capability: 'auditLog',
      },
      {
        module: 'M14',
        labelKey: 'nav.configuration',
        to: '/configuration',
        icon: Settings,
        capability: 'flagsAndBranding',
      },
      {
        module: 'M15',
        labelKey: 'nav.users',
        to: '/users',
        icon: UsersRound,
        capability: 'usersAndRoles',
      },
    ],
  },
];
