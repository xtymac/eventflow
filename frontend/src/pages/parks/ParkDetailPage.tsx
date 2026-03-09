import { useState, useEffect, useMemo, useRef, type RefObject } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { IconPencil, IconSearch, IconChevronDown, IconChevronUp, IconMaximize, IconX } from '@tabler/icons-react';
import { CircleArrowRight } from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

import * as turf from '@turf/turf';
import { useGreenSpace, useParkFacilitiesByPark } from '../../hooks/useApi';
import { recordVisit } from '../../hooks/useRecentVisits';
import { useScrollRestore } from '../../hooks/useScrollRestore';
import { PageState } from '../../components/PageState';
import { MiniMap } from '../../components/MiniMap';
import {
  getDummyFacilitiesByPark, FACILITY_CLASSIFICATION_LABELS,
  type DummyFacility,
} from '../../data/dummyFacilities';
import { CURATED_PARKS, type CuratedPark } from '../../data/curatedParks';
import { FacilityPlaceholderImage } from '@/components/facility/FacilityPlaceholderImage';
import { StatusBadge } from '@/components/facility/StatusBadge';
import { RankBadge } from '@/components/facility/RankBadge';
import { UrgencyBadge } from '@/components/facility/UrgencyBadge';

/* ── constants ─────────────────────────────────────────── */

const CURATED_MAP = new Map<string, CuratedPark>(CURATED_PARKS.map(p => [p.id, p]));

const DUMMY_CENTERS: Record<string, { center: [number, number]; areaM2: number }> = Object.fromEntries(
  CURATED_PARKS.map(p => [p.id, { center: centerForPark(p.id), areaM2: p.areaM2 }]),
);

function centerForPark(id: string): [number, number] {
  const map: Record<string, [number, number]> = {
    'GS-zxpnkee2': [136.9213, 35.1575], 'GS-nliigh01': [136.9050, 35.1860],
    'GS-4g77l6x7': [136.9740, 35.1570], 'GS-es1u7z8r': [136.8980, 35.1650],
    'GS-9ego0pvp': [136.8780, 35.2010], 'GS-auy42b1p': [136.9410, 35.0780],
    'GS-gs3xyhbw': [136.8640, 35.1170], 'GS-3d67hwf5': [136.8350, 35.0970],
    'GS-byrogagk': [136.9110, 35.1720], 'GS-ful7d9lw': [136.9340, 35.1870],
    'GS-7f2voyoy': [137.0100, 35.1780], 'GS-x1q5e2te': [137.0200, 35.1650],
    'GS-ldnfwyur': [136.9780, 35.2050], 'GS-9exy95g1': [136.9370, 35.1060],
    'GS-xk4kyf2q': [136.9100, 35.2020], 'GS-cfam78i3': [136.9370, 35.1350],
    'GS-gul3d3ul': [136.9080, 35.1280], 'GS-rtljov09': [136.9430, 35.1710],
  };
  return map[id] || [136.9, 35.15];
}

const MARKER_OFFSETS: Array<[number, number]> = [
  [0.0003, 0.0002], [-0.0002, 0.0003], [0.0002, -0.0002],
  [-0.0003, -0.0002], [0.0004, 0.0001], [-0.0001, 0.0004],
  [0.0003, -0.0003], [-0.0004, 0.0003],
];

/* ── building coverage dummy data ──────────────────────── */

interface CoverageItem {
  type: string;
  property: string;
  buildingArea: number;
  installDate: string;
  inspectionCert: string;
  installPermit: string;
  notes: string;
}

interface CoverageCategory {
  label: string;
  buildingArea: number;
  limitArea: number;
  coverageRate: number;
  buildingAreaDisplay?: string;
  limitAreaDisplay?: string;
  coverageRateDisplay?: string;
  items: CoverageItem[];
}

