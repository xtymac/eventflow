const cfg: Record<string, { label: string; cls: string }> = {
  high: { label: '高', cls: 'bg-[#F87171] text-white' },
  medium: { label: '中', cls: 'bg-[#FACC15] text-[#713F12]' },
  low: { label: '低', cls: 'bg-[#22C55E] text-white' },
};

export function UrgencyBadge({ level }: { level?: string }) {
  if (!level) return <span className="text-xs text-[#a3a3a3]">-</span>;
  const c = cfg[level] || { label: level, cls: 'bg-gray-200 text-gray-700' };
  return (
    <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold ${c.cls}`}>
      {c.label}
    </span>
  );
}
