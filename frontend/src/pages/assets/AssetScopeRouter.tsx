import { useParams } from 'react-router-dom';
import { ParkListPage } from '../parks/ParkListPage';
import { ParkDetailPage } from '../parks/ParkDetailPage';
import { FacilityListPage } from '../facilities/FacilityListPage';
import { FacilityDetailPage } from '../facilities/FacilityDetailPage';
import { StubPage } from '../../components/StubPage';

const SCOPE_LABELS: Record<string, string> = {
  'park-trees': '公園樹木管理',
  'street-trees': '街路樹管理',
  'green-lands': '緑地管理',
};

export function AssetScopeRouter() {
  const { scope, id } = useParams<{ scope: string; id?: string }>();

  switch (scope) {
    case 'parks':
      return id ? <ParkDetailPage /> : <ParkListPage />;
    case 'facilities':
      return id ? <FacilityDetailPage /> : <FacilityListPage />;
    case 'park-trees':
    case 'street-trees':
    case 'green-lands':
      return <StubPage title={SCOPE_LABELS[scope!] || scope!} />;
    default:
      return <StubPage title="Unknown Scope" />;
  }
}
