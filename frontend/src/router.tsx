import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { AssetLayout } from './layouts/AssetLayout';
import { ScopeGuard } from './layouts/ScopeGuard';
import { RoleGuard } from './layouts/RoleGuard';
import { LoginPage } from './pages/LoginPage';
import { MapPage } from './pages/MapPage';
import { AssetScopeRouter } from './pages/assets/AssetScopeRouter';
import { CaseListPage } from './pages/cases/CaseListPage';
import { CaseDetailPage } from './pages/cases/CaseDetailPage';
import { InspectionListPage } from './pages/inspections/InspectionListPage';
import { InspectionDetailPage } from './pages/inspections/InspectionDetailPage';
import { NotFoundPage } from './pages/errors/NotFoundPage';
import { ForbiddenPage } from './pages/errors/ForbiddenPage';
import { ServerErrorPage } from './pages/errors/ServerErrorPage';
import { StubPage } from './components/StubPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <Navigate to="/map" replace /> },
      { path: 'map', element: <MapPage /> },
      {
        path: 'assets/:scope',
        element: (
          <ScopeGuard>
            <AssetLayout />
          </ScopeGuard>
        ),
        children: [
          { index: true, element: <AssetScopeRouter /> },
          { path: ':id', element: <AssetScopeRouter /> },
          { path: ':id/geometry', element: <StubPage title="Geometry Editor" /> },
        ],
      },
      { path: 'cases', element: <CaseListPage /> },
      { path: 'cases/:id', element: <CaseDetailPage /> },
      { path: 'inspections', element: <InspectionListPage /> },
      { path: 'inspections/:id', element: <InspectionDetailPage /> },
      {
        path: 'vendors',
        element: (
          <RoleGuard roles={['admin']}>
            <StubPage title="業者管理" />
          </RoleGuard>
        ),
      },
      {
        path: 'vendors/:id',
        element: (
          <RoleGuard roles={['admin']}>
            <StubPage title="業者詳細" />
          </RoleGuard>
        ),
      },
      { path: '403', element: <ForbiddenPage /> },
      { path: '500', element: <ServerErrorPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
