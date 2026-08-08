/**
 * Routes.
 *
 * Only built modules have routes. A route that rendered "coming soon" is worse
 * than no route: it is a URL a clerk can bookmark, share and then report as
 * broken.
 *
 * **v2 scope.** The internal-process routes — deliveries, rates, payouts, savings —
 * are commented out below rather than deleted, along with their lazy imports. The
 * factory's own console runs those; this one manages the mobile app. See
 * `navigation.ts` for the full argument and for what stayed.
 *
 * Every route is wrapped in the capability gate, so a bookmarked or emailed URL is
 * refused the same way the sidebar would have hidden it.
 *
 * **Module screens are lazy.** The first thing anyone loads is a sign-in form, and
 * without this it arrives with a charting library, a table engine and every screen
 * attached. `AppShell` provides the `Suspense` boundary they resolve inside.
 */

import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/layout/AppShell';
import { RequireAnyFlag, RequireAuth, RequireCapability, RequireFlag } from '@/auth/guards';
import { SignInScreen } from '@/auth/SignInScreen';
import { RouteErrorBoundary } from './RouteErrorBoundary';

const DashboardScreen = lazy(() =>
  import('@/modules/dashboard/DashboardScreen').then((m) => ({ default: m.DashboardScreen })),
);
const SuppliersScreen = lazy(() =>
  import('@/modules/suppliers/SuppliersScreen').then((m) => ({ default: m.SuppliersScreen })),
);
const SupplierDetailScreen = lazy(() =>
  import('@/modules/suppliers/SupplierDetailScreen').then((m) => ({
    default: m.SupplierDetailScreen,
  })),
);
const BillsScreen = lazy(() =>
  import('@/modules/bills/BillsScreen').then((m) => ({ default: m.BillsScreen })),
);
const BillDetailScreen = lazy(() =>
  import('@/modules/bills/BillDetailScreen').then((m) => ({ default: m.BillDetailScreen })),
);
/* ──────────────────────────────────────────────────────────────────────────────
 * v1 internal-process screens. Still in the tree, no longer routed — see
 * `navigation.ts` for why. The imports go with the routes: a lazy chunk nothing
 * can reach is weight in the build for a URL that answers 404 anyway.
 *
 *   const DeliveriesScreen = lazy(() =>
 *     import('@/modules/deliveries/DeliveriesScreen').then((m) => ({ default: m.DeliveriesScreen })),
 *   );
 *   const MonthCloseScreen = lazy(() =>
 *     import('@/modules/months/MonthCloseScreen').then((m) => ({ default: m.MonthCloseScreen })),
 *   );
 *   const PayoutsScreen = lazy(() =>
 *     import('@/modules/payouts/PayoutsScreen').then((m) => ({ default: m.PayoutsScreen })),
 *   );
 *   const PayoutRunDetailScreen = lazy(() =>
 *     import('@/modules/payouts/PayoutRunDetailScreen').then((m) => ({
 *       default: m.PayoutRunDetailScreen,
 *     })),
 *   );
 *   const SavingsScreen = lazy(() =>
 *     import('@/modules/savings/SavingsScreen').then((m) => ({ default: m.SavingsScreen })),
 *   );
 * ────────────────────────────────────────────────────────────────────────────── */
const ChangeRequestsScreen = lazy(() =>
  import('@/modules/change-requests/ChangeRequestsScreen').then((m) => ({
    default: m.ChangeRequestsScreen,
  })),
);
const ChangeRequestDetailScreen = lazy(() =>
  import('@/modules/change-requests/ChangeRequestDetailScreen').then((m) => ({
    default: m.ChangeRequestDetailScreen,
  })),
);
const CreditScreen = lazy(() =>
  import('@/modules/credit/CreditScreen').then((m) => ({ default: m.CreditScreen })),
);
const CreditRequestDetailScreen = lazy(() =>
  import('@/modules/credit/CreditRequestDetailScreen').then((m) => ({
    default: m.CreditRequestDetailScreen,
  })),
);
const TeaPacketsScreen = lazy(() =>
  import('@/modules/tea-packets/TeaPacketsScreen').then((m) => ({ default: m.TeaPacketsScreen })),
);
const InquiriesScreen = lazy(() =>
  import('@/modules/inquiries/InquiriesScreen').then((m) => ({ default: m.InquiriesScreen })),
);
const InquiryDetailScreen = lazy(() =>
  import('@/modules/inquiries/InquiryDetailScreen').then((m) => ({
    default: m.InquiryDetailScreen,
  })),
);
const NewsScreen = lazy(() =>
  import('@/modules/news/NewsScreen').then((m) => ({ default: m.NewsScreen })),
);
const NewsArticleScreen = lazy(() =>
  import('@/modules/news/NewsArticleScreen').then((m) => ({ default: m.NewsArticleScreen })),
);
const BannersScreen = lazy(() =>
  import('@/modules/banners/BannersScreen').then((m) => ({ default: m.BannersScreen })),
);
const BannerEditorScreen = lazy(() =>
  import('@/modules/banners/BannerEditorScreen').then((m) => ({ default: m.BannerEditorScreen })),
);
const StaticContentScreen = lazy(() =>
  import('@/modules/static-content/StaticContentScreen').then((m) => ({
    default: m.StaticContentScreen,
  })),
);
const NotificationsScreen = lazy(() =>
  import('@/modules/notifications/NotificationsScreen').then((m) => ({
    default: m.NotificationsScreen,
  })),
);
const ConfigurationScreen = lazy(() =>
  import('@/modules/configuration/ConfigurationScreen').then((m) => ({
    default: m.ConfigurationScreen,
  })),
);
const ReportsScreen = lazy(() =>
  import('@/modules/reports/ReportsScreen').then((m) => ({ default: m.ReportsScreen })),
);
const UsersScreen = lazy(() =>
  import('@/modules/users/UsersScreen').then((m) => ({ default: m.UsersScreen })),
);
const AuditScreen = lazy(() =>
  import('@/modules/audit/AuditScreen').then((m) => ({ default: m.AuditScreen })),
);

