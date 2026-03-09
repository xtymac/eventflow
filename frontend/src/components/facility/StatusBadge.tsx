import { FACILITY_STATUS_CONFIG } from '../../data/dummyFacilities';

export function StatusBadge({ status }: { status: string }) {
  const config = FACILITY_STATUS_CONFIG[status] || { label: status, className: 'bg-gray-400 text-white' };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${config.className}`}>
      {config.label}
    </span>
  );
}
