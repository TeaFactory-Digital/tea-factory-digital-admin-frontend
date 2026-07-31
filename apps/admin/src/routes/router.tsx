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
import { RequireAuth, RequireCapability } from '@/auth/guards';
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
const AuditScreen = lazy(() =>
  import('@/modules/audit/AuditScreen').then((m) => ({ default: m.AuditScreen })),
);

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