const BUILDING_COVERAGE: Record<string, CoverageCategory[]> = {
  'GS-4g77l6x7': [
    {
      label: '2%物件(A)',
      buildingArea: 50.94,
      buildingAreaDisplay: '50.94',
      limitArea: 2248,
      limitAreaDisplay: '2,248',
      coverageRate: 0.05,
      coverageRateDisplay: '0.05%',
      items: [
        { type: '便', property: '便所(ゲートボール場)', buildingArea: 17.24, installDate: '1977/03/31', inspectionCert: '有／無', installPermit: '-', notes: '2015/03/05' },
        { type: '便', property: '便所(芝生広場)', buildingArea: 9.24, installDate: '1982/03/26', inspectionCert: '有／無', installPermit: '-', notes: '2015/03/05' },
        { type: '管', property: '器具庫', buildingArea: 1.45, installDate: '2003/03/31', inspectionCert: '有／無', installPermit: '-', notes: 'FRP　児童球技場' },
      ],
    },
    {
      label: '10%物件(B)',
      buildingArea: 187.00,
      buildingAreaDisplay: '187.00',
      limitArea: 26100.00,
      limitAreaDisplay: '26,100.00',
      coverageRate: 0.07,
      coverageRateDisplay: '0.07%',
      items: [],
    },
  ],
  'GS-nliigh01': [
    {
      label: '2%物件(A)', buildingArea: 50.74, limitArea: 2248, coverageRate: 0.05,
      items: [
        { type: '便', property: '便所(ゲートボール場)', buildingArea: 17.24, installDate: '1977/03/31', inspectionCert: '有／無', installPermit: '-', notes: '2015/03/05' },
        { type: '便', property: '便所(芝生広場)', buildingArea: 9.24, installDate: '1982/03/26', inspectionCert: '有／無', installPermit: '-', notes: '2015/03/05' },
        { type: '管', property: '器具庫', buildingArea: 1.45, installDate: '2003/03/31', inspectionCert: '有／無', installPermit: '-', notes: 'FRP　児童球技場' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 187.00, limitArea: 26100.00, coverageRate: 0.07,
      items: [],
    },
  ],
  'GS-zxpnkee2': [
    {
      label: '2%物件(A)', buildingArea: 38.50, limitArea: 4731, coverageRate: 0.01,
      items: [
        { type: '便', property: '便所(正門付近)', buildingArea: 22.30, installDate: '1985/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '管理事務所', buildingArea: 16.20, installDate: '1998/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 142.00, limitArea: 23654.00, coverageRate: 0.01,
      items: [],
    },
  ],
  'GS-cfam78i3': [
    {
      label: '2%物件(A)', buildingArea: 62.18, limitArea: 4797, coverageRate: 0.01,
      items: [
        { type: '便', property: '便所(競技場付近)', buildingArea: 28.50, installDate: '1980/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '便', property: '便所(陸上競技場北)', buildingArea: 18.48, installDate: '1992/03/15', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '器具庫', buildingArea: 15.20, installDate: '2001/03/31', inspectionCert: '有／無', installPermit: '-', notes: 'FRP　野球場横' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 215.00, limitArea: 23984.00, coverageRate: 0.01,
      items: [],
    },
  ],
  'GS-9ego0pvp': [
    {
      label: '2%物件(A)', buildingArea: 78.32, limitArea: 8532, coverageRate: 0.01,
      items: [
        { type: '便', property: '便所(バラ園付近)', buildingArea: 24.80, installDate: '1983/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '便', property: '便所(サイクリングロード)', buildingArea: 19.52, installDate: '1990/03/31', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '管理事務所', buildingArea: 34.00, installDate: '1982/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 320.00, limitArea: 42662.00, coverageRate: 0.01,
      items: [],
    },
  ],
  'GS-9exy95g1': [
    {
      label: '2%物件(A)', buildingArea: 22.40, limitArea: 1305, coverageRate: 0.02,
      items: [
        { type: '便', property: '便所(広場付近)', buildingArea: 14.20, installDate: '1988/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '器具庫', buildingArea: 8.20, installDate: '2005/03/31', inspectionCert: '有／無', installPermit: '-', notes: 'FRP' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 58.00, limitArea: 6524.00, coverageRate: 0.01,
      items: [],
    },
  ],
  'GS-rtljov09': [
    {
      label: '2%物件(A)', buildingArea: 25.60, limitArea: 1173, coverageRate: 0.02,
      items: [
        { type: '便', property: '便所(ユリ園付近)', buildingArea: 16.80, installDate: '1975/04/01', inspectionCert: '有／無', installPermit: '-', notes: '2018/06/10' },
        { type: '管', property: '倉庫', buildingArea: 8.80, installDate: '2000/03/31', inspectionCert: '有／無', installPermit: '-', notes: '' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 48.00, limitArea: 5866.00, coverageRate: 0.01,
      items: [],
    },
  ],
  'GS-xk4kyf2q': [
    {
      label: '2%物件(A)', buildingArea: 18.90, limitArea: 1034, coverageRate: 0.02,
      items: [
        { type: '便', property: '便所(児童遊園)', buildingArea: 12.50, installDate: '1979/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '器具庫', buildingArea: 6.40, installDate: '2003/03/31', inspectionCert: '有／無', installPermit: '-', notes: 'FRP' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 42.00, limitArea: 5171.00, coverageRate: 0.01,
      items: [],
    },
  ],
  'GS-es1u7z8r': [
    {
      label: '2%物件(A)', buildingArea: 45.30, limitArea: 1786, coverageRate: 0.03,
      items: [
        { type: '便', property: '便所(科学館側)', buildingArea: 20.10, installDate: '1976/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '便', property: '便所(噴水広場)', buildingArea: 15.20, installDate: '1988/03/31', inspectionCert: '有／無', installPermit: '-', notes: '2016/05/20' },
        { type: '管', property: '管理事務所', buildingArea: 10.00, installDate: '1995/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 85.00, limitArea: 8930.00, coverageRate: 0.01,
      items: [],
    },
  ],
  'GS-gul3d3ul': [
    {
      label: '2%物件(A)', buildingArea: 30.80, limitArea: 1562, coverageRate: 0.02,
      items: [
        { type: '便', property: '便所(参道付近)', buildingArea: 18.30, installDate: '1981/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '休憩所', buildingArea: 12.50, installDate: '1996/03/31', inspectionCert: '有／無', installPermit: '-', notes: '' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 68.00, limitArea: 7811.00, coverageRate: 0.01,
      items: [],
    },
  ],
  'GS-byrogagk': [
    {
      label: '2%物件(A)', buildingArea: 52.40, limitArea: 2115, coverageRate: 0.02,
      items: [
        { type: '便', property: '便所(テレビ塔付近)', buildingArea: 22.40, installDate: '1978/04/01', inspectionCert: '有／無', installPermit: '-', notes: '2017/09/15' },
        { type: '便', property: '便所(セントラルパーク側)', buildingArea: 18.00, installDate: '1985/03/31', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '管理事務所', buildingArea: 12.00, installDate: '2002/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 98.00, limitArea: 10574.00, coverageRate: 0.01,
      items: [],
    },
  ],
  'GS-gs3xyhbw': [
    {
      label: '2%物件(A)', buildingArea: 55.20, limitArea: 4744, coverageRate: 0.01,
      items: [
        { type: '便', property: '便所(ガーデンプラザ)', buildingArea: 21.60, installDate: '1986/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '便', property: '便所(多目的広場)', buildingArea: 17.80, installDate: '1993/03/31', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '管理事務所', buildingArea: 15.80, installDate: '1987/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 195.00, limitArea: 23721.00, coverageRate: 0.01,
      items: [],
    },
  ],
  'GS-auy42b1p': [
    {
      label: '2%物件(A)', buildingArea: 120.50, limitArea: 22049, coverageRate: 0.01,
      items: [
        { type: '便', property: '便所(若草山)', buildingArea: 28.30, installDate: '1972/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '便', property: '便所(恐竜広場)', buildingArea: 24.80, installDate: '1985/03/31', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '便', property: '便所(竹林散策路)', buildingArea: 16.40, installDate: '1990/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '管理事務所', buildingArea: 35.00, installDate: '1978/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '防災倉庫', buildingArea: 16.00, installDate: '2010/03/31', inspectionCert: '有／無', installPermit: '-', notes: '' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 580.00, limitArea: 110243.00, coverageRate: 0.01,
      items: [],
    },
  ],
  'GS-3d67hwf5': [
    {
      label: '2%物件(A)', buildingArea: 72.60, limitArea: 7282, coverageRate: 0.01,
      items: [
        { type: '便', property: '便所(とだがわこどもランド)', buildingArea: 26.80, installDate: '1991/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '便', property: '便所(フラワーセンター)', buildingArea: 22.40, installDate: '1995/03/31', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '器具庫', buildingArea: 23.40, installDate: '1993/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 285.00, limitArea: 36408.00, coverageRate: 0.01,
      items: [],
    },
  ],
  'GS-ful7d9lw': [
    {
      label: '2%物件(A)', buildingArea: 20.80, limitArea: 1101, coverageRate: 0.02,
      items: [
        { type: '便', property: '便所(黒門付近)', buildingArea: 12.80, installDate: '1983/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '売店', buildingArea: 8.00, installDate: '2004/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 45.00, limitArea: 5503.00, coverageRate: 0.01,
      items: [],
    },
  ],
  'GS-7f2voyoy': [
    {
      label: '2%物件(A)', buildingArea: 85.40, limitArea: 12626, coverageRate: 0.01,
      items: [
        { type: '便', property: '便所(棚田付近)', buildingArea: 20.60, installDate: '1984/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '便', property: '便所(展望台付近)', buildingArea: 18.20, installDate: '1991/03/31', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '管理事務所', buildingArea: 28.60, installDate: '1980/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '防災倉庫', buildingArea: 18.00, installDate: '2008/03/31', inspectionCert: '有／無', installPermit: '-', notes: '' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 420.00, limitArea: 63130.00, coverageRate: 0.01,
      items: [],
    },
  ],
  'GS-x1q5e2te': [
    {
      label: '2%物件(A)', buildingArea: 95.60, limitArea: 27038, coverageRate: 0.00,
      items: [
        { type: '便', property: '便所(北入口)', buildingArea: 22.80, installDate: '1982/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '便', property: '便所(池畔)', buildingArea: 19.60, installDate: '1989/03/31', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '便', property: '便所(南広場)', buildingArea: 15.20, installDate: '1995/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '管理事務所', buildingArea: 22.00, installDate: '1984/04/01', inspectionCert: '有／無', installPermit: '-', notes: '' },
        { type: '管', property: '器具庫', buildingArea: 16.00, installDate: '2002/03/31', inspectionCert: '有／無', installPermit: '-', notes: 'FRP' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 650.00, limitArea: 135190.00, coverageRate: 0.00,
      items: [],
    },
  ],
  'GS-ldnfwyur': [
    {
      label: '2%物件(A)', buildingArea: 32.40, limitArea: 2633, coverageRate: 0.01,
      items: [
        { type: '便', property: '便所(本園)', buildingArea: 18.40, installDate: '1974/04/01', inspectionCert: '有／無', installPermit: '-', notes: '2019/03/20' },
        { type: '管', property: '器具庫', buildingArea: 14.00, installDate: '1998/03/31', inspectionCert: '有／無', installPermit: '-', notes: 'FRP' },
      ],
    },
    {
      label: '10%物件(B)', buildingArea: 105.00, limitArea: 13166.00, coverageRate: 0.01,
      items: [],
    },
  ],
};

/* ── helpers ────────────────────────────────────────────── */

function makeApproxPolygon(center: [number, number], areaM2: number) {
  const side = Math.sqrt(areaM2);
  const latDeg = (side / 2) / 111000;
  const lngDeg = (side / 2) / (111000 * Math.cos((center[1] * Math.PI) / 180));
  const [lng, lat] = center;
  return {
    type: 'Polygon' as const,
    coordinates: [[
      [lng - lngDeg, lat - latDeg], [lng + lngDeg, lat - latDeg],
      [lng + lngDeg, lat + latDeg], [lng - lngDeg, lat + latDeg],
      [lng - lngDeg, lat - latDeg],
    ]],
  };
}

function formatDate(d?: string) {
  if (!d) return '-';
  return d.replace(/-/g, '/');
}

function formatCoverageBuildingArea(cat: CoverageCategory) {
  return cat.buildingAreaDisplay || cat.buildingArea.toFixed(2);
}

function formatCoverageLimitArea(cat: CoverageCategory) {
  return cat.limitAreaDisplay || cat.limitArea.toLocaleString(undefined, { minimumFractionDigits: 2 });
}

function formatCoverageRate(cat: CoverageCategory) {
  return cat.coverageRateDisplay || `${cat.coverageRate.toFixed(2)}%`;
}

/* ── small UI components ───────────────────────────────── */

const fieldRowCls = 'flex items-start justify-between py-2.5 border-b border-[#f0f0f0] text-sm';
const fieldLabelCls = 'text-[#737373] shrink-0';
const fieldValueCls = 'text-right text-[#0a0a0a] ml-4 font-medium';
const sectionTitleCls = 'text-sm font-semibold text-[#0a0a0a] mt-6 mb-2';

function FieldRow({ label, value, multiline }: { label: string; value: string | number | null | undefined; multiline?: boolean }) {
  const display = value === null || value === undefined || value === '' ? '-' : String(value);
  return (
    <div className={fieldRowCls}>
      <span className={fieldLabelCls}>{label}</span>
      <span className={`${fieldValueCls}${multiline ? ' whitespace-pre-line' : ''}`}>{display}</span>
    </div>
  );
}

/* StatusBadge, FacilityPlaceholderImage, RankBadge, UrgencyBadge imported from @/components/facility */

/* ── table column config ───────────────────────────────── */

const thCls = 'text-xs text-[#737373] font-medium whitespace-nowrap';
const tdCls = 'text-xs text-[#0a0a0a] whitespace-nowrap';
const tdDimCls = 'text-xs text-[#a3a3a3] whitespace-nowrap';

const stickyRightStyle: React.CSSProperties = {
  position: 'sticky',
  right: 0,
  backgroundColor: 'white',
  boxShadow: '-4px 0 8px -4px rgba(0,0,0,0.08)',
};

/** Column widths – total determines horizontal scroll extent */
const COL = {
  thumb: 64, name: 80, status: 72, facilityId: 72, classification: 72,
  subItem: 72, subItemDetail: 72, quantity: 52, installDate: 92,
  elapsedYears: 64, manufacturer: 72, installer: 72, mainMaterial: 120,
  designDoc: 80, inspectionDate: 92, structureRank: 72, wearRank: 72,
  repairDate: 92, managementType: 72, urgency: 72, countermeasure: 72,
  plannedYear: 80, estimatedCost: 90, notes: 200, actions: 48,
} as const;

const TOTAL_WIDTH = Object.values(COL).reduce((s, w) => s + w, 0);

/* ── main component ────────────────────────────────────── */

export function ParkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { breadcrumbFrom?: { to?: string; label?: string } } | null;
  const breadcrumbTo = locationState?.breadcrumbFrom?.to || '/assets/parks';
  const breadcrumbLabel = locationState?.breadcrumbFrom?.label || '公園';

  /* Layout refs */
  const pageScrollRef = useRef<HTMLDivElement>(null);
  useScrollRestore(pageScrollRef as RefObject<HTMLElement>);
  const leftInfoScrollRef = useRef<HTMLDivElement>(null);
  const mapPanelRef = useRef<HTMLDivElement>(null);
  const topBlockRef = useRef<HTMLDivElement>(null);

  /** Seamless scroll chaining: when the left info panel hits its scroll
   *  boundary, temporarily disable its overflow so the wheel event
   *  naturally bubbles to the page scroll container. */
  useEffect(() => {
    const panel = leftInfoScrollRef.current;
    if (!panel) return;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function onWheel(e: WheelEvent) {
      const EPSILON = 1;
      const atTop = panel!.scrollTop <= EPSILON;
      const atBottom = panel!.scrollTop + panel!.clientHeight >= panel!.scrollHeight - EPSILON;
      const scrollingDown = e.deltaY > 0;

      if ((scrollingDown && atBottom) || (!scrollingDown && atTop)) {
        panel!.style.overflowY = 'hidden';
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { panel!.style.overflowY = 'auto'; }, 80);
      }
    }

    panel.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      panel.removeEventListener('wheel', onWheel);
      if (timer) clearTimeout(timer);
    };
  }, []);

  /* API data */
  const { data: parkData, isLoading, isError } = useGreenSpace(id ?? null);
  const { data: facilitiesData, isLoading: facilitiesLoading } = useParkFacilitiesByPark(id ?? null);

  /* Resolve park: API → curated → fallback */
  const apiPark = parkData?.properties;
  const curatedPark = id ? CURATED_MAP.get(id) : undefined;
  const park = apiPark || curatedPark;
  const usingDummy = !apiPark && !!curatedPark;

  /* Geometry */
  const dummyInfo = id ? DUMMY_CENTERS[id] : undefined;
  const geometry = parkData?.geometry
    || (!isLoading && usingDummy && dummyInfo
      ? makeApproxPolygon(dummyInfo.center, dummyInfo.areaM2)
      : undefined);

  /* Facilities */
  const apiFacilities = facilitiesData?.features || [];
  const centroid = geometry
    ? turf.centroid({ type: 'Feature', properties: {}, geometry } as any).geometry.coordinates
    : dummyInfo?.center || null;

  const dummyFacilities = useMemo(() => {
    if (!id) return [];
    return getDummyFacilitiesByPark(id).map((f, i) => ({
      properties: f,
      geometry: {
        type: 'Point' as const,
        coordinates: centroid
          ? [centroid[0] + MARKER_OFFSETS[i % MARKER_OFFSETS.length][0], centroid[1] + MARKER_OFFSETS[i % MARKER_OFFSETS.length][1]]
          : [136.9, 35.15],
      },
    }));
  }, [id, centroid]);

  const facilities = dummyFacilities.length > 0 ? dummyFacilities : apiFacilities;
  const parkName = (curatedPark?.displayName || apiPark?.displayName || apiPark?.nameJa || apiPark?.name || '読み込み中...');

  /* Record visit */
  useEffect(() => {
    if (id && parkName && parkName !== '読み込み中...') {
      recordVisit(`/assets/parks/${id}`, parkName);
    }
  }, [id, parkName]);

  /* Facility filter state */
  // Breadcrumb shadow on scroll
  const [isScrolled, setIsScrolled] = useState(false);
  useEffect(() => {
    const el = pageScrollRef.current;
    if (!el) return;
    const onScroll = () => setIsScrolled(el.scrollTop > 0);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterClassification, setFilterClassification] = useState('__all__');
  const [filterStructureRank, setFilterStructureRank] = useState('__all__');
  const [filterWearRank, setFilterWearRank] = useState('__all__');

  const filteredFacilities = useMemo(() => {
    return facilities.filter((f: any) => {
      const p: DummyFacility = f.properties;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!((p.name?.toLowerCase().includes(q)) || (p.facilityId?.toLowerCase().includes(q)))) return false;
      }
      if (filterClassification !== '__all__' && p.facilityClassification !== filterClassification) return false;
      if (filterStructureRank !== '__all__' && p.structureRank !== filterStructureRank) return false;
      if (filterWearRank !== '__all__' && p.wearRank !== filterWearRank) return false;
      return true;
    });
  }, [facilities, searchQuery, filterClassification, filterStructureRank, filterWearRank]);

  const clearFilters = () => {
    setSearchQuery('');
    setFilterClassification('__all__');
    setFilterStructureRank('__all__');
    setFilterWearRank('__all__');
  };

  const hasActiveFilters = searchQuery || filterClassification !== '__all__' || filterStructureRank !== '__all__' || filterWearRank !== '__all__';

  /* Map markers */
  const [hoveredFacilityIndex, setHoveredFacilityIndex] = useState<number | null>(null);
  const [selectedFacilityIndex, setSelectedFacilityIndex] = useState<number | null>(null);
  const [fullscreenMap, setFullscreenMap] = useState(false);

  const facilityMarkers = useMemo(() => {
    const markers: Array<{ lng: number; lat: number }> = [];
    facilities.forEach((f: any) => {
      if (f.geometry?.type !== 'Point') return;
      markers.push({ lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] });
    });
    return markers;
  }, [facilities]);

  const facilityToMarkerIdx = useMemo(() => {
    const map = new Map<number, number>();
    let markerIdx = 0;
    facilities.forEach((f: any, i: number) => {
      if (f.geometry?.type !== 'Point') return;
      map.set(i, markerIdx++);
    });
    return map;
  }, [facilities]);

  const facilityDataForMap = useMemo(() => {
    const data: DummyFacility[] = [];
    facilities.forEach((f: any) => {
      if (f.geometry?.type !== 'Point') return;
      data.push(f.properties);
    });
    return data;
  }, [facilities]);

  /* Building coverage */
  const coverageData = id ? (BUILDING_COVERAGE[id] || []) : [];
  const [openCoverage, setOpenCoverage] = useState<Record<number, boolean>>({ 0: true });

  useEffect(() => {
    if (coverageData.length > 0) {
      setOpenCoverage({ 0: true });
      return;
    }
    setOpenCoverage({});
  }, [id, coverageData.length]);

  /* Navigate to facility */
  const goToFacility = (facilityId: string) => {
    navigate(`/assets/facilities/${facilityId}`, {
      state: { breadcrumbFrom: { to: `/assets/parks/${id}`, label: parkName } },
    });
  };

  return (
    <div ref={pageScrollRef} data-testid="park-detail-scroll-root" className="h-[calc(100vh-60px)] w-full max-w-full overflow-y-auto overflow-x-hidden scrollbar-hidden">
      {/* Sticky breadcrumb bar */}
      <div
        className="sticky top-0 z-10 px-6 py-3 transition-shadow duration-200"
        style={{
          background: '#FFF',
          boxShadow: isScrolled ? '0 4px 6px -1px rgba(0, 0, 0, 0.10), 0 2px 4px -2px rgba(0, 0, 0, 0.10)' : 'none',
        }}
      >
        <Breadcrumb>
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
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{parkName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="p-6 w-full max-w-full overflow-x-hidden">
        <PageState loading={!usingDummy && isLoading} error={!usingDummy && isError} empty={!park} emptyMessage="公園が見つかりません">
          {park && (
              <div className="flex flex-col gap-6">
                {/* ═══ Top block: info + map side-by-side ═══ */}
                <div ref={topBlockRef} data-testid="park-detail-top-block" className="flex gap-6">
                {/* Left: Park info sections */}
                <div ref={leftInfoScrollRef} data-testid="park-basic-info-scroll" className="flex-1 min-w-0 max-h-[calc(100vh-156px)] overflow-y-auto sticky top-[48px] scrollbar-hidden">
                  {/* 基本情報 */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-[#0a0a0a]">基本情報</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <IconPencil size={16} />
                    </Button>
                  </div>
                  <FieldRow label="No" value={curatedPark?.no || (park as any).no} />
                  <FieldRow label="公園名称" value={parkName} />
                  <FieldRow label="種別" value={curatedPark?.category || (park as any).greenSpaceType} />
                  <FieldRow label="行政区" value={curatedPark?.ward || (park as any).ward} />
                  <FieldRow
                    label="所在地"
                    value={curatedPark?.address || (park as any).address}
                    multiline
                  />
                  <FieldRow label="学区名" value={curatedPark?.schoolDistrict || (park as any).schoolDistrict} />

                  {/* 計画・規模・履歴 */}
                  <p className={sectionTitleCls}>計画・規模・履歴</p>
                  <FieldRow label="面積, ha" value={curatedPark?.areaHa?.toFixed(2) || (park as any).areaM2 ? ((park as any).areaM2 / 10000).toFixed(2) : null} />
                  <FieldRow label="開園年度" value={curatedPark?.openingYear} />
                  <FieldRow label="設置年月日" value={curatedPark?.establishedDate} />
                  <FieldRow label="計画番号" value={curatedPark?.planNumber} />
                  <FieldRow label="計画面積, ha" value={curatedPark?.plannedAreaHa?.toFixed(2)} />
                  <FieldRow label="計画決定日" value={curatedPark?.planDecisionDate} />
                  <FieldRow label="取得方法" value={curatedPark?.acquisitionMethod} />

                  {/* 施設・備考 */}
                  <p className={sectionTitleCls}>施設・備考</p>
                  <FieldRow label="有料施設" value={curatedPark?.paidFacility} />
                  <FieldRow label="防災施設" value={curatedPark?.disasterFacility} />
                  <FieldRow label="備考" value={curatedPark?.notes?.replace(/<br>/g, '\n')} multiline />
                </div>
                {/* end park-basic-info-scroll */}

                {/* Right: Map */}
                <div ref={mapPanelRef} data-testid="park-mini-map-panel" className="w-[45%] shrink-0 sticky top-[48px]">
                  {geometry ? (
                    <MiniMap
                      key={`${id}-${usingDummy ? 'dummy' : 'api'}-${facilityMarkers.length}`}
                      geometry={geometry}
                      markers={facilityMarkers}
                      height="100%"
                      fillColor="#22C55E"
                      highlightedMarkerIndex={hoveredFacilityIndex != null ? facilityToMarkerIdx.get(hoveredFacilityIndex) ?? null : null}
                      facilityData={facilityDataForMap}
                      selectedMarkerIndex={selectedFacilityIndex}
                      onMarkerClick={(idx) => setSelectedFacilityIndex(idx >= 0 ? idx : null)}
                    />
                  ) : centroid ? (
                    <MiniMap
                      center={centroid as [number, number]}
                      markers={[{ lng: centroid[0], lat: centroid[1] }, ...facilityMarkers]}
                      zoom={15}
                      height="100%"
                      highlightedMarkerIndex={hoveredFacilityIndex != null ? (facilityToMarkerIdx.get(hoveredFacilityIndex) ?? -1) + 1 : null}
                      facilityData={facilityDataForMap}
                      selectedMarkerIndex={selectedFacilityIndex != null ? selectedFacilityIndex + 1 : null}
                      onMarkerClick={(idx) => setSelectedFacilityIndex(idx > 0 ? idx - 1 : null)}
                    />
                  ) : null}
                  {/* Edit + Fullscreen overlay buttons */}
                  <div className="absolute top-4 right-14 z-[5] flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/assets/parks/${id}/geometry`)}
                      title="ジオメトリ編集"
                      className="flex items-center justify-center size-10 rounded-full bg-[#f5f5f5] shadow-lg hover:bg-white transition-colors cursor-pointer"
                    >
                      <IconPencil size={16} className="text-[#0a0a0a]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFullscreenMap(true)}
                      title="全画面表示"
                      className="flex items-center justify-center size-10 rounded-full bg-[#f5f5f5] shadow-lg hover:bg-white transition-colors cursor-pointer"
                    >
                      <IconMaximize size={16} className="text-[#0a0a0a]" />
                    </button>
                  </div>
                </div>
                </div>
                {/* end park-detail-top-block */}

              {/* ═══ Facilities section ═══ */}
              <div data-testid="park-facilities-section" className="bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 w-full min-w-0 max-w-full overflow-hidden">
                <p className="font-semibold text-base mb-3">施設</p>

                {/* Search + filter toolbar */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="relative w-[280px] shrink-0">
                    <IconSearch size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
                    <Input
                      placeholder="名称, 施設ID, 備考"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>

                  <Select value={filterClassification} onValueChange={setFilterClassification}>
                    <SelectTrigger size="sm" className="w-[130px] shrink-0">
                      <SelectValue placeholder="施設分類" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">施設分類</SelectItem>
                      {Object.entries(FACILITY_CLASSIFICATION_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterStructureRank} onValueChange={setFilterStructureRank}>
                    <SelectTrigger size="sm" className="w-[140px] shrink-0">
                      <SelectValue placeholder="構造ランク" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">構造ランク</SelectItem>
                      {['A', 'B', 'C', 'D'].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterWearRank} onValueChange={setFilterWearRank}>
                    <SelectTrigger size="sm" className="w-[140px] shrink-0">
                      <SelectValue placeholder="消耗ランク" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">消耗ランク</SelectItem>
                      {['A', 'B', 'C', 'D'].map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs text-[#737373] hover:text-[#0a0a0a] transition-colors cursor-pointer bg-transparent border-none px-2 py-1 whitespace-nowrap shrink-0"
                  >
                    すべてクリア
                  </button>
                </div>

                {/* Facilities table — horizontal scroll */}
                <div className="px-1 pb-2 text-[11px] text-[#a3a3a3]">左右にスクロールして全列を表示</div>
                <PageState loading={!usingDummy && facilitiesLoading} empty={filteredFacilities.length === 0} emptyMessage={hasActiveFilters ? '条件に一致する施設がありません' : 'この公園に施設はありません'}>
                  <div className="w-full max-w-full">
                    <div
                      className="w-full"
                      style={{
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        maxWidth: '100%',
                        scrollbarGutter: 'stable both-edges',
                        WebkitOverflowScrolling: 'touch',
                      }}
                    >
                      <table
                        data-testid="park-facilities-table"
                        className="caption-bottom text-sm"
                        style={{ width: TOTAL_WIDTH, minWidth: TOTAL_WIDTH }}
                      >
                      <TableHeader>
                        <TableRow className="bg-[#fafafa] hover:bg-[#fafafa]">
                          <TableHead style={{ width: COL.thumb, minWidth: COL.thumb }} />
                          <TableHead className={thCls} style={{ width: COL.name, minWidth: COL.name }} />
                          <TableHead className={`${thCls} text-center`} style={{ width: COL.status, minWidth: COL.status }}>状態</TableHead>
                          <TableHead className={thCls} style={{ width: COL.facilityId, minWidth: COL.facilityId }}>施設ID</TableHead>
                          <TableHead className={thCls} style={{ width: COL.classification, minWidth: COL.classification }}>施設分類</TableHead>
                          <TableHead className={thCls} style={{ width: COL.subItem, minWidth: COL.subItem }}>細目</TableHead>
                          <TableHead className={thCls} style={{ width: COL.subItemDetail, minWidth: COL.subItemDetail }}>細目補足</TableHead>
                          <TableHead className={`${thCls} text-center`} style={{ width: COL.quantity, minWidth: COL.quantity }}>数量</TableHead>
                          <TableHead className={thCls} style={{ width: COL.installDate, minWidth: COL.installDate }}>設置年</TableHead>
                          <TableHead className={`${thCls} text-center`} style={{ width: COL.elapsedYears, minWidth: COL.elapsedYears }}>経過年数</TableHead>
                          <TableHead className={thCls} style={{ width: COL.manufacturer, minWidth: COL.manufacturer }}>メーカー</TableHead>
                          <TableHead className={thCls} style={{ width: COL.installer, minWidth: COL.installer }}>設置業者</TableHead>
                          <TableHead className={thCls} style={{ width: COL.mainMaterial, minWidth: COL.mainMaterial }}>主要部材</TableHead>
                          <TableHead className={thCls} style={{ width: COL.designDoc, minWidth: COL.designDoc }}>設計書番号</TableHead>
                          <TableHead className={thCls} style={{ width: COL.inspectionDate, minWidth: COL.inspectionDate }}>最近点検日</TableHead>
                          <TableHead className={`${thCls} text-center`} style={{ width: COL.structureRank, minWidth: COL.structureRank }}>構造ランク</TableHead>
                          <TableHead className={`${thCls} text-center`} style={{ width: COL.wearRank, minWidth: COL.wearRank }}>消耗ランク</TableHead>
                          <TableHead className={thCls} style={{ width: COL.repairDate, minWidth: COL.repairDate }}>直近修理日</TableHead>
                          <TableHead className={thCls} style={{ width: COL.managementType, minWidth: COL.managementType }}>管理種別</TableHead>
                          <TableHead className={`${thCls} text-center`} style={{ width: COL.urgency, minWidth: COL.urgency }}>緊急度判定</TableHead>
                          <TableHead className={thCls} style={{ width: COL.countermeasure, minWidth: COL.countermeasure }}>対策内容</TableHead>
                          <TableHead className={thCls} style={{ width: COL.plannedYear, minWidth: COL.plannedYear }}>実施予定年</TableHead>
                          <TableHead className={`${thCls} text-right`} style={{ width: COL.estimatedCost, minWidth: COL.estimatedCost }}>概算費用</TableHead>
                          <TableHead className={thCls} style={{ width: COL.notes, minWidth: COL.notes }}>備考</TableHead>
                          <TableHead style={{ width: COL.actions, minWidth: COL.actions, ...stickyRightStyle, zIndex: 20 }} className="bg-[#fafafa]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredFacilities.map((f: any, i: number) => {
                          const p: DummyFacility = f.properties;
                          return (
                            <TableRow
                              key={p.id}
                              className="cursor-pointer hover:bg-[#f5f5f5] transition-colors"
                              onClick={() => goToFacility(p.id)}
                              onMouseEnter={() => setHoveredFacilityIndex(i)}
                              onMouseLeave={() => setHoveredFacilityIndex(null)}
                            >
                              <TableCell className="p-2" style={{ width: COL.thumb, minWidth: COL.thumb }}>
                                <FacilityPlaceholderImage category={p.category} />
                              </TableCell>
                              <TableCell className="text-sm font-medium text-[#0a0a0a] p-2" style={{ width: COL.name, minWidth: COL.name }}>
                                {p.name}
                              </TableCell>
                              <TableCell className="text-center p-2" style={{ width: COL.status, minWidth: COL.status }}>
                                <StatusBadge status={p.status} />
                              </TableCell>
                              <TableCell className={`${tdCls} p-2`}>{p.facilityId || '-'}</TableCell>
                              <TableCell className={`${tdCls} p-2`}>
                                {p.facilityClassification ? (FACILITY_CLASSIFICATION_LABELS[p.facilityClassification] || p.facilityClassification) : '-'}
                              </TableCell>
                              <TableCell className={`${tdCls} p-2`}>{p.subItem || '-'}</TableCell>
                              <TableCell className={`${tdDimCls} p-2`}>{p.subItemDetail || '-'}</TableCell>
                              <TableCell className={`${tdCls} p-2 text-center`}>
                                {p.quantity ? `${p.quantity}基` : '-'}
                              </TableCell>
                              <TableCell className={`${tdCls} p-2`}>{formatDate(p.dateInstalled)}</TableCell>
                              <TableCell className={`${tdCls} p-2 text-center`}>{p.designLife ?? '-'}</TableCell>
                              <TableCell className={`${tdDimCls} p-2`}>{p.manufacturer || '-'}</TableCell>
                              <TableCell className={`${tdDimCls} p-2`}>{p.installer || '-'}</TableCell>
                              <TableCell className={`${tdCls} p-2`}>{p.mainMaterial || '-'}</TableCell>
                              <TableCell className={`${tdDimCls} p-2`}>{p.designDocNumber || '-'}</TableCell>
                              <TableCell className={`${tdCls} p-2`}>{formatDate(p.lastInspectionDate)}</TableCell>
                              <TableCell className="p-2 text-center"><RankBadge rank={p.structureRank} /></TableCell>
                              <TableCell className="p-2 text-center"><RankBadge rank={p.wearRank} /></TableCell>
                              <TableCell className={`${tdCls} p-2`}>{p.lastRepairDate || '-'}</TableCell>
                              <TableCell className={`${tdCls} p-2`}>{p.managementType || '-'}</TableCell>
                              <TableCell className="p-2 text-center"><UrgencyBadge level={p.urgencyLevel} /></TableCell>
                              <TableCell className={`${tdCls} p-2`}>{p.countermeasure || '-'}</TableCell>
                              <TableCell className={`${tdCls} p-2`}>{p.plannedYear || '-'}</TableCell>
                              <TableCell className={`${tdCls} p-2 text-right`}>
                                {p.estimatedCost ? `\u00A5${p.estimatedCost.toLocaleString()}` : '-'}
                              </TableCell>
                              <TableCell className={`${tdCls} p-2 max-w-[200px] truncate`}>{p.notes || '-'}</TableCell>
                              <TableCell className="p-2 text-center" style={stickyRightStyle}>
                                <CircleArrowRight
                                  className="size-5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                  onClick={(e) => { e.stopPropagation(); goToFacility(p.id); }}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      </table>
                    </div>
                  </div>
                </PageState>
              </div>

              {/* ═══ Building coverage section (hidden) ═══ */}
              {false && coverageData.length > 0 && (
                <div data-testid="park-coverage-section" className="bg-white border border-[#f5f5f5] rounded-lg shadow-sm p-4 flex flex-col gap-2">
                  <p className="font-mono text-base font-normal text-[#171717]">公園内建ぺい率一覧</p>
                  <div className="flex flex-col gap-4">
                    {coverageData.map((cat, ci) => (
                      <Collapsible
                        key={ci}
                        open={openCoverage[ci] ?? false}
                        onOpenChange={(open) => setOpenCoverage(prev => ({ ...prev, [ci]: open }))}
                      >
                        <div>
                          <CollapsibleTrigger className="w-full flex items-center justify-between py-3 cursor-pointer text-left bg-transparent border-none outline-none">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              {openCoverage[ci] ? <IconChevronUp size={20} /> : <IconChevronDown size={20} />}
                              <span className="text-base font-medium">{cat.label}</span>
                            </div>
                            <div className="flex items-center gap-5 w-[330px]">
                              <div className="flex-1 flex flex-col gap-0.5">
                                <span className="text-xs text-muted-foreground">建築面積m2</span>
                                <span className="text-sm font-medium text-foreground">{formatCoverageBuildingArea(cat)}</span>
                              </div>
                              <div className="flex-1 flex flex-col gap-0.5">
                                <span className="text-xs text-muted-foreground">限度面積 m2</span>
                                <span className="text-sm font-medium text-foreground">{formatCoverageLimitArea(cat)}</span>
                              </div>
                              <div className="flex-1 flex flex-col gap-0.5">
                                <span className="text-xs text-muted-foreground">建ﾍﾟｲ率％</span>
                                <Badge className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full w-fit">
                                  {formatCoverageRate(cat)}
                                </Badge>
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t border-[#e5e5e5] mt-2" />
                            {cat.items.length > 0 ? (
                              <div className="overflow-x-auto">
                                <Table className="w-full">
                                  <TableHeader>
                                    <TableRow className="hover:bg-transparent border-0">
                                      <TableHead className="text-xs text-muted-foreground font-medium h-10 px-2">施設の種別</TableHead>
                                      <TableHead className="text-xs text-muted-foreground font-medium h-10 px-2">物件</TableHead>
                                      <TableHead className="text-xs text-muted-foreground font-medium h-10 px-2">建築面積m2</TableHead>
                                      <TableHead className="text-xs text-muted-foreground font-medium h-10 px-2">設置年月日</TableHead>
                                      <TableHead className="text-xs text-muted-foreground font-medium h-10 px-2">検査済証の有無</TableHead>
                                      <TableHead className="text-xs text-muted-foreground font-medium h-10 px-2">設置許可</TableHead>
                                      <TableHead className="text-xs text-muted-foreground font-medium h-10 px-2">備考</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {cat.items.map((item, ii) => (
                                      <TableRow key={ii} className="bg-[#fafafa] border-b border-[#f5f5f5] last:border-b-0 hover:bg-[#fafafa]">
                                        <TableCell className="text-sm text-foreground h-10 px-2 py-0">{item.type}</TableCell>
                                        <TableCell className="text-sm text-foreground h-10 px-2 py-0">{item.property}</TableCell>
                                        <TableCell className="text-sm text-foreground h-10 px-2 py-0">{item.buildingArea.toFixed(2)}</TableCell>
                                        <TableCell className="text-sm text-foreground h-10 px-2 py-0">{item.installDate}</TableCell>
                                        <TableCell className="text-sm text-foreground h-10 px-2 py-0">{item.inspectionCert}</TableCell>
                                        <TableCell className="text-sm text-foreground h-10 px-2 py-0">{item.installPermit}</TableCell>
                                        <TableCell className="text-sm text-foreground h-10 px-2 py-0">{item.notes || '-'}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                                データなし
                              </div>
                            )}
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                </div>
              )}
              </div>
          )}
        </PageState>
      </div>
      {/* Fullscreen map overlay */}
      {fullscreenMap && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="relative w-full h-full">
            <MiniMap
              geometry={geometry}
              markers={facilityMarkers}
              height="100%"
              fillColor="#22C55E"
              highlightedMarkerIndex={null}
              facilityData={facilityDataForMap}
              selectedMarkerIndex={selectedFacilityIndex}
              onMarkerClick={(idx) => setSelectedFacilityIndex(idx >= 0 ? idx : null)}
            />
            <button
              type="button"
              onClick={() => setFullscreenMap(false)}
              className="absolute top-4 right-4 z-10 flex items-center justify-center size-10 rounded-full bg-white shadow-lg hover:bg-[#f5f5f5] transition-colors cursor-pointer"
            >
              <IconX size={18} className="text-[#0a0a0a]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
