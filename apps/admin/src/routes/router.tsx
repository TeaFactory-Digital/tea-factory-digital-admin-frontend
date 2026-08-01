/**
 * Routes.
 *
 * Only built modules have routes. A route that rendered "coming soon" is worse
 * than no route: it is a URL a clerk can bookmark, share and then report as
 * broken. The planned modules appear in the sidebar as disabled rows with a chip,
 * which says the same thing without pretending to be a screen.
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
const DeliveriesScreen = lazy(() =>
  import('@/modules/deliveries/DeliveriesScreen').then((m) => ({ default: m.DeliveriesScreen })),
);
const MonthCloseScreen = lazy(() =>
  import('@/modules/months/MonthCloseScreen').then((m) => ({ default: m.MonthCloseScreen })),
);
const BillsScreen = lazy(() =>
  import('@/modules/bills/BillsScreen').then((m) => ({ default: m.BillsScreen })),
);
const BillDetailScreen = lazy(() =>
  import('@/modules/bills/BillDetailScreen').then((m) => ({ default: m.BillDetailScreen })),
);
const PayoutsScreen = lazy(() =>
  import('@/modules/payouts/PayoutsScreen').then((m) => ({ default: m.PayoutsScreen })),
);
const PayoutRunDetailScreen = lazy(() =>
  import('@/modules/payouts/PayoutRunDetailScreen').then((m) => ({
    default: m.PayoutRunDetailScreen,
  })),
);
const SavingsScreen = lazy(() =>
  import('@/modules/savings/SavingsScreen').then((m) => ({ default: m.SavingsScreen })),
);
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
      {
        path: 'deliveries',
        element: (
          <RequireCapability capability="deliveries">
            <DeliveriesScreen />
          </RequireCapability>
        ),
      },
      {
        path: 'rates',
        element: (
          <RequireCapability capability="ratesAndMonthClose">
            <MonthCloseScreen />
          </RequireCapability>
        ),
      },
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
      /**
       * Payouts and savings are **flag-gated as well as capability-gated**, and the
       * flag is checked first — a factory that does not use a feature is not a
       * permission question, and asking it in the other order shows a manager at a
       * cash-only factory a bank-transfer screen they are entitled to but cannot use.
       */
      {
        path: 'payouts',
        element: (
          <RequireFlag flag="enablePayouts">
            <RequireCapability capability="payouts">
              <PayoutsScreen />
            </RequireCapability>
          </RequireFlag>
        ),
      },
      {
        path: 'payouts/:id',
        element: (
          <RequireFlag flag="enablePayouts">
            <RequireCapability capability="payouts">
              <PayoutRunDetailScreen />
            </RequireCapability>
          </RequireFlag>
        ),
      },
      {
        path: 'savings',
        element: (
          <RequireFlag flag="enableSavings">
            <RequireCapability capability="billing">
              <SavingsScreen />
            </RequireCapability>
          </RequireFlag>
        ),
      },
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
      {
        path: 'audit',
        element: (
          <RequireCapability capability="auditLog">
            <AuditScreen />
          </RequireCapability>
        ),
      },
      // Anything else inside the shell — including a planned module someone typed
      // by hand — goes home rather than to a blank screen.
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
