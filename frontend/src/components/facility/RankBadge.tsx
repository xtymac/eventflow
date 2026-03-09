const colors: Record<string, string> = {
  A: 'bg-[#22C55E] text-white',
  B: 'bg-[#FACC15] text-[#713F12]',
  C: 'bg-[#F87171] text-white',
  D: 'bg-[#6B7280] text-white',
};

export function RankBadge({ rank }: { rank?: string }) {
  if (!rank) return <span className="text-xs text-[#a3a3a3]">-</span>;
  return (
    <span className={`inline-flex items-center justify-center size-6 rounded text-[10px] font-bold ${colors[rank] || 'bg-gray-200 text-gray-700'}`}>
      {rank}
    </span>
  );
}
