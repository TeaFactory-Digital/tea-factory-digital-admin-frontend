/**
 * The module map from §18.1, as data.
 *
 * Every row carries three gates, and the order they apply in matters:
 *
 *  1. **`flag`** — does this factory buy the feature at all? A tenant without
 *     manure has no manure row, and no manure endpoint either (AC-07).
 *  2. **`capability`** — may *this* user see it? A courtesy: the server enforces
 *     per endpoint, and hiding a lever that would 403 is kinder than offering it.
 *  3. **`status`** — is it built? `planned` rows render disabled with a chip.
 *
 * The `planned` rows are deliberately visible rather than omitted. The office
 * signed off a 17-module scope; a sidebar showing three modules reads as a
 * different product, and a stakeholder walkthrough should be able to see the
 * shape of the whole console while being told plainly what is not there yet.
 */

import type { Capability, FeatureFlagName } from '@tfd/domain';
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

export type NavStatus = 'built' | 'planned';

export interface NavItem {
  /** The §18.1 module id, so a bug report can cite it. */
  module: string;
  /** i18n key — never a literal (BR-110). */
  labelKey: string;
  to: string;
  icon: LucideIcon;
  capability: Capability;
  flag?: FeatureFlagName;
  status: NavStatus;
  /** Reads the pending count for a badge from the dashboard summary. */
  queue?: 'changeRequests' | 'advanceRequests' | 'loanRequests' | 'manureRequests' | 'inquiries';
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
        status: 'built',
      },
      {
        module: 'M2',
        labelKey: 'nav.suppliers',
        to: '/suppliers',
        icon: Users,
        capability: 'suppliers',
        status: 'built',
      },
      {
        module: 'M3',
        labelKey: 'nav.deliveries',
        to: '/deliveries',
        icon: Scale,
        capability: 'deliveries',
        status: 'planned',
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
        status: 'planned',
      },
      {
        module: 'M5',
        labelKey: 'nav.bills',
        to: '/bills',
        icon: FileText,
        capability: 'billing',
        status: 'planned',
      },
      {
        module: 'M6',
        labelKey: 'nav.payouts',
        to: '/payouts',
        icon: Landmark,
        capability: 'payouts',
        flag: 'enablePayouts',
        status: 'planned',
      },
      {
        module: 'M8',
        labelKey: 'nav.savings',
        to: '/savings',
        icon: PiggyBank,
        capability: 'billing',
        flag: 'enableSavings',
        status: 'planned',
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
        status: 'built',
        queue: 'changeRequests',
      },
      {
        module: 'M7',
        labelKey: 'nav.credit',
        to: '/credit',
        icon: BadgeDollarSign,
        capability: 'creditRequests',
        // Gated on advances alone would be wrong: a factory may lend against
        // leaf but not against income history. The credit screen itself then
        // shows only the facilities that are on.
        flag: 'enableAdvances',
        status: 'planned',
      },
      {
        module: 'M10',
        labelKey: 'nav.inquiries',
        to: '/inquiries',
        icon: MessageSquare,
        capability: 'inquiries',
        flag: 'enableInquiry',
        status: 'planned',
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
        status: 'planned',
      },
      {
        module: 'M12',
        labelKey: 'nav.content',
        to: '/content',
        icon: ScrollText,
        capability: 'content',
        status: 'planned',
      },
      {
        module: 'M13',
        labelKey: 'nav.notifications',
        to: '/notifications',
        icon: Bell,
        capability: 'content',
        flag: 'enablePushNotifications',
        status: 'planned',
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
        status: 'planned',
      },
      {
        module: 'M17',
        labelKey: 'nav.audit',
        to: '/audit',
        icon: ShieldCheck,
        capability: 'auditLog',
        status: 'built',
      },
      {
        module: 'M14',
        labelKey: 'nav.configuration',
        to: '/configuration',
        icon: Settings,
        capability: 'flagsAndBranding',
        status: 'planned',
      },
      {
        module: 'M15',
        labelKey: 'nav.users',
        to: '/users',
        icon: UsersRound,
        capability: 'usersAndRoles',
        status: 'planned',
      },
    ],
  },
];
