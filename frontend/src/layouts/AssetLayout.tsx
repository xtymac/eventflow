import { Outlet } from 'react-router-dom';

export function AssetLayout() {
  return (
    <div className="h-full overflow-auto">
      <Outlet />
    </div>
  );
}
