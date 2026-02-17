import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { ParkMgmtLayout } from './layouts/ParkMgmtLayout';
import { RoleGuard } from './layouts/RoleGuard';
import { SectionGuard } from './layouts/SectionGuard';
import { LoginPage } from './pages/LoginPage';
import { MapPage } from './pages/MapPage';
import { ParkListPage } from './pages/parks/ParkListPage';
import { ParkDetailPage } from './pages/parks/ParkDetailPage';
import { FacilityListPage } from './pages/facilities/FacilityListPage';
import { FacilityDetailPage } from './pages/facilities/FacilityDetailPage';
import { CaseListPage } from './pages/cases/CaseListPage';
import { CaseDetailPage } from './pages/cases/CaseDetailPage';
import { InspectionListPage } from './pages/inspections/InspectionListPage';
import { InspectionDetailPage } from './pages/inspections/InspectionDetailPage';
import { NotFoundPage } from './pages/errors/NotFoundPage';
import { ForbiddenPage } from './pages/errors/ForbiddenPage';
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
        path: 'park-mgmt',
        element: (
          <SectionGuard section="park-mgmt">
            <ParkMgmtLayout />
          </SectionGuard>
        ),
        children: [
          { index: true, element: <Navigate to="parks" replace /> },
          { path: 'parks', element: <ParkListPage /> },
          { path: 'parks/:id', element: <ParkDetailPage /> },
          { path: 'parks/:id/geometry', element: <StubPage title="Geometry Editor" /> },
          { path: 'facilities', element: <FacilityListPage /> },
          { path: 'facilities/:id', element: <FacilityDetailPage /> },
        ],
      },
      { path: 'cases', element: <CaseListPage /> },
      { path: 'cases/:id', element: <CaseDetailPage /> },
      { path: 'inspections', element: <InspectionListPage /> },
      { path: 'inspections/:id', element: <InspectionDetailPage /> },
      {
        path: 'tree-mgmt/*',
        element: (
          <SectionGuard section="tree-mgmt">
            <StubPage title="樹木管理" />
          </SectionGuard>
        ),
      },
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
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
