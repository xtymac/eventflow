import { useState, useEffect, useMemo } from 'react';
import { Box, Text, Paper, Stack } from '@/components/shims';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  IconPencil, IconSearch, IconChevronLeft, IconChevronRight, IconPhoto, IconMaximize,
} from '@tabler/icons-react';
import { CircleArrowRight } from 'lucide-react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import * as turf from '@turf/turf';
import { useParkFacility, useGreenSpace } from '../../hooks/useApi';
import { recordVisit } from '../../hooks/useRecentVisits';
import { PageState } from '../../components/PageState';
import { MiniMap } from '../../components/MiniMap';
import { getDummyFacility, FACILITY_CLASSIFICATION_LABELS, FACILITY_STATUS_CONFIG } from '../../data/dummyFacilities';
import { getDummyRepairsByFacility } from '../../data/dummyRepairs';
import { getDummyFacilityInspections } from '../../data/dummyFacilityInspections';
import { CURATED_PARKS } from '../../data/curatedParks';

/* ── constants ────────────────────────────────────────── */

const RANK_COLORS: Record<string, string> = {
  A: 'bg-green-600 text-white',
  B: 'bg-yellow-500 text-white',
  C: 'bg-orange-500 text-white',
  D: 'bg-red-600 text-white',
  S: 'bg-red-600 text-white',
};

const PARK_MAP = new Map(CURATED_PARKS.map(p => [p.id, p]));

type FacilityDetailLocationState = {
  breadcrumbFrom?: { to?: string; label?: string };
};

/* ── sub-components ───────────────────────────────────── */

function InfoRow({ label, value, isLink, onLinkClick }: {
  label: string;
  value: React.ReactNode;
  isLink?: boolean;
  onLinkClick?: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between py-2 min-h-[28px]">
        <Text size="sm" c="dimmed" className="shrink-0">{label}</Text>
        {isLink ? (
          <button
            onClick={onLinkClick}
            className="text-sm text-green-700 underline hover:text-green-900 text-right"
          >
            {value}
          </button>
        ) : (
          <Text size="sm" className="text-right">{value ?? '-'}</Text>
        )}
      </div>
      <div className="border-b border-gray-200" />
    </>
  );
}

