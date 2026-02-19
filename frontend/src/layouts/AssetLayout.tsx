import { Outlet } from 'react-router-dom';

export function AssetLayout() {
  return (
    <div className="h-full min-w-0 overflow-x-hidden overflow-y-auto">
      <Outlet />
    </div>
  );
}