/** The three facilities M7 covers. Any one of them opens the queue — see `RequireAnyFlag`. */
const CREDIT_FLAGS = ['enableAdvances', 'enableLoans', 'enableManure'] as const;

export const router = createBrowserRouter([
  {
    path: '/sign-in',
    element: <SignInScreen />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: (
          <RequireCapability capability="reports">
            <DashboardScreen />
          </RequireCapability>
        ),
      },
      {
        path: 'suppliers',
        element: (
          <RequireCapability capability="suppliers">
            <SuppliersScreen />
          </RequireCapability>
        ),
      },
      {
        path: 'suppliers/:id',
        element: (
          <RequireCapability capability="suppliers">
            <SupplierDetailScreen />
          </RequireCapability>
        ),
      },
      /**
       * M5, read-only. A supplier telephones about the figure on their phone and the
       * clerk needs the same account in front of them — that is app support, and it is
       * why this route survived the v2 scope cut when the four below it did not.
       * Generating and publishing are the factory's own console's; the controls are
       * commented out on `BillsScreen` rather than merely hidden here, because a route
       * that renders a screen with live mutation buttons is not read-only.
       */
      {
        path: 'bills',
        element: (
          <RequireCapability capability="billing">
            <BillsScreen />
          </RequireCapability>
        ),
      },
      {
        path: 'bills/:id',
        element: (
          <RequireCapability capability="billing">
            <BillDetailScreen />
          </RequireCapability>
        ),
      },
      /* ──────────────────────────────────────────────────────────────────────────
       * v1 internal-process routes, commented out in v2.
       *
       * Not left behind a capability nobody holds, and not rendering a "moved" notice
       * either: this console has no way to know where the factory's own console lives,
       * and a screen that guessed would be a broken link somebody maintains. An unknown
       * path inside the shell already goes home (the `*` route at the foot of this
       * list), which is the honest answer to a bookmark that no longer resolves.
       *
       * Payouts and savings were **flag-gated as well as capability-gated**, and the
       * flag was checked first — a factory that does not use a feature is not a
       * permission question, and asking it in the other order shows a manager at a
       * cash-only factory a bank-transfer screen they are entitled to but cannot use.
       *
       *   {
       *     path: 'deliveries',
       *     element: (
       *       <RequireCapability capability="deliveries">
       *         <DeliveriesScreen />
       *       </RequireCapability>
       *     ),
       *   },
       *   {
       *     path: 'rates',
       *     element: (
       *       <RequireCapability capability="ratesAndMonthClose">
       *         <MonthCloseScreen />
       *       </RequireCapability>
       *     ),
       *   },
       *   {
       *     path: 'payouts',
       *     element: (
       *       <RequireFlag flag="enablePayouts">
       *         <RequireCapability capability="payouts">
       *           <PayoutsScreen />
       *         </RequireCapability>
       *       </RequireFlag>
       *     ),
       *   },
       *   {
       *     path: 'payouts/:id',
       *     element: (
       *       <RequireFlag flag="enablePayouts">
       *         <RequireCapability capability="payouts">
       *           <PayoutRunDetailScreen />
       *         </RequireCapability>
       *       </RequireFlag>
       *     ),
       *   },
       *   {
       *     path: 'savings',
       *     element: (
       *       <RequireFlag flag="enableSavings">
       *         <RequireCapability capability="billing">
       *           <SavingsScreen />
       *         </RequireCapability>
       *       </RequireFlag>
       *     ),
       *   },
       * ────────────────────────────────────────────────────────────────────────── */
      {
        path: 'change-requests',
        element: (
          <RequireCapability capability="changeRequests">
            <ChangeRequestsScreen />
          </RequireCapability>
        ),
      },
      {
        path: 'change-requests/:id',
        element: (
          <RequireCapability capability="changeRequests">
            <ChangeRequestDetailScreen />
          </RequireCapability>
        ),
      },
      {
        path: 'credit',
        element: (
          <RequireAnyFlag flags={[...CREDIT_FLAGS]}>
            <RequireCapability capability="creditRequests">
              <CreditScreen />
            </RequireCapability>
          </RequireAnyFlag>
        ),
      },
      {
        path: 'credit/:id',
        element: (
          <RequireAnyFlag flags={[...CREDIT_FLAGS]}>
            <RequireCapability capability="creditRequests">
              <CreditRequestDetailScreen />
            </RequireCapability>
          </RequireAnyFlag>
        ),
      },
      /**
       * M18. One route, not a list-plus-detail pair: a tea-packet request is a supplier,
       * a number of packets and a delivery method, and every one of those fits in the
       * grid. M7 needs a detail page because AC-05 makes it print the eligibility
       * working; there is no working here to print, and a detail page whose only job was
       * to repeat three columns would be a click between a clerk and a decision.
       */
      {
        path: 'tea-packets',
        element: (
          <RequireFlag flag="enableTeaPackets">
            <RequireCapability capability="creditRequests">
              <TeaPacketsScreen />
            </RequireCapability>
          </RequireFlag>
        ),
      },
      {
        path: 'inquiries',
        element: (
          <RequireFlag flag="enableInquiry">
            <RequireCapability capability="inquiries">
              <InquiriesScreen />
            </RequireCapability>
          </RequireFlag>
        ),
      },
      {
        path: 'inquiries/:id',
        element: (
          <RequireFlag flag="enableInquiry">
            <RequireCapability capability="inquiries">
              <InquiryDetailScreen />
            </RequireCapability>
          </RequireFlag>
        ),
      },
      /**
       * M11 is flag-gated (a factory that does not run a feed has no News row); **M12 is
       * not**. Terms, privacy and the FAQ are not a feature a factory buys or declines —
       * the app links to them from its own settings screen, and a tenant that could turn
       * them off would ship a binary with dead links in it.
       */
      {
        path: 'news',
        element: (
          <RequireFlag flag="enableNews">
            <RequireCapability capability="content">
              <NewsScreen />
            </RequireCapability>
          </RequireFlag>
        ),
      },
      {
        path: 'news/:id',
        element: (
          <RequireFlag flag="enableNews">
            <RequireCapability capability="content">
              <NewsArticleScreen />
            </RequireCapability>
          </RequireFlag>
        ),
      },
      /**
       * Banners are gated on `enablePromoBanner` and **not** on `enableNews`.
       *
       * They sit inside M11 in §18.1's module table and share its capability, but they
       * are a separate purchase: a factory that runs no feed may still want to announce
       * that the store is closed on Friday. Gating them behind the feed would make the
       * flag the app reads and the flag the console honours two different things.
       */
      {
        path: 'banners',
        element: (
          <RequireFlag flag="enablePromoBanner">
            <RequireCapability capability="content">
              <BannersScreen />
            </RequireCapability>
          </RequireFlag>
        ),
      },
      {
        path: 'banners/:id',
        element: (
          <RequireFlag flag="enablePromoBanner">
            <RequireCapability capability="content">
              <BannerEditorScreen />
            </RequireCapability>
          </RequireFlag>
        ),
      },
      {
        path: 'content',
        element: (
          <RequireCapability capability="content">
            <StaticContentScreen />
          </RequireCapability>
        ),
      },
      {
        path: 'notifications',
        element: (
          <RequireFlag flag="enablePushNotifications">
            <RequireCapability capability="content">
              <NotificationsScreen />
            </RequireCapability>
          </RequireFlag>
        ),
      },
      /**
       * No flag. A factory's own identity, flags and branding are not a feature it can
       * decline — this is the screen that turns the others off, and gating it on a flag
       * would make a misconfiguration unrecoverable from the console.
       */
      {
        path: 'configuration',
        element: (
          <RequireCapability capability="flagsAndBranding">
            <ConfigurationScreen />
          </RequireCapability>
        ),
      },
      /**
       * No flag in v2. `enableReports` was console-only and went with M6's `enablePayouts`
       * (see `FeatureFlagSet`), and what is left of M16 is `channelShift` — whether the
       * factory's own app is being used. That is not a feature a factory declines.
       */
      {
        path: 'reports',
        element: (
          <RequireCapability capability="reports">
            <ReportsScreen />
          </RequireCapability>
        ),
      },
      /**
       * No flag, for the same reason M14 has none: the screen that decides who may use the
       * console cannot itself be switchable, or a misconfiguration would be unrecoverable.
       */
      {
        path: 'users',
        element: (
          <RequireCapability capability="usersAndRoles">
            <UsersScreen />
          </RequireCapability>
        ),
      },
      {
        path: 'audit',
        element: (
          <RequireCapability capability="auditLog">
            <AuditScreen />
          </RequireCapability>
        ),
      },
      // Anything else inside the shell — including a v1 URL somebody bookmarked before
      // the scope cut — goes home rather than to a blank screen.
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