function SectionTitle({ children, editButton }: { children: React.ReactNode; editButton?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <Text fw={600} size="md">{children}</Text>
      {editButton && (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400" disabled>
          <IconPencil size={16} />
        </Button>
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank?: string }) {
  if (!rank) return <span>-</span>;
  return (
    <Badge variant="secondary" className={`${RANK_COLORS[rank] || 'bg-gray-100 text-gray-800'} rounded-full w-7 h-7 flex items-center justify-center p-0 text-xs font-bold`}>
      {rank}
    </Badge>
  );
}

/* ── main component ───────────────────────────────────── */

export function FacilityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useParkFacility(id ?? null);
  const apiFacility = data?.properties;
  const dummyFacility = id ? getDummyFacility(id) : null;
  const facility = apiFacility || dummyFacility;
  const usingDummy = !apiFacility && !!dummyFacility;
  const facilityGeometry = data?.geometry;

  // Parent park
  const { data: parkData } = useGreenSpace(facility?.greenSpaceRef ?? null);
  const parkGeometry = parkData?.geometry;
  const parkInfo = facility?.greenSpaceRef ? PARK_MAP.get(facility.greenSpaceRef) : undefined;

  // Map
  const miniMapGeometry = parkGeometry || facilityGeometry;
  const isDummyFacility = id?.startsWith('PF-demo-') ?? false;
  const markers = useMemo(() => {
    if (isDummyFacility && parkGeometry) {
      const c = turf.centroid({ type: 'Feature', properties: {}, geometry: parkGeometry } as any).geometry.coordinates;
      return [{ lng: c[0], lat: c[1], color: '#22C55E' }];
    }
    if (facilityGeometry?.type === 'Point') {
      return [{
        lng: (facilityGeometry as GeoJSON.Point).coordinates[0],
        lat: (facilityGeometry as GeoJSON.Point).coordinates[1],
        color: '#22C55E',
      }];
    }
    return [];
  }, [isDummyFacility, parkGeometry, facilityGeometry]);

  // Inspection & repair data (dummy)
  const inspections = useMemo(() => id ? getDummyFacilityInspections(id) : [], [id]);
  const repairs = useMemo(() => id ? getDummyRepairsByFacility(id) : [], [id]);

  // Inspection filters
  const [inspSearch, setInspSearch] = useState('');
  const [inspDate, setInspDate] = useState('');
  const [inspInspector, setInspInspector] = useState('__all__');
  const [inspStructureRank, setInspStructureRank] = useState('__all__');
  const [inspWearRank, setInspWearRank] = useState('__all__');

  // Repair filters
  const [repSearch, setRepSearch] = useState('');
  const [repDate, setRepDate] = useState('');
  const [repRepairer, setRepRepairer] = useState('__all__');

  // Filtered inspections
  const filteredInspections = useMemo(() => {
    return inspections.filter(i => {
      if (inspSearch) {
        const s = inspSearch.toLowerCase();
        if (!i.content.toLowerCase().includes(s) && !(i.structureNotes || '').toLowerCase().includes(s) && !(i.wearNotes || '').toLowerCase().includes(s)) return false;
      }
      if (inspDate && !i.inspectionDate.startsWith(inspDate)) return false;
      if (inspInspector !== '__all__' && i.inspector !== inspInspector) return false;
      if (inspStructureRank !== '__all__' && i.structureRank !== inspStructureRank) return false;
      if (inspWearRank !== '__all__' && i.wearRank !== inspWearRank) return false;
      return true;
    });
  }, [inspections, inspSearch, inspDate, inspInspector, inspStructureRank, inspWearRank]);

  // Filtered repairs
  const filteredRepairs = useMemo(() => {
    return repairs.filter(r => {
      if (repSearch) {
        const s = repSearch.toLowerCase();
        if (
          !(r.mainParts || '').toLowerCase().includes(s) &&
          !r.description.toLowerCase().includes(s) &&
          !(r.designDocNumber || '').toLowerCase().includes(s) &&
          !(r.repairNotes || '').toLowerCase().includes(s)
        ) return false;
      }
      if (repDate && !r.date.startsWith(repDate)) return false;
      if (repRepairer !== '__all__' && r.repairer !== repRepairer) return false;
      return true;
    });
  }, [repairs, repSearch, repDate, repRepairer]);

  // Unique values for dropdowns
  const inspInspectors = useMemo(() => [...new Set(inspections.map(i => i.inspector))], [inspections]);
  const repRepairers = useMemo(() => [...new Set(repairs.filter(r => r.repairer).map(r => r.repairer!))], [repairs]);

  // Breadcrumb
  const locationState = location.state as FacilityDetailLocationState | null;
  const breadcrumbTo = locationState?.breadcrumbFrom?.to || '/assets/facilities';
  const breadcrumbLabel = locationState?.breadcrumbFrom?.label || '施設';

  // Recent visits
  useEffect(() => {
    if (id && facility) {
      const name = facility.name;
      if (name) recordVisit(`/assets/facilities/${id}`, name);
    }
  }, [id, facility]);

  // Cast for dummy-only fields (facilityClassification, subItem, etc.)
  const f = facility as any;
  const statusConfig = facility?.status ? FACILITY_STATUS_CONFIG[facility.status] : undefined;

  return (
    <ScrollArea style={{ height: 'calc(100vh - 60px)' }} data-testid="facility-detail-scroll">
      <Box p="lg">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => {
                  if (location.key !== 'default') navigate(-1);
                  else navigate(breadcrumbTo);
                }}
                className="cursor-pointer"
              >
                {breadcrumbLabel}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>/</BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>
                {facility ? `${facility.name}・${facility.facilityId}` : '読み込み中...'}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <PageState loading={!usingDummy && isLoading} error={!usingDummy && isError} empty={!facility} emptyMessage="施設が見つかりません">
          {facility && (
            <Stack gap="lg">
              {/* ── Top section: Info (left) + Photo/Map (right) ── */}
              <div className="flex gap-6 items-start" data-testid="facility-top-block">
                {/* Left: Info panels */}
                <div className="flex-1 min-w-0">
                  <Paper p="md" className="border border-gray-100">
                    {/* 基本属性 */}
                    <SectionTitle editButton>基本属性</SectionTitle>
                    <InfoRow label="名称" value={facility.name} />
                    <InfoRow
                      label="状態"
                      value={
                        statusConfig ? (
                          <Badge className={`${statusConfig.className} text-xs`}>{statusConfig.label}</Badge>
                        ) : facility.status
                      }
                    />
                    <InfoRow label="施設ID" value={facility.facilityId} />
                    <InfoRow
                      label="施設分類"
                      value={f.facilityClassification
                        ? FACILITY_CLASSIFICATION_LABELS[f.facilityClassification] || f.facilityClassification
                        : undefined}
                    />
                    <InfoRow
                      label="公園名称"
                      value={parkInfo?.displayName || (parkData?.properties as any)?.name}
                      isLink={!!(parkInfo || parkData)}
                      onLinkClick={() => {
                        if (facility.greenSpaceRef) {
                          navigate(`/assets/parks/${facility.greenSpaceRef}`, {
                            state: { breadcrumbFrom: { to: location.pathname, label: facility.name || '施設' } },
                          });
                        }
                      }}
                    />
                    <InfoRow label="細目" value={f.subItem} />
                    <InfoRow label="細目補足" value={f.subItemDetail} />
                    <InfoRow label="主要部材" value={f.mainMaterial || facility.material} />
                    <InfoRow label="数量" value={facility.quantity ? `${facility.quantity} 基` : undefined} />

                    {/* 設置・施工情報 */}
                    <div className="mt-6">
                      <SectionTitle>設置・施工情報</SectionTitle>
                      <InfoRow
                        label="設置年"
                        value={facility.dateInstalled ? new Date(facility.dateInstalled).toLocaleDateString('ja-JP') : undefined}
                      />
                      <InfoRow label="メーカー" value={facility.manufacturer} />
                      <InfoRow label="設置業者" value={f.installer} />
                      <InfoRow label="設計書番号" value={f.designDocNumber} />
                      <InfoRow label="備考" value={f.notes} />
                    </div>
                  </Paper>
                </div>

                {/* Right: Photo + Map */}
                <div className="w-[380px] shrink-0 flex flex-col gap-4" data-testid="facility-media-panel">
                  {/* Photo carousel placeholder */}
                  <Paper p="0" className="border border-gray-100 overflow-hidden relative" style={{ height: 250 }}>
                    <div className="flex items-center justify-center h-full bg-gray-50">
                      <Stack gap="xs" align="center">
                        <IconPhoto size={48} color="#adb5bd" />
                        <Text c="dimmed" size="sm">写真なし</Text>
                      </Stack>
                    </div>
                    {/* Carousel navigation */}
                    <button className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 shadow flex items-center justify-center hover:bg-white" disabled>
                      <IconChevronLeft size={18} className="text-gray-400" />
                    </button>
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 shadow flex items-center justify-center hover:bg-white" disabled>
                      <IconChevronRight size={18} className="text-gray-400" />
                    </button>
                  </Paper>

                  {/* MiniMap */}
                  <div className="relative border border-gray-100 rounded-md overflow-hidden" style={{ height: 250 }}>
                    <MiniMap
                      key={`${id}-${parkGeometry ? 'park' : 'fac'}`}
                      geometry={miniMapGeometry}
                      markers={markers}
                      height={250}
                      fillColor="#22C55E"
                      focusOnMarkers={markers.length > 0}
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button className="w-7 h-7 rounded bg-white/80 shadow flex items-center justify-center hover:bg-white" disabled>
                        <IconPencil size={14} className="text-gray-500" />
                      </button>
                      <button className="w-7 h-7 rounded bg-white/80 shadow flex items-center justify-center hover:bg-white" disabled>
                        <IconMaximize size={14} className="text-gray-500" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 点検履歴 ── */}
              <Paper p="md" className="border border-gray-100" data-testid="facility-inspection-section">
                <SectionTitle>点検履歴</SectionTitle>

                {/* Filter toolbar */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <div className="relative flex-1 min-w-[180px] max-w-[300px]">
                    <IconSearch size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="点検内容,備考"
                      value={inspSearch}
                      onChange={e => setInspSearch(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                  <Input
                    type="date"
                    value={inspDate}
                    onChange={e => setInspDate(e.target.value)}
                    className="h-9 w-[160px]"
                    placeholder="点検年月日"
                  />
                  <Select value={inspInspector} onValueChange={setInspInspector}>
                    <SelectTrigger className="h-9 w-[140px]">
                      <SelectValue placeholder="点検実施者" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">点検実施者</SelectItem>
                      {inspInspectors.map(i => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={inspStructureRank} onValueChange={setInspStructureRank}>
                    <SelectTrigger className="h-9 w-[130px]">
                      <SelectValue placeholder="構造ランク" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">構造ランク</SelectItem>
                      {['A', 'B', 'C', 'D'].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={inspWearRank} onValueChange={setInspWearRank}>
                    <SelectTrigger className="h-9 w-[130px]">
                      <SelectValue placeholder="消耗ランク" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">消耗ランク</SelectItem>
                      {['A', 'B', 'C', 'D'].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 text-xs whitespace-nowrap"
                    onClick={() => {
                      setInspSearch('');
                      setInspDate('');
                      setInspInspector('__all__');
                      setInspStructureRank('__all__');
                      setInspWearRank('__all__');
                    }}
                  >
                    すべてクリア
                  </Button>
                </div>

                {/* Inspection table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">ID</TableHead>
                        <TableHead className="w-[110px]">点検年月日</TableHead>
                        <TableHead>点検実施者</TableHead>
                        <TableHead>点検内容</TableHead>
                        <TableHead className="w-[90px] text-center">構造ランク</TableHead>
                        <TableHead>構造部材備考</TableHead>
                        <TableHead className="w-[90px] text-center">消耗ランク</TableHead>
                        <TableHead>消耗部材備考</TableHead>
                        <TableHead className="w-[40px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInspections.length > 0 ? (
                        filteredInspections.map(insp => (
                          <TableRow key={insp.id} data-testid="inspection-row">
                            <TableCell className="font-medium">{insp.id}</TableCell>
                            <TableCell>{new Date(insp.inspectionDate).toLocaleDateString('ja-JP')}</TableCell>
                            <TableCell>{insp.inspector}</TableCell>
                            <TableCell>{insp.content}</TableCell>
                            <TableCell className="text-center">
                              <RankBadge rank={insp.structureRank} />
                            </TableCell>
                            <TableCell>{insp.structureNotes || '-'}</TableCell>
                            <TableCell className="text-center">
                              <RankBadge rank={insp.wearRank} />
                            </TableCell>
                            <TableCell>{insp.wearNotes || '-'}</TableCell>
                            <TableCell>
                              <CircleArrowRight size={20} className="text-gray-400" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                            点検履歴データはありません
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Paper>

              {/* ── 補修履歴 ── */}
              <Paper p="md" className="border border-gray-100" data-testid="facility-repair-section">
                <SectionTitle>補修履歴</SectionTitle>

                {/* Filter toolbar */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <div className="relative flex-1 min-w-[180px] max-w-[300px]">
                    <IconSearch size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      placeholder="主な交換部材,補修内容,設計書番号,備考"
                      value={repSearch}
                      onChange={e => setRepSearch(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                  <Input
                    type="date"
                    value={repDate}
                    onChange={e => setRepDate(e.target.value)}
                    className="h-9 w-[160px]"
                    placeholder="補修年月日"
                  />
                  <Select value={repRepairer} onValueChange={setRepRepairer}>
                    <SelectTrigger className="h-9 w-[140px]">
                      <SelectValue placeholder="補修業者" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">補修業者</SelectItem>
                      {repRepairers.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 text-xs whitespace-nowrap"
                    onClick={() => {
                      setRepSearch('');
                      setRepDate('');
                      setRepRepairer('__all__');
                    }}
                  >
                    すべてクリア
                  </Button>
                </div>

                {/* Repair table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">ID</TableHead>
                        <TableHead className="w-[110px]">補修年月日</TableHead>
                        <TableHead>主な交換部材</TableHead>
                        <TableHead>補修業者</TableHead>
                        <TableHead>補修内容</TableHead>
                        <TableHead>補修備考</TableHead>
                        <TableHead className="w-[100px]">設計書番号</TableHead>
                        <TableHead className="w-[40px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRepairs.length > 0 ? (
                        filteredRepairs.map(rep => (
                          <TableRow
                            key={rep.id}
                            data-testid="repair-row"
                            onClick={rep.caseId ? () => navigate(`/cases/${rep.caseId}`, {
                              state: { breadcrumbFrom: { to: location.pathname, label: facility.name || '施設' } },
                            }) : undefined}
                            style={rep.caseId ? { cursor: 'pointer' } : undefined}
                          >
                            <TableCell className="font-medium">{rep.id}</TableCell>
                            <TableCell>{new Date(rep.date).toLocaleDateString('ja-JP')}</TableCell>
                            <TableCell>{rep.mainParts || '-'}</TableCell>
                            <TableCell>{rep.repairer || '-'}</TableCell>
                            <TableCell>{rep.description}</TableCell>
                            <TableCell>{rep.repairNotes || '-'}</TableCell>
                            <TableCell>{rep.designDocNumber || '-'}</TableCell>
                            <TableCell>
                              <CircleArrowRight size={20} className="text-gray-400" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                            補修履歴データはありません
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Paper>
            </Stack>
          )}
        </PageState>
      </Box>
    </ScrollArea>
  );
}
