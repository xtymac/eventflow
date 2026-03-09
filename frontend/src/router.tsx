import { createBrowserRouter, Navigate, useParams, useLocation } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { AssetLayout } from './layouts/AssetLayout';
import { ScopeGuard } from './layouts/ScopeGuard';
import { RoleGuard } from './layouts/RoleGuard';
import { LoginPage } from './pages/LoginPage';
import { MapPage } from './pages/MapPage';
import { AssetScopeRouter } from './pages/assets/AssetScopeRouter';
import { InspectionCaseListPage, RepairCaseListPage } from './pages/cases/CaseListPage';
import { CaseDetailPage } from './pages/cases/CaseDetailPage';
import { InspectionListPage } from './pages/inspections/InspectionListPage';
import { InspectionDetailPage } from './pages/inspections/InspectionDetailPage';
import { NotFoundPage } from './pages/errors/NotFoundPage';
import { ForbiddenPage } from './pages/errors/ForbiddenPage';
import { ServerErrorPage } from './pages/errors/ServerErrorPage';
import { StubPage } from './components/StubPage';
import { ParkEditPage } from './pages/parks/ParkEditPage';
import { ContractorLayout } from './layouts/ContractorLayout';
import { ContractorMapPage } from './pages/contractor/ContractorMapPage';
import { ContractorInspectionListPage } from './pages/contractor/ContractorInspectionListPage';
import { ContractorRepairListPage } from './pages/contractor/ContractorRepairListPage';

/** Redirect /contractor/cases/:id → /cases/:id preserving query + hash */
function ContractorCaseRedirect() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  return <Navigate to={`/cases/${id}${location.search}${location.hash}`} replace />;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/contractor',
    element: <ContractorLayout />,
    children: [
      { index: true, element: <Navigate to="/contractor/map" replace /> },
      { path: 'map', element: <ContractorMapPage /> },
      { path: 'inspections', element: <ContractorInspectionListPage /> },
      { path: 'repairs', element: <ContractorRepairListPage /> },
      // Compatibility redirects: contractor-prefixed case URLs → canonical /cases/*
      { path: 'cases', element: <Navigate to="/cases" replace /> },
      { path: 'cases/:id', element: <ContractorCaseRedirect /> },
    ],
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
          { path: ':id/geometry', element: <ParkEditPage /> },
        ],
      },
      { path: 'cases', element: <Navigate to="/cases/inspections" replace /> },
      { path: 'cases/inspections', element: <InspectionCaseListPage /> },
      { path: 'cases/repairs', element: <RepairCaseListPage /> },
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
      { path: 'coverage', element: <StubPage title="公園内建ぺい率一覧" /> },
      { path: 'longevity', element: <StubPage title="公園施設長寿命化計画" /> },
      { path: '403', element: <ForbiddenPage /> },
      { path: '500', element: <ServerErrorPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
