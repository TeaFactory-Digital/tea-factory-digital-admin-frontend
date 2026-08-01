/**
 * The module map from §18.1, as data.
 *
 * Every row carries three gates, and the order they apply in matters:
 *
 *  1. **`flag`** — does this factory buy the feature at all? A tenant without
 *     manure has no manure row, and no manure endpoint either (AC-07).
 *  2. **`capability`** — may *this* user see it? A courtesy: the server enforces
 *     per endpoint, and hiding a lever that would 403 is kinder than offering it.
 * There used to be a third gate — `status: 'built' | 'planned'`, which rendered a
 * disabled row with a *Planned* chip so a walkthrough could see the shape of the
 * whole console. **All seventeen modules of the §18.1 scope now have a route**, so
 * every row was `built` and the branch that rendered the other case was
 * unreachable. It is gone rather than kept warm: a rendering path no row can reach
 * and no test can exercise is a path that rots.
 *
 * A module that arrives later (§18.1 stops at M17) gets a row when it gets a
 * route, not before. What is *not* built is now smaller than a module — the payout
 * file (§21.17), savings movements (§21.9), a deduction editor (§21.10), CSV
 * export (§18.1) — and each of those is stated on the screen where somebody would
 * look for it, which a sidebar chip could never do.
 */

import type { Capability, FeatureFlagName, QueueKey } from '@tfd/domain';
import type { LucideIcon } from 'lucide-react';
import {
  BadgeDollarSign,
  Bell,
  ClipboardList,
  FileText,
  Gauge,
  Landmark,
  LayoutDashboard,
  MessageSquare,
  Newspaper,
  PiggyBank,
  Scale,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
} from 'lucide-react';

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
    titleKey: 'nav.sectionOperations',
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
      {
        module: 'M3',
        labelKey: 'nav.deliveries',
        to: '/deliveries',
        icon: Scale,
        capability: 'deliveries',
      },
    ],
  },
  {
    titleKey: 'nav.sectionMoney',
    items: [
      {
        module: 'M4',
        labelKey: 'nav.rates',
        to: '/rates',
        icon: Gauge,
        capability: 'ratesAndMonthClose',
      },
      {
        module: 'M5',
        labelKey: 'nav.bills',
        to: '/bills',
        icon: FileText,
        capability: 'billing',
      },
      {
        module: 'M6',
        labelKey: 'nav.payouts',
        to: '/payouts',
        icon: Landmark,
        capability: 'payouts',
        flag: 'enablePayouts',
      },
      {
        module: 'M8',
        labelKey: 'nav.savings',
        to: '/savings',
        icon: PiggyBank,
        // `billing`, not a capability of its own: §12.1 has no savings row, and the
        // scheme is a view over bills. Inventing one here would be a permission the
        // matrix has never granted anybody.
        capability: 'billing',
        flag: 'enableSavings',
      },
    ],
  },
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
        module: 'M16',
        labelKey: 'nav.reports',
        to: '/reports',
        icon: Gauge,
        capability: 'reports',
        flag: 'enableReports',
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
