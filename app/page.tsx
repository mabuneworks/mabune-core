'use client';

import { ChangeEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addQueueOp,
  flushSyncQueue,
  getQueueLength,
  isBrowserOnline,
  readPatientRowsCache,
  writePatientRowsCache,
} from '../lib/offline-cache';
import { supabase, supabaseConfigError } from '../lib/supabase';

type MetaSide = '左' | '右';
type MetaPos = '上' | '中' | '下';
type FaceType = '捻れ' | '傾き' | 'スライド';
type ImageKey = 'front' | 'side' | 'back' | 'face';

interface Session {
  date: string;
  amount: number;
  visitNumber: number;
  numericInspections: Record<string, number>;
  metaInspections: {
    顔_左右: MetaSide;
    顔_種類: FaceType;
    肩上_左右: MetaSide;
    軸_左右: MetaSide;
    AS_左右: MetaSide;
    肩捻じれ: MetaSide;
    膝屈曲: { side: MetaSide; cm: number };
    膝屈曲内旋: { side: MetaSide; cm: number };
    首: { side: MetaSide; pos: MetaPos };
    腰: { side: MetaSide; pos: MetaPos };
  };
  totalSum: number;
  beautyScore: number;
  treatmentNote: string;
  selfCare: string;
  bodyMapData: string;
  images: {
    before: Record<ImageKey, string>;
    after: Record<ImageKey, string>;
    comparisons: Record<ImageKey, string>;
  };
}

interface BaseInfo {
  name: string;
  gender: string;
  age: string;
  address: string;
  phone: string;
  /** LINE Messaging API の push 先（患者が公式LINEにメッセージを送ったとき Webhook 等で取得） */
  lineUserId: string;
  history: string;
  surgery: string;
  romLimit: string;
  goals: string;
}

interface Patient {
  id: string;
  name: string;
  base_info: Omit<BaseInfo, 'name'>;
  chart_data: { latest: Session; history: Session[] };
  last_visit: string;
  tags: string[];
}

const numericKeys = ['顔', '肩上', '軸', 'AS', '大転子', '肘', '肩', '耳', '肩内旋左', '肩内旋右'] as const;
const imagePairs: { key: ImageKey; label: string }[] = [
  { key: 'front', label: '前面' },
  { key: 'back', label: '背面' },
  { key: 'side', label: '側面' },
  { key: 'face', label: '顔' },
];

const createInitialSession = (): Session => ({
  date: new Date().toISOString().split('T')[0],
  amount: 0,
  visitNumber: 1,
  numericInspections: {
    顔: 3.5,
    肩上: 3.5,
    軸: 3.5,
    AS: 3.5,
    大転子: 3.5,
    肘: 3.5,
    肩: 3.5,
    耳: 3.5,
    肩内旋左: 3.5,
    肩内旋右: 3.5,
  },
  metaInspections: {
    顔_左右: '左',
    顔_種類: '捻れ',
    肩上_左右: '左',
    軸_左右: '左',
    AS_左右: '左',
    肩捻じれ: '左',
    膝屈曲: { side: '左', cm: 0 },
    膝屈曲内旋: { side: '左', cm: 0 },
    首: { side: '左', pos: '中' },
    腰: { side: '左', pos: '中' },
  },
  totalSum: 0,
  beautyScore: 0,
  treatmentNote: '',
  selfCare: '',
  bodyMapData: '',
  images: {
    before: { front: '', side: '', back: '', face: '' },
    after: { front: '', side: '', back: '', face: '' },
    comparisons: { front: '', side: '', back: '', face: '' },
  },
});

const initialBaseInfo: BaseInfo = {
  name: '',
  gender: '',
  age: '',
  address: '',
  phone: '',
  lineUserId: '',
  history: '',
  surgery: '',
  romLimit: '',
  goals: '',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const num = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const side = (value: unknown): MetaSide => (value === '右' ? '右' : '左');
const pos = (value: unknown): MetaPos => (value === '上' || value === '下' ? value : '中');
const faceType = (value: unknown): FaceType => (value === '傾き' || value === 'スライド' ? value : '捻れ');

function normalizeMeta(raw: unknown): Session['metaInspections'] {
  const base = createInitialSession().metaInspections;
  const m = isRecord(raw) ? raw : {};

  const kneeFlexionRaw = isRecord(m.膝屈曲) ? m.膝屈曲 : isRecord(m.kneeFlexion) ? m.kneeFlexion : {};
  const kneeInternalRaw = isRecord(m.膝屈曲内旋) ? m.膝屈曲内旋 : isRecord(m.kneeInternalRotation) ? m.kneeInternalRotation : {};
  const neckRaw = isRecord(m.首) ? m.首 : isRecord(m.neck) ? m.neck : {};
  const waistRaw = isRecord(m.腰) ? m.腰 : isRecord(m.waist) ? m.waist : {};

  return {
    顔_左右: side(m.顔_左右),
    顔_種類: faceType(m.顔_種類),
    肩上_左右: side(m.肩上_左右),
    軸_左右: side(m.軸_左右),
    AS_左右: side(m.AS_左右),
    肩捻じれ: side(m.肩捻じれ),
    膝屈曲: {
      side: side((kneeFlexionRaw as Record<string, unknown>).side),
      cm: num((kneeFlexionRaw as Record<string, unknown>).cm, base.膝屈曲.cm),
    },
    膝屈曲内旋: {
      side: side((kneeInternalRaw as Record<string, unknown>).side),
      cm: num((kneeInternalRaw as Record<string, unknown>).cm, base.膝屈曲内旋.cm),
    },
    首: {
      side: side((neckRaw as Record<string, unknown>).side),
      pos: pos((neckRaw as Record<string, unknown>).pos),
    },
    腰: {
      side: side((waistRaw as Record<string, unknown>).side),
      pos: pos((waistRaw as Record<string, unknown>).pos),
    },
  };
}

function normalizeImages(raw: unknown): Session['images'] {
  const r = isRecord(raw) ? raw : {};
  const before = isRecord(r.before) ? r.before : {};
  const after = isRecord(r.after) ? r.after : {};
  const comparisons = isRecord(r.comparisons) ? r.comparisons : {};

  return {
    before: {
      front: str(before.front),
      side: str(before.side),
      back: str(before.back),
      face: str(before.face),
    },
    after: {
      front: str(after.front),
      side: str(after.side),
      back: str(after.back),
      face: str(after.face),
    },
    comparisons: {
      front: str(comparisons.front),
      side: str(comparisons.side),
      back: str(comparisons.back),
      face: str(comparisons.face),
    },
  };
}

function normalizeSession(raw: unknown, visitNumberFallback = 1): Session {
  const base = createInitialSession();
  const r = isRecord(raw) ? raw : {};
  const n = isRecord(r.numericInspections) ? r.numericInspections : {};
  const numericInspections = { ...base.numericInspections };
  for (const key of numericKeys) {
    numericInspections[key] = num(n[key], base.numericInspections[key]);
  }

  return {
    ...base,
    date: str(r.date) || base.date,
    amount: num(r.amount, 0),
    visitNumber: Math.max(1, Math.floor(num(r.visitNumber, visitNumberFallback))),
    numericInspections,
    metaInspections: normalizeMeta(r.metaInspections),
    totalSum: num(r.totalSum, 0),
    beautyScore: num(r.beautyScore, 0),
    treatmentNote: str(r.treatmentNote),
    selfCare: str(r.selfCare),
    bodyMapData: str(r.bodyMapData),
    images: normalizeImages(r.images),
  };
}

function normalizePatient(raw: unknown): Patient {
  const r = isRecord(raw) ? raw : {};
  const base = isRecord(r.base_info) ? r.base_info : isRecord(r.baseInfo) ? r.baseInfo : {};
  const chart = isRecord(r.chart_data) ? r.chart_data : isRecord(r.chartData) ? r.chartData : {};
  const rawTags =
    Array.isArray(r.tags) ? r.tags
      : Array.isArray(r.tag_list) ? r.tag_list
      : Array.isArray(r.tagList) ? r.tagList
      : typeof r.tag === 'string' ? r.tag.split(',').map((t) => t.trim())
      : [];
  const historyRaw = Array.isArray(chart.history) ? chart.history : [];
  const history = historyRaw.map((item, i) => normalizeSession(item, i + 1));
  const latest = normalizeSession(chart.latest, history.length + 1);

  return {
    id: str(r.id),
    name: str(r.name),
    base_info: {
      gender: str(base.gender),
      age: str(base.age),
      address: str(base.address),
      phone: str(base.phone),
      lineUserId: str(base.line_user_id) || str(base.lineUserId),
      history: str(base.history),
      surgery: str(base.surgery),
      romLimit: str(base.romLimit),
      goals: str(base.goals),
    },
    chart_data: { latest, history },
    last_visit: str(r.last_visit) || str(r.lastVisit) || latest.date,
    tags: rawTags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0),
  };
}

function patientToRawRow(p: Patient): Record<string, unknown> {
  return {
    id: p.id,
    name: p.name,
    last_visit: p.last_visit,
    lastVisit: p.last_visit,
    tags: p.tags,
    tag_list: p.tags,
    tagList: p.tags,
    tag: p.tags.join(','),
    base_info: {
      gender: p.base_info.gender,
      age: p.base_info.age,
      address: p.base_info.address,
      phone: p.base_info.phone,
      line_user_id: p.base_info.lineUserId,
      lineUserId: p.base_info.lineUserId,
      history: p.base_info.history,
      surgery: p.base_info.surgery,
      romLimit: p.base_info.romLimit,
      goals: p.base_info.goals,
    },
    baseInfo: {
      gender: p.base_info.gender,
      age: p.base_info.age,
      address: p.base_info.address,
      phone: p.base_info.phone,
      lineUserId: p.base_info.lineUserId,
      history: p.base_info.history,
      surgery: p.base_info.surgery,
      romLimit: p.base_info.romLimit,
      goals: p.base_info.goals,
    },
    chart_data: p.chart_data,
    chartData: p.chart_data,
  };
}

function scoreFromSession(session: Session) {
  const sum = numericKeys.reduce((acc, key) => acc + num(session.numericInspections[key], 3.5), 0);
  const score = ((45 - sum * 2) * 2) + 50;
  return { sum, score: Math.round(score * 10) / 10 };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = src;
  });
}

function Selector({
  label,
  current,
  options,
  onSelect,
}: {
  label: string;
  current: string;
  options: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-black text-slate-900">{label}</p>
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={`rounded-xl border-2 px-4 py-2 text-sm font-black transition ${
              current === option ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-slate-50 text-slate-900'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [activeTab, setActiveTab] = useState<'base' | 'visit'>('visit');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visitInfo, setVisitInfo] = useState<Session>(createInitialSession());
  const [visitRecords, setVisitRecords] = useState<Session[]>([]);
  const [activeVisitRecordIndex, setActiveVisitRecordIndex] = useState<number | null>(null);
  const [isNewVisitMode, setIsNewVisitMode] = useState(false);
  const [baseInfo, setBaseInfo] = useState<BaseInfo>(initialBaseInfo);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [filterVisitNumber, setFilterVisitNumber] = useState('');
  const [filterAddress, setFilterAddress] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  /** OFF のときはキャンバスがスクロールを阻害しない。ON のときのみ赤ペン。 */
  const [bodyMapDrawMode, setBodyMapDrawMode] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [netOnline, setNetOnline] = useState(true);
  const [syncBusy, setSyncBusy] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bodyMapPointersRef = useRef<Set<number>>(new Set());
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);
  const archiveBaCanvasRef = useRef<HTMLCanvasElement>(null);

  const [archiveBaLeftId, setArchiveBaLeftId] = useState('');
  const [archiveBaRightId, setArchiveBaRightId] = useState('');
  const [archiveBaPreview, setArchiveBaPreview] = useState('');
  const [isArchiveBaGenerating, setIsArchiveBaGenerating] = useState(false);
  const [linePushSending, setLinePushSending] = useState(false);
  const [linePushNotice, setLinePushNotice] = useState('');

  const safeVisit = useMemo(() => normalizeSession(visitInfo), [visitInfo]);
  const score = useMemo(() => scoreFromSession(safeVisit), [safeVisit]);

  /** 過去受診を一覧表示（編集中の行は visitInfo を反映、新規受診は下に追記） */
  const visitArchiveRows = useMemo(() => {
    type ArchiveRow = {
      key: string;
      visitNumber: number;
      date: string;
      beautyScore: number;
      numeric: Record<string, number>;
      session: Session;
      isDraft: boolean;
      isCurrent: boolean;
    };
    const rows: ArchiveRow[] = [];
    visitRecords.forEach((record, index) => {
      const isCurrent = !isNewVisitMode && activeVisitRecordIndex === index;
      const raw = isCurrent ? visitInfo : record;
      const s = normalizeSession(raw, index + 1);
      const { score: beautyScore } = scoreFromSession(s);
      rows.push({
        key: `saved-${index}-${s.visitNumber}`,
        visitNumber: s.visitNumber,
        date: s.date,
        beautyScore,
        numeric: { ...s.numericInspections },
        session: s,
        isDraft: false,
        isCurrent,
      });
    });
    if (isNewVisitMode) {
      const s = normalizeSession(visitInfo, visitRecords.length + 1);
      const { score: beautyScore } = scoreFromSession(s);
      rows.push({
        key: 'draft-new',
        visitNumber: s.visitNumber,
        date: s.date,
        beautyScore,
        numeric: { ...s.numericInspections },
        session: s,
        isDraft: true,
        isCurrent: true,
      });
    }
    return [...rows].sort((a, b) => a.visitNumber - b.visitNumber);
  }, [visitRecords, visitInfo, activeVisitRecordIndex, isNewVisitMode]);

  /** アーカイブ用：全受診から任意2枚選んで比較するための画像リスト */
  const archiveImagePickList = useMemo(() => {
    const list: { id: string; label: string; src: string }[] = [];
    for (const row of visitArchiveRows) {
      const s = row.session;
      const prefix = row.isDraft ? `第${row.visitNumber}回（下書き）` : `第${row.visitNumber}回`;
      for (const timing of ['before', 'after'] as const) {
        for (const pair of imagePairs) {
          const src = s.images[timing][pair.key];
          if (src) {
            list.push({
              id: `${row.key}-${timing}-${pair.key}`,
              label: `${prefix} / ${timing === 'before' ? 'Before' : 'After'} / ${pair.label}`,
              src,
            });
          }
        }
      }
      for (const pair of imagePairs) {
        const src = s.images.comparisons[pair.key];
        if (src) {
          list.push({
            id: `${row.key}-cmp-${pair.key}`,
            label: `${prefix} / 比較 / ${pair.label}`,
            src,
          });
        }
      }
    }
    return list;
  }, [visitArchiveRows]);

  const allTags = useMemo(
    () => Array.from(new Set(patients.flatMap((p) => p.tags).filter((tag) => tag.trim().length > 0))),
    [patients],
  );
  const allVisitNumbers = useMemo(
    () =>
      Array.from(
        new Set(
          patients.map((p) => normalizeSession(p.chart_data.latest, p.chart_data.history.length + 1).visitNumber.toString()),
        ),
      ).sort((a, b) => Number(a) - Number(b)),
    [patients],
  );
  const allAddresses = useMemo(
    () =>
      Array.from(
        new Set(
          patients
            .map((p) => p.base_info.address.trim())
            .filter((address) => address.length > 0),
        ),
      ),
    [patients],
  );
  const allGenders = useMemo(() => ['男', '女', 'その他'], []);

  const refreshPending = useCallback(() => {
    void getQueueLength().then(setPendingSync);
  }, []);

  const performFullSync = useCallback(async () => {
    if (!supabase || !isBrowserOnline()) return;
    setSyncBusy(true);
    try {
      const { pulledRows, error } = await flushSyncQueue(supabase);
      if (error) {
        setErrorMessage(error);
      } else if (pulledRows) {
        await writePatientRowsCache(pulledRows);
        setPatients(pulledRows.map((item) => normalizePatient(item)));
        setErrorMessage('');
      }
    } finally {
      await refreshPending();
      setSyncBusy(false);
    }
  }, [supabase, refreshPending]);

  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      const hitName = patient.name.includes(searchTerm.trim());
      const hitTag = filterTag ? patient.tags.includes(filterTag) : true;
      const hitTagText = tagSearchTerm ? patient.tags.some((tag) => tag.includes(tagSearchTerm.trim())) : true;
      const hitVisitNumber = filterVisitNumber
        ? normalizeSession(patient.chart_data.latest, patient.chart_data.history.length + 1).visitNumber.toString() === filterVisitNumber
        : true;
      const hitAddress = filterAddress ? patient.base_info.address === filterAddress : true;
      const hitGender = filterGender ? patient.base_info.gender === filterGender : true;
      return hitName && hitTag && hitTagText && hitVisitNumber && hitAddress && hitGender;
    });
  }, [patients, searchTerm, filterTag, tagSearchTerm, filterVisitNumber, filterAddress, filterGender]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cached = await readPatientRowsCache();
      if (cancelled) return;
      if (cached.length > 0) {
        setPatients(cached.map((item) => normalizePatient(item)));
      }
      await refreshPending();
      if (!supabase) {
        setErrorMessage(supabaseConfigError);
        return;
      }
      if (isBrowserOnline()) {
        await performFullSync();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, performFullSync, refreshPending]);

  useEffect(() => {
    setNetOnline(isBrowserOnline());
    const onOnline = () => {
      setNetOnline(true);
      if (supabase) void performFullSync();
    };
    const onOffline = () => setNetOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [supabase, performFullSync]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && isBrowserOnline() && supabase) {
        void performFullSync();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [supabase, performFullSync]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!safeVisit.bodyMapData) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = safeVisit.bodyMapData;
  }, [safeVisit.bodyMapData, selectedId]);

  const resetForNew = () => {
    setSelectedId(null);
    setVisitRecords([]);
    setActiveVisitRecordIndex(null);
    setIsNewVisitMode(true);
    setBaseInfo(initialBaseInfo);
    setCurrentTags([]);
    setVisitInfo(createInitialSession());
    setNewTagInput('');
    setActiveTab('visit');
    setView('edit');
  };

  const openEdit = (rawPatient: Patient) => {
    const patient = normalizePatient(rawPatient);
    const history = patient.chart_data.history.map((item, index) => normalizeSession(item, index + 1));
    const latest = normalizeSession(patient.chart_data.latest, history.length + 1);
    const records = [...history, latest];
    setSelectedId(patient.id);
    setBaseInfo({
      name: patient.name,
      gender: patient.base_info.gender,
      age: patient.base_info.age,
      address: patient.base_info.address,
      phone: patient.base_info.phone,
      lineUserId: patient.base_info.lineUserId,
      history: patient.base_info.history,
      surgery: patient.base_info.surgery,
      romLimit: patient.base_info.romLimit,
      goals: patient.base_info.goals,
    });
    setCurrentTags(patient.tags);
    setVisitRecords(records);
    setActiveVisitRecordIndex(records.length - 1);
    setIsNewVisitMode(false);
    setVisitInfo(latest);
    setActiveTab('visit');
    setView('edit');
  };

  const openVisitRecord = (index: number) => {
    if (index < 0 || index >= visitRecords.length) return;
    setActiveVisitRecordIndex(index);
    setIsNewVisitMode(false);
    setVisitInfo(normalizeSession(visitRecords[index], index + 1));
  };

  const createNewVisitRecord = () => {
    const nextVisitNumber = visitRecords.length > 0
      ? Math.max(...visitRecords.map((record) => record.visitNumber)) + 1
      : 1;
    const next = {
      ...createInitialSession(),
      visitNumber: nextVisitNumber,
    };
    setActiveVisitRecordIndex(null);
    setIsNewVisitMode(true);
    setVisitInfo(next);
  };

  const addTag = () => {
    const value = newTagInput.trim();
    if (!value || currentTags.includes(value)) return;
    setCurrentTags((prev) => [...prev, value]);
    setNewTagInput('');
  };

  const releaseBodyMapPointerCapture = (canvas: HTMLCanvasElement, pointerId: number) => {
    try {
      canvas.releasePointerCapture(pointerId);
    } catch {
      /* capture 未設定の環境・古い WebView など */
    }
  };

  const beginDraw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!bodyMapDrawMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    bodyMapPointersRef.current.add(event.pointerId);
    if (bodyMapPointersRef.current.size > 1) {
      setIsDrawing(false);
      for (const id of bodyMapPointersRef.current) {
        releaseBodyMapPointerCapture(canvas, id);
      }
      bodyMapPointersRef.current.clear();
      ctx.beginPath();
      return;
    }

    setIsDrawing(true);
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      setIsDrawing(false);
      bodyMapPointersRef.current.delete(event.pointerId);
      ctx.beginPath();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!bodyMapDrawMode || !isDrawing) return;
    if (bodyMapPointersRef.current.size !== 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    ctx.lineWidth = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 6 : 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ef4444';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = (event?: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas && event) {
      bodyMapPointersRef.current.delete(event.pointerId);
      releaseBodyMapPointerCapture(canvas, event.pointerId);
    } else if (canvas) {
      for (const id of bodyMapPointersRef.current) {
        releaseBodyMapPointerCapture(canvas, id);
      }
      bodyMapPointersRef.current.clear();
    }
    setIsDrawing(false);
    canvasRef.current?.getContext('2d')?.beginPath();
  };

  const clearBodyMap = () => {
    endDraw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setVisitInfo((prev) => ({ ...normalizeSession(prev), bodyMapData: '' }));
  };

  const onImageSelected = (timing: 'before' | 'after', key: ImageKey, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = typeof reader.result === 'string' ? reader.result : '';
      setVisitInfo((prev) => {
        const safe = normalizeSession(prev);
        return {
          ...safe,
          images: {
            ...safe.images,
            [timing]: { ...safe.images[timing], [key]: image },
          },
        };
      });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const generateAllComparisons = async () => {
    const canvas = compositeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const safe = normalizeSession(visitInfo);
    setIsGeneratingImages(true);
    try {
      const nextComparisons = { ...safe.images.comparisons };
      for (const pair of imagePairs) {
        const before = safe.images.before[pair.key];
        const after = safe.images.after[pair.key];
        if (!before || !after) {
          nextComparisons[pair.key] = '';
          continue;
        }
        const [beforeImage, afterImage] = await Promise.all([loadImage(before), loadImage(after)]);
        canvas.width = 1400;
        canvas.height = 900;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1400, 900);
        ctx.drawImage(beforeImage, 30, 30, 650, 760);
        ctx.drawImage(afterImage, 720, 30, 650, 760);
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 34px sans-serif';
        ctx.fillText(`BEFORE（${pair.label}）`, 40, 860);
        ctx.fillText(`AFTER（${pair.label}）`, 730, 860);
        nextComparisons[pair.key] = canvas.toDataURL('image/png');
      }
      setVisitInfo((prev) => {
        const normalized = normalizeSession(prev);
        return {
          ...normalized,
          images: { ...normalized.images, comparisons: nextComparisons },
        };
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '比較画像生成に失敗しました');
    } finally {
      setIsGeneratingImages(false);
    }
  };

  /** 既存患者の chart_data のみ更新（削除後の再保存など） */
  const updatePatientChartData = async (nextRecords: Session[]): Promise<Patient | null> => {
    if (!selectedId) return null;
    const history = nextRecords.slice(0, -1);
    const latestRecord = nextRecords[nextRecords.length - 1];
    if (!latestRecord) return null;

    const savePayload = {
      name: baseInfo.name,
      base_info: {
        gender: baseInfo.gender,
        age: baseInfo.age,
        address: baseInfo.address,
        phone: baseInfo.phone,
        line_user_id: baseInfo.lineUserId,
        history: baseInfo.history,
        surgery: baseInfo.surgery,
        romLimit: baseInfo.romLimit,
        goals: baseInfo.goals,
      },
      chart_data: { latest: latestRecord, history },
      last_visit: latestRecord.date,
      baseInfo: {
        gender: baseInfo.gender,
        age: baseInfo.age,
        address: baseInfo.address,
        phone: baseInfo.phone,
        lineUserId: baseInfo.lineUserId,
        history: baseInfo.history,
        surgery: baseInfo.surgery,
        romLimit: baseInfo.romLimit,
        goals: baseInfo.goals,
      },
      chartData: { latest: latestRecord, history },
      lastVisit: latestRecord.date,
      tags: currentTags,
      tag_list: currentTags,
      tagList: currentTags,
      tag: currentTags.join(','),
    };

    if (!isBrowserOnline()) {
      if (!supabase) {
        setErrorMessage(supabaseConfigError);
        return null;
      }
      const raw: Record<string, unknown> = {
        id: selectedId,
        name: savePayload.name,
        last_visit: savePayload.last_visit,
        lastVisit: savePayload.lastVisit,
        tags: savePayload.tags,
        tag_list: savePayload.tag_list,
        tagList: savePayload.tagList,
        tag: savePayload.tag,
        base_info: savePayload.base_info,
        baseInfo: savePayload.baseInfo,
        chart_data: savePayload.chart_data,
        chartData: savePayload.chartData,
      };
      const updated = normalizePatient(raw);
      const patientsNext = patients.map((p) => (p.id === selectedId ? updated : p));
      setPatients(patientsNext);
      await writePatientRowsCache(patientsNext.map(patientToRawRow));
      await addQueueOp({ kind: 'update', patientId: selectedId, payload: { ...savePayload } as Record<string, unknown> });
      await refreshPending();
      return updated;
    }

    if (!supabase) {
      setErrorMessage(supabaseConfigError);
      return null;
    }
    const sb = supabase;

    const runMutation = async (payload: Record<string, unknown>) =>
      sb.from('patient').update(payload).eq('id', selectedId);

    const mutablePayload: Record<string, unknown> = { ...savePayload };
    let { error } = await runMutation(mutablePayload);
    let retryCount = 0;

    while (error && retryCount < 12) {
      const match = error.message.match(/Could not find the '([^']+)' column/);
      if (!match) break;
      const missingColumn = match[1];
      if (!(missingColumn in mutablePayload)) break;
      delete mutablePayload[missingColumn];
      ({ error } = await runMutation(mutablePayload));
      retryCount += 1;
    }

    if (error) {
      setErrorMessage(error.message);
      return null;
    }

    const { data, error: reloadError } = await sb.from('patient').select('*');
    if (reloadError) {
      setErrorMessage(reloadError.message);
      return null;
    }
    await writePatientRowsCache(data ?? []);
    setPatients((data ?? []).map((item) => normalizePatient(item)));
    const found = (data ?? []).find((row) => isRecord(row) && str(row.id) === selectedId);
    return found ? normalizePatient(found) : null;
  };

  const handleDiscardNewVisit = () => {
    if (!isNewVisitMode) return;
    if (!window.confirm('新規受診の入力を破棄しますか？未保存の内容は失われます。')) return;
    if (visitRecords.length === 0) {
      setView('list');
      return;
    }
    const lastIdx = visitRecords.length - 1;
    setIsNewVisitMode(false);
    setActiveVisitRecordIndex(lastIdx);
    setVisitInfo(normalizeSession(visitRecords[lastIdx], lastIdx + 1));
  };

  const handleDeleteCurrentVisit = async () => {
    if (!selectedId || isNewVisitMode || activeVisitRecordIndex === null) return;
    if (!window.confirm('この受診記録を削除します。元に戻せません。よろしいですか？')) return;

    const merged = visitRecords.map((record, index) => {
      const isCurrent = activeVisitRecordIndex === index;
      return normalizeSession(isCurrent ? visitInfo : record, index + 1);
    });
    const next = [...merged];
    next.splice(activeVisitRecordIndex, 1);

    if (next.length === 0) {
      if (!window.confirm('受診が残りません。患者カルテ全体を削除しますか？')) return;
      if (!supabase) {
        setErrorMessage(supabaseConfigError);
        return;
      }
      if (!isBrowserOnline()) {
        const patientsNext = patients.filter((p) => p.id !== selectedId);
        setPatients(patientsNext);
        await writePatientRowsCache(patientsNext.map(patientToRawRow));
        await addQueueOp({ kind: 'delete', patientId: selectedId });
        await refreshPending();
        setView('list');
        return;
      }
      const { error } = await supabase.from('patient').delete().eq('id', selectedId);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      const { data, error: reloadError } = await supabase.from('patient').select('*');
      if (reloadError) {
        setErrorMessage(reloadError.message);
        return;
      }
      await writePatientRowsCache(data ?? []);
      setPatients((data ?? []).map((item) => normalizePatient(item)));
      setView('list');
      return;
    }

    const updated = await updatePatientChartData(next);
    if (updated) {
      openEdit(updated);
    }
  };

  const handleDeletePatient = async () => {
    if (!selectedId) return;
    if (!window.confirm('患者カルテ全体を削除します。元に戻せません。よろしいですか？')) return;
    if (!supabase) {
      setErrorMessage(supabaseConfigError);
      return;
    }
    if (!isBrowserOnline()) {
      const patientsNext = patients.filter((p) => p.id !== selectedId);
      setPatients(patientsNext);
      await writePatientRowsCache(patientsNext.map(patientToRawRow));
      await addQueueOp({ kind: 'delete', patientId: selectedId });
      await refreshPending();
      setView('list');
      return;
    }
    const { error } = await supabase.from('patient').delete().eq('id', selectedId);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    const { data, error: reloadError } = await supabase.from('patient').select('*');
    if (reloadError) {
      setErrorMessage(reloadError.message);
      return;
    }
    await writePatientRowsCache(data ?? []);
    setPatients((data ?? []).map((item) => normalizePatient(item)));
    setView('list');
  };

  const generateArchiveBeforeAfter = async () => {
    const left = archiveImagePickList.find((item) => item.id === archiveBaLeftId);
    const right = archiveImagePickList.find((item) => item.id === archiveBaRightId);
    if (!left?.src || !right?.src) {
      setErrorMessage('左・右に画像をそれぞれ1枚ずつ選んでください');
      return;
    }
    const canvas = archiveBaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsArchiveBaGenerating(true);
    try {
      const [imgL, imgR] = await Promise.all([loadImage(left.src), loadImage(right.src)]);
      canvas.width = 1400;
      canvas.height = 920;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgL, 30, 30, 650, 780);
      ctx.drawImage(imgR, 720, 30, 650, 780);
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 28px sans-serif';
      const short = (text: string) => (text.length > 48 ? `${text.slice(0, 48)}…` : text);
      ctx.fillText(`左：${short(left.label)}`, 40, 900);
      ctx.fillText(`右：${short(right.label)}`, 730, 900);
      setArchiveBaPreview(canvas.toDataURL('image/png'));
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '画像の合成に失敗しました');
    } finally {
      setIsArchiveBaGenerating(false);
    }
  };

  /** 端末に保存（販売先ごとに「保存してから任意で送る」ルート） */
  const downloadArchivePreview = () => {
    if (!archiveBaPreview) return;
    void fetch(archiveBaPreview)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `mabune-before-after-${Date.now()}.png`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      })
      .catch(() => setErrorMessage('画像のダウンロードに失敗しました'));
  };

  /** Messaging API の push（PC ブラウザからも `/api/line/push-image` 経由で送信） */
  const sendArchiveImageViaLine = async () => {
    const uid = baseInfo.lineUserId.trim();
    if (!archiveBaPreview) return;
    if (!uid) {
      setErrorMessage('基本情報タブで「LINE userId」を入力し、保存してください。');
      return;
    }
    setLinePushSending(true);
    setErrorMessage('');
    setLinePushNotice('');
    try {
      const res = await fetch('/api/line/push-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: uid, imageDataUrl: archiveBaPreview }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErrorMessage(typeof data.error === 'string' ? data.error : '公式LINEへの送信に失敗しました');
        return;
      }
      setLinePushNotice('公式LINEへプッシュ送信しました。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '公式LINEへの送信に失敗しました');
    } finally {
      setLinePushSending(false);
    }
  };

  const handleSave = async () => {
    if (!supabase) {
      setErrorMessage(supabaseConfigError);
      return;
    }
    const sb = supabase;

    const normalized = normalizeSession(visitInfo);
    const bodyMapData = canvasRef.current?.toDataURL('image/png') ?? normalized.bodyMapData;
    const latest = {
      ...normalized,
      totalSum: score.sum,
      beautyScore: score.score,
      bodyMapData,
    };
    const selectedPatient = selectedId ? patients.find((patient) => patient.id === selectedId) : undefined;
    const previousRecords = selectedPatient
      ? [
          ...(selectedPatient.chart_data.history ?? []).map((item, index) => normalizeSession(item, index + 1)),
          normalizeSession(
            selectedPatient.chart_data.latest,
            (selectedPatient.chart_data.history?.length ?? 0) + 1,
          ),
        ]
      : [];

    let nextRecords = [...previousRecords];
    if (selectedId) {
      if (isNewVisitMode || activeVisitRecordIndex === null) {
        nextRecords.push(latest);
      } else if (activeVisitRecordIndex >= 0 && activeVisitRecordIndex < nextRecords.length) {
        nextRecords[activeVisitRecordIndex] = latest;
      } else if (nextRecords.length > 0) {
        nextRecords[nextRecords.length - 1] = latest;
      } else {
        nextRecords = [latest];
      }
    } else {
      nextRecords = [latest];
    }
    const history = nextRecords.slice(0, -1);
    const latestRecord = nextRecords[nextRecords.length - 1] ?? latest;

    const savePayload = {
      name: baseInfo.name,
      base_info: {
        gender: baseInfo.gender,
        age: baseInfo.age,
        address: baseInfo.address,
        phone: baseInfo.phone,
        line_user_id: baseInfo.lineUserId,
        history: baseInfo.history,
        surgery: baseInfo.surgery,
        romLimit: baseInfo.romLimit,
        goals: baseInfo.goals,
      },
      chart_data: { latest: latestRecord, history },
      last_visit: latestRecord.date,
      baseInfo: {
        gender: baseInfo.gender,
        age: baseInfo.age,
        address: baseInfo.address,
        phone: baseInfo.phone,
        lineUserId: baseInfo.lineUserId,
        history: baseInfo.history,
        surgery: baseInfo.surgery,
        romLimit: baseInfo.romLimit,
        goals: baseInfo.goals,
      },
      chartData: { latest: latestRecord, history },
      lastVisit: latestRecord.date,
      tags: currentTags,
      tag_list: currentTags,
      tagList: currentTags,
      tag: currentTags.join(','),
    };

    if (!isBrowserOnline()) {
      const id = selectedId ?? crypto.randomUUID();
      const raw: Record<string, unknown> = {
        id,
        name: savePayload.name,
        last_visit: savePayload.last_visit,
        lastVisit: savePayload.lastVisit,
        tags: savePayload.tags,
        tag_list: savePayload.tag_list,
        tagList: savePayload.tagList,
        tag: savePayload.tag,
        base_info: savePayload.base_info,
        baseInfo: savePayload.baseInfo,
        chart_data: savePayload.chart_data,
        chartData: savePayload.chartData,
      };
      const nextPatient = normalizePatient(raw);
      const patientsNext = selectedId
        ? patients.map((p) => (p.id === selectedId ? nextPatient : p))
        : [...patients, nextPatient];
      setPatients(patientsNext);
      await writePatientRowsCache(patientsNext.map(patientToRawRow));
      if (selectedId) {
        await addQueueOp({ kind: 'update', patientId: selectedId, payload: { ...savePayload } as Record<string, unknown> });
      } else {
        await addQueueOp({ kind: 'insert', row: raw });
      }
      await refreshPending();
      setErrorMessage('');
      if (selectedId) {
        setVisitRecords(nextRecords);
        setActiveVisitRecordIndex(nextRecords.length - 1);
        setIsNewVisitMode(false);
        setVisitInfo(latestRecord);
      }
      setView('list');
      return;
    }

    const runMutation = async (payload: Record<string, unknown>) => {
      return selectedId
        ? sb.from('patient').update(payload).eq('id', selectedId)
        : sb.from('patient').insert([payload]);
    };

    const mutablePayload: Record<string, unknown> = { ...savePayload };
    let { error } = await runMutation(mutablePayload);
    let retryCount = 0;

    while (error && retryCount < 12) {
      const match = error.message.match(/Could not find the '([^']+)' column/);
      if (!match) break;
      const missingColumn = match[1];
      if (!(missingColumn in mutablePayload)) break;
      delete mutablePayload[missingColumn];
      ({ error } = await runMutation(mutablePayload));
      retryCount += 1;
    }

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const { data, error: reloadError } = await sb.from('patient').select('*');
    if (reloadError) {
      setErrorMessage(reloadError.message);
      return;
    }
    await writePatientRowsCache(data ?? []);
    setPatients((data ?? []).map((item) => normalizePatient(item)));
    if (selectedId) {
      setVisitRecords(nextRecords);
      setActiveVisitRecordIndex(nextRecords.length - 1);
      setIsNewVisitMode(false);
      setVisitInfo(latestRecord);
    }
    setView('list');
  };

  const syncBanner =
    !netOnline || syncBusy || pendingSync > 0 ? (
      <div
        className={`mx-auto mb-4 w-full max-w-7xl rounded-2xl border-2 px-4 py-3 text-sm font-black ${
          !netOnline
            ? 'border-amber-500 bg-amber-50 text-amber-950'
            : syncBusy
              ? 'border-sky-400 bg-sky-50 text-sky-950'
              : 'border-violet-400 bg-violet-50 text-violet-950'
        }`}
      >
        {!netOnline
          ? 'オフラインです。データはこの端末に保存され、通信が戻ると自動でサーバーへ同期します。'
          : syncBusy
            ? 'サーバーと同期しています…'
            : `未送信の変更が ${pendingSync} 件あります。接続中のためまもなく同期します。`}
      </div>
    ) : null;

  if (view === 'list') {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-slate-900 font-black">
        {syncBanner}
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
          <h1 className="text-4xl font-black text-slate-900">mabune Core</h1>
          <button type="button" onClick={resetForNew} className="rounded-full bg-slate-900 px-8 py-3 text-white font-black">
            + 新規登録
          </button>
        </div>

        <div className="mx-auto mt-6 grid w-full max-w-7xl grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="氏名で検索"
            className="rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 font-black outline-none"
          />
          <input
            value={tagSearchTerm}
            onChange={(event) => setTagSearchTerm(event.target.value)}
            placeholder="タグ文字列で検索"
            className="rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 font-black outline-none"
          />
          <select
            value={filterTag}
            onChange={(event) => setFilterTag(event.target.value)}
            className="rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 font-black outline-none"
          >
            <option value="">すべてのタグ</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <select
            value={filterVisitNumber}
            onChange={(event) => setFilterVisitNumber(event.target.value)}
            className="rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 font-black outline-none"
          >
            <option value="">すべての受診回数</option>
            {allVisitNumbers.map((visitNumber) => (
              <option key={visitNumber} value={visitNumber}>
                第{visitNumber}回
              </option>
            ))}
          </select>
          <select
            value={filterAddress}
            onChange={(event) => setFilterAddress(event.target.value)}
            className="rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 font-black outline-none"
          >
            <option value="">すべての住所</option>
            {allAddresses.map((address) => (
              <option key={address} value={address}>
                {address}
              </option>
            ))}
          </select>
          <select
            value={filterGender}
            onChange={(event) => setFilterGender(event.target.value)}
            className="rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 font-black outline-none"
          >
            <option value="">すべての性別</option>
            {allGenders.map((gender) => (
              <option key={gender} value={gender}>
                {gender}
              </option>
            ))}
          </select>
        </div>

        {errorMessage ? <p className="mx-auto mt-4 w-full max-w-7xl text-red-600 font-black">{errorMessage}</p> : null}

        <div className="mx-auto mt-8 grid w-full max-w-7xl grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPatients.map((patient) => {
            const safePatient = normalizePatient(patient);
            const safeLatest = normalizeSession(safePatient.chart_data.latest, safePatient.chart_data.history.length + 1);
            return (
              <button
                key={safePatient.id}
                type="button"
                onClick={() => openEdit(safePatient)}
                className="rounded-3xl border-4 border-slate-300 bg-white p-6 text-left transition hover:border-slate-900"
              >
                <p className="text-2xl font-black text-slate-900">{safePatient.name || '名称未設定'} 様</p>
                <p className="mt-3 text-xl font-black text-slate-900">受診回数: 第{safeLatest.visitNumber}回</p>
                <p className="mt-3 text-6xl font-black text-slate-900">{safeLatest.beautyScore || '--'}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {safePatient.tags.map((tag) => (
                    <span key={tag} className="rounded-full border-2 border-slate-300 bg-slate-50 px-3 py-1 text-xs font-black text-slate-900">
                      #{tag}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20 text-slate-900 font-black">
      {syncBanner ? <div className="bg-white px-8 pt-6">{syncBanner}</div> : null}
      <header className="sticky top-0 z-30 border-b-4 border-slate-300 bg-white p-4">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2 md:gap-4">
            <button type="button" onClick={() => setView('list')} className="shrink-0 rounded-full border-2 border-slate-300 bg-slate-50 px-4 py-2 text-slate-900 font-black">
              戻る
            </button>
            <input
              value={baseInfo.name}
              onChange={(event) => setBaseInfo((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="氏名"
              className="min-w-0 flex-1 rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-lg text-slate-900 font-black outline-none md:max-w-md md:px-4 md:text-2xl"
            />
            <div className="flex shrink-0 items-center gap-2 rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2">
              <span className="whitespace-nowrap text-slate-900 font-black">受診回数</span>
              <input
                type="number"
                min={1}
                value={safeVisit.visitNumber}
                onChange={(event) =>
                  setVisitInfo((prev) => ({ ...normalizeSession(prev), visitNumber: Math.max(1, Number(event.target.value) || 1) }))
                }
                className="w-14 rounded-md border-2 border-slate-300 bg-slate-50 px-2 py-1 text-slate-900 font-black outline-none md:w-16"
              />
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 border-t-2 border-slate-200 pt-3 md:w-auto md:border-t-0 md:pt-0">
            <button
              type="button"
              onClick={() => setActiveTab('base')}
              className={`rounded-xl px-4 py-2 font-black ${activeTab === 'base' ? 'bg-slate-900 text-white' : 'border-2 border-slate-300 bg-slate-50 text-slate-900'}`}
            >
              基本情報
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('visit')}
              className={`rounded-xl px-4 py-2 font-black ${activeTab === 'visit' ? 'bg-slate-900 text-white' : 'border-2 border-slate-300 bg-slate-50 text-slate-900'}`}
            >
              受診・検査
            </button>
            <button type="button" onClick={handleSave} className="rounded-full bg-slate-900 px-6 py-2 text-white font-black md:px-8 md:py-3">
              保存
            </button>
            {selectedId ? (
              <button
                type="button"
                onClick={() => void handleDeletePatient()}
                className="rounded-full border-2 border-red-600 bg-white px-4 py-2 text-red-600 font-black md:px-5 md:py-3"
              >
                患者削除
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {errorMessage ? <p className="mx-auto mt-4 w-full max-w-7xl text-red-600 font-black">{errorMessage}</p> : null}

      <main className="mx-auto mt-6 w-full max-w-7xl px-4">
        {activeTab === 'base' ? (
          <section className="space-y-6">
            <h2 className="text-4xl font-black text-slate-900">基本情報</h2>
            <div className="rounded-3xl border-2 border-slate-300 bg-white p-6">
              <p className="mb-3 text-lg font-black text-slate-900">タグ管理（自由追加・クリック削除）</p>
              <div className="flex flex-wrap gap-2">
                {currentTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setCurrentTags((prev) => prev.filter((x) => x !== tag))}
                    className="rounded-full border-2 border-slate-300 bg-slate-50 px-4 py-2 text-sm font-black text-slate-900"
                  >
                    #{tag} ×
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  value={newTagInput}
                  onChange={(event) => setNewTagInput(event.target.value)}
                  placeholder="タグを入力"
                  className="w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-4 py-2 text-slate-900 font-black outline-none"
                />
                <button type="button" onClick={addTag} className="rounded-xl bg-slate-900 px-6 py-2 text-white font-black">
                  追加
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="rounded-3xl border-2 border-slate-300 bg-slate-50 p-4 text-slate-900 font-black">
                性別
                <select
                  value={baseInfo.gender}
                  onChange={(event) => setBaseInfo((prev) => ({ ...prev, gender: event.target.value }))}
                  className="mt-2 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 font-black outline-none"
                >
                  <option value="">選択してください</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                  <option value="その他">その他</option>
                </select>
              </label>
              {[
                ['年齢', 'age'],
                ['住所', 'address'],
                ['電話', 'phone'],
              ].map(([label, key]) => (
                <label key={key} className="rounded-3xl border-2 border-slate-300 bg-slate-50 p-4 text-slate-900 font-black">
                  {label}
                  <input
                    value={baseInfo[key as keyof BaseInfo] as string}
                    onChange={(event) => setBaseInfo((prev) => ({ ...prev, [key]: event.target.value }))}
                    className="mt-2 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 font-black outline-none"
                  />
                </label>
              ))}
              <label className="rounded-3xl border-2 border-slate-300 bg-slate-50 p-4 text-slate-900 font-black md:col-span-2">
                LINE userId（Messaging API・push 用）
                <input
                  value={baseInfo.lineUserId}
                  onChange={(event) => setBaseInfo((prev) => ({ ...prev, lineUserId: event.target.value }))}
                  placeholder="Uxxxxxxxx…"
                  className="mt-2 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 font-black outline-none"
                />
                <p className="mt-2 text-xs font-black leading-relaxed text-slate-600">
                  患者が公式LINEにメッセージを送ったとき、Webhook のイベントから <code className="rounded bg-slate-200 px-1">source.userId</code>{' '}
                  を控えてここに貼り付けます。友だち追加だけではアプリ側から userId は分かりません。
                </p>
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                ['既往歴', 'history'],
                ['手術歴', 'surgery'],
                ['可動域制限/指示', 'romLimit'],
                ['なりたい姿', 'goals'],
              ].map(([label, key]) => (
                <label key={key} className="rounded-3xl border-2 border-slate-300 bg-slate-50 p-4 text-slate-900 font-black">
                  {label}
                  <textarea
                    value={baseInfo[key as keyof BaseInfo] as string}
                    onChange={(event) => setBaseInfo((prev) => ({ ...prev, [key]: event.target.value }))}
                    className="mt-2 h-32 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 font-black outline-none"
                  />
                </label>
              ))}
            </div>
          </section>
        ) : (
          <section className="space-y-8">
            <h2 className="text-4xl font-black text-slate-900">受診・検査</h2>
            <div className="flex flex-col gap-8 xl:grid xl:grid-cols-2 xl:gap-8">
              <div className="order-2 grid grid-cols-1 gap-4 rounded-3xl border-2 border-slate-300 bg-white p-4 md:grid-cols-[1fr_auto] xl:order-none xl:col-span-2">
                <div className="space-y-2">
                  <p className="text-sm font-black text-slate-900">受診カルテ（過去回を選ぶと上のフォームに表示されます）</p>
                  <select
                    value={activeVisitRecordIndex !== null ? String(activeVisitRecordIndex) : 'new'}
                    onChange={(event) => {
                      if (event.target.value === 'new') {
                        createNewVisitRecord();
                        return;
                      }
                      openVisitRecord(Number(event.target.value));
                    }}
                    className="w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 font-black outline-none"
                  >
                    {visitRecords.map((record, index) => (
                      <option key={`${record.visitNumber}-${index}`} value={index}>
                        第{record.visitNumber}回 / {record.date || '日付未設定'}
                      </option>
                    ))}
                    <option value="new">新規受診データ</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 self-end md:flex-row md:flex-wrap md:justify-end">
                  <button
                    type="button"
                    onClick={createNewVisitRecord}
                    className="rounded-xl bg-slate-900 px-6 py-2 text-white font-black"
                  >
                    新規受診を作成
                  </button>
                  {isNewVisitMode && visitRecords.length > 0 ? (
                    <button type="button" onClick={handleDiscardNewVisit} className="rounded-xl border-2 border-amber-600 bg-amber-50 px-6 py-2 text-amber-900 font-black">
                      新規を破棄
                    </button>
                  ) : null}
                  {selectedId && !isNewVisitMode && activeVisitRecordIndex !== null ? (
                    <button
                      type="button"
                      onClick={() => void handleDeleteCurrentVisit()}
                      className="rounded-xl border-2 border-red-600 bg-white px-6 py-2 text-red-600 font-black"
                    >
                      この受診を削除
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="order-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:order-none xl:col-span-2">
                <label className="rounded-3xl border-2 border-slate-300 bg-slate-50 p-4 text-slate-900 font-black">
                  受診日
                  <input
                    type="date"
                    value={safeVisit.date}
                    onChange={(event) => setVisitInfo((prev) => ({ ...normalizeSession(prev), date: event.target.value }))}
                    className="mt-2 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 font-black outline-none"
                  />
                </label>
                <label className="rounded-3xl border-2 border-slate-300 bg-slate-50 p-4 text-slate-900 font-black">
                  支払金額
                  <input
                    type="number"
                    value={safeVisit.amount}
                    onChange={(event) => setVisitInfo((prev) => ({ ...normalizeSession(prev), amount: Number(event.target.value) || 0 }))}
                    className="mt-2 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 font-black outline-none"
                  />
                </label>
              </div>

              <div className="order-1 space-y-3 xl:order-none">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-2xl font-black text-slate-900 max-xl:text-3xl">人体図</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={bodyMapDrawMode}
                      onClick={() => {
                        setBodyMapDrawMode((v) => !v);
                        endDraw();
                      }}
                      className={`rounded-full border-2 px-4 py-2 text-sm font-black ${
                        bodyMapDrawMode ? 'border-red-500 bg-red-50 text-red-800' : 'border-slate-300 bg-slate-50 text-slate-900'
                      }`}
                    >
                      描画 {bodyMapDrawMode ? 'ON' : 'OFF'}
                    </button>
                    <button type="button" onClick={clearBodyMap} className="shrink-0 rounded-full border-2 border-slate-300 bg-slate-50 px-4 py-2 text-slate-900 font-black">
                      消去
                    </button>
                  </div>
                </div>
                <p className="text-xs font-black leading-relaxed text-slate-600 max-xl:block xl:hidden">
                  描画OFFのときは図の上でもページをスクロールできます。描くときは「描画ON」にし、二本指を置くと描画を中断してスクロールしやすくなります。
                </p>
                <div className="mx-auto w-full max-w-full touch-manipulation xl:max-w-none">
                  <div className="mx-auto w-full max-w-[min(100%,56rem)] overflow-hidden rounded-3xl border-4 border-slate-300 bg-slate-50 shadow-inner xl:max-w-full">
                    <div className="relative mx-auto aspect-[3/2] w-full max-h-[min(88vh,92vw)] overflow-hidden xl:max-h-[min(72vh,40rem)]">
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute left-1/2 top-1/2 aspect-[3/4] h-full w-auto -translate-x-1/2 -translate-y-1/2 scale-[1.5]">
                          <img
                            src="/body-map.png"
                            alt=""
                            className="pointer-events-none absolute inset-0 h-full w-full object-contain p-0 opacity-40"
                          />
                          <canvas
                            ref={canvasRef}
                            width={900}
                            height={1200}
                            onPointerDown={beginDraw}
                            onPointerMove={draw}
                            onPointerUp={(e) => endDraw(e)}
                            onPointerLeave={(e) => endDraw(e)}
                            onPointerCancel={(e) => endDraw(e)}
                            className={`absolute inset-0 h-full w-full ${
                              bodyMapDrawMode ? 'cursor-crosshair touch-none' : 'pointer-events-none touch-auto'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      className="flex min-h-14 w-full touch-pan-y items-center justify-center border-t-2 border-slate-200 bg-slate-100 px-3 py-3 text-center text-xs font-black text-slate-600 select-none xl:hidden"
                      aria-hidden
                    >
                      ↕ この帯を上下にスワイプしてページをスクロール（描画OFF推奨）
                    </div>
                  </div>
                </div>
              </div>

              <div className="order-4 space-y-4 xl:order-none">
                <h3 className="text-2xl font-black text-slate-900">7段階評価</h3>
                <div className="max-h-[700px] space-y-4 overflow-y-auto pr-2">
                  <div className="rounded-3xl border-2 border-slate-300 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between text-xl font-black text-slate-900">
                      <span>顔</span>
                      <span>{safeVisit.numericInspections['顔'].toFixed(1)}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Selector
                        label="左右"
                        current={safeVisit.metaInspections.顔_左右}
                        options={['左', '右']}
                        onSelect={(value) =>
                          setVisitInfo((prev) => ({ ...normalizeSession(prev), metaInspections: { ...normalizeSession(prev).metaInspections, 顔_左右: side(value) } }))
                        }
                      />
                      <Selector
                        label="種類"
                        current={safeVisit.metaInspections.顔_種類}
                        options={['捻れ', '傾き', 'スライド']}
                        onSelect={(value) =>
                          setVisitInfo((prev) => ({ ...normalizeSession(prev), metaInspections: { ...normalizeSession(prev).metaInspections, 顔_種類: faceType(value) } }))
                        }
                      />
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={5}
                      step={0.5}
                      value={safeVisit.numericInspections['顔']}
                      onChange={(event) =>
                        setVisitInfo((prev) => ({
                          ...normalizeSession(prev),
                          numericInspections: { ...normalizeSession(prev).numericInspections, 顔: Number(event.target.value) },
                        }))
                      }
                      className="mt-4 w-full accent-slate-900"
                    />
                  </div>

                  {numericKeys.filter((key) => key !== '顔').map((key) => (
                    <div key={key} className="rounded-3xl border-2 border-slate-300 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between text-xl font-black text-slate-900">
                        <span>{key}</span>
                        <span>{safeVisit.numericInspections[key].toFixed(1)}</span>
                      </div>
                      {['肩上', '軸', 'AS'].includes(key) ? (
                        <Selector
                          label="左右"
                          current={safeVisit.metaInspections[`${key}_左右` as '肩上_左右' | '軸_左右' | 'AS_左右']}
                          options={['左', '右']}
                          onSelect={(value) =>
                            setVisitInfo((prev) => ({
                              ...normalizeSession(prev),
                              metaInspections: {
                                ...normalizeSession(prev).metaInspections,
                                [`${key}_左右`]: side(value),
                              } as Session['metaInspections'],
                            }))
                          }
                        />
                      ) : null}
                      <input
                        type="range"
                        min={2}
                        max={5}
                        step={0.5}
                        value={safeVisit.numericInspections[key]}
                        onChange={(event) =>
                          setVisitInfo((prev) => ({
                            ...normalizeSession(prev),
                            numericInspections: { ...normalizeSession(prev).numericInspections, [key]: Number(event.target.value) },
                          }))
                        }
                        className="mt-4 w-full accent-slate-900"
                      />
                    </div>
                  ))}

                  {(['膝屈曲', '膝屈曲内旋'] as const).map((key) => (
                    <div key={key} className="rounded-3xl border-2 border-slate-300 bg-slate-50 p-4">
                      <p className="text-xl font-black text-slate-900">{key}</p>
                      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Selector
                          label="左右"
                          current={safeVisit.metaInspections[key].side}
                          options={['左', '右']}
                          onSelect={(value) =>
                            setVisitInfo((prev) => ({
                              ...normalizeSession(prev),
                              metaInspections: {
                                ...normalizeSession(prev).metaInspections,
                                [key]: { ...normalizeSession(prev).metaInspections[key], side: side(value) },
                              },
                            }))
                          }
                        />
                        <label className="text-sm font-black text-slate-900">
                          cm
                          <input
                            type="number"
                            value={safeVisit.metaInspections[key].cm}
                            onChange={(event) =>
                              setVisitInfo((prev) => ({
                                ...normalizeSession(prev),
                                metaInspections: {
                                  ...normalizeSession(prev).metaInspections,
                                  [key]: { ...normalizeSession(prev).metaInspections[key], cm: Number(event.target.value) || 0 },
                                },
                              }))
                            }
                            className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 font-black outline-none"
                          />
                        </label>
                      </div>
                    </div>
                  ))}

                  {(['首', '腰'] as const).map((key) => (
                    <div key={key} className="rounded-3xl border-2 border-slate-300 bg-slate-50 p-4">
                      <p className="text-xl font-black text-slate-900">{key}</p>
                      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Selector
                          label="左右"
                          current={safeVisit.metaInspections[key].side}
                          options={['左', '右']}
                          onSelect={(value) =>
                            setVisitInfo((prev) => ({
                              ...normalizeSession(prev),
                              metaInspections: {
                                ...normalizeSession(prev).metaInspections,
                                [key]: { ...normalizeSession(prev).metaInspections[key], side: side(value) },
                              },
                            }))
                          }
                        />
                        <Selector
                          label="位置"
                          current={safeVisit.metaInspections[key].pos}
                          options={['上', '中', '下']}
                          onSelect={(value) =>
                            setVisitInfo((prev) => ({
                              ...normalizeSession(prev),
                              metaInspections: {
                                ...normalizeSession(prev).metaInspections,
                                [key]: { ...normalizeSession(prev).metaInspections[key], pos: pos(value) },
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}

                  <div className="rounded-3xl border-2 border-slate-300 bg-slate-50 p-4">
                    <p className="text-xl font-black text-slate-900">肩捻じれ</p>
                    <div className="mt-2">
                      <Selector
                        label="左右"
                        current={safeVisit.metaInspections.肩捻じれ}
                        options={['左', '右']}
                        onSelect={(value) =>
                          setVisitInfo((prev) => ({ ...normalizeSession(prev), metaInspections: { ...normalizeSession(prev).metaInspections, 肩捻じれ: side(value) } }))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border-4 border-purple-300 bg-purple-50 p-8 text-center">
                  <p className="text-lg font-black text-slate-900">美の偏差値</p>
                  <p className="text-7xl font-black text-slate-900">{score.score}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="rounded-3xl border-2 border-slate-300 bg-slate-50 p-4 text-slate-900 font-black">
                施術内容
                <textarea
                  value={safeVisit.treatmentNote}
                  onChange={(event) => setVisitInfo((prev) => ({ ...normalizeSession(prev), treatmentNote: event.target.value }))}
                  className="mt-2 h-32 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 font-black outline-none"
                />
              </label>
              <label className="rounded-3xl border-2 border-slate-300 bg-slate-50 p-4 text-slate-900 font-black">
                セルフケア指導
                <textarea
                  value={safeVisit.selfCare}
                  onChange={(event) => setVisitInfo((prev) => ({ ...normalizeSession(prev), selfCare: event.target.value }))}
                  className="mt-2 h-32 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 font-black outline-none"
                />
              </label>
            </div>

            <section className="space-y-5 rounded-3xl border-2 border-slate-300 bg-white p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-900">前後比較画像</h3>
                <button
                  type="button"
                  onClick={generateAllComparisons}
                  disabled={isGeneratingImages}
                  className="rounded-full bg-slate-900 px-6 py-3 text-white font-black disabled:opacity-50"
                >
                  {isGeneratingImages ? '生成中...' : '4ペアを一括生成'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {(['before', 'after'] as const).map((timing) => (
                  <div key={timing} className="space-y-3 rounded-3xl border-2 border-slate-300 bg-slate-50 p-4">
                    <p className="text-lg font-black text-slate-900">{timing === 'before' ? 'Before' : 'After'}</p>
                    <div className="grid grid-cols-2 gap-3">
                      {imagePairs.map((pair) => {
                        const src = safeVisit.images[timing][pair.key];
                        return (
                          <div key={`${timing}-${pair.key}`} className="space-y-2">
                            <button
                              type="button"
                              onClick={() => fileInputRefs.current[`${timing}-${pair.key}`]?.click()}
                              className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-400 bg-slate-50"
                            >
                              {src ? (
                                <img src={src} alt={`${timing}-${pair.label}`} className="absolute inset-0 h-full w-full object-cover" />
                              ) : (
                                <span className="text-xs font-black text-slate-900">{pair.label}</span>
                              )}
                            </button>
                            <input
                              ref={(node) => {
                                fileInputRefs.current[`${timing}-${pair.key}`] = node;
                              }}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => onImageSelected(timing, pair.key, event)}
                            />
                            <p className="text-center text-xs font-black text-slate-900">{pair.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <canvas ref={compositeCanvasRef} className="hidden" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {imagePairs.map((pair) =>
                  safeVisit.images.comparisons[pair.key] ? (
                    <div key={pair.key} className="rounded-2xl border-2 border-slate-300 bg-slate-50 p-3">
                      <p className="mb-2 text-sm font-black text-slate-900">{pair.label} 比較</p>
                      <img src={safeVisit.images.comparisons[pair.key]} alt={`${pair.label} comparison`} className="w-full rounded-xl" />
                    </div>
                  ) : null,
                )}
              </div>
            </section>

            <section className="space-y-4 rounded-3xl border-4 border-purple-300 bg-purple-50 p-6">
              <h3 className="text-2xl font-black text-slate-900">検査結果アーカイブ</h3>
              <p className="text-sm font-black text-slate-900">
                これまでの受診ごとの美の偏差値と、7段階評価の数値一覧です。プルダウンで過去回を開いて詳細を編集できます。
              </p>

              <div className="space-y-3 rounded-2xl border-2 border-slate-300 bg-white p-4">
                <h4 className="text-lg font-black text-slate-900">画像経過（サムネイル）</h4>
                <p className="text-xs font-black text-slate-900">
                  各受診で登録した Before / After の写真の流れです。下のプルダウンから任意の2枚を選び、横並び比較画像を生成できます。
                </p>
                <div className="space-y-4">
                  {visitArchiveRows.length === 0 ? (
                    <p className="text-sm font-black text-slate-600">画像はまだありません。</p>
                  ) : (
                    visitArchiveRows.map((row) => {
                      const thumbs: { key: string; src: string; caption: string }[] = [];
                      const s = row.session;
                      for (const timing of ['before', 'after'] as const) {
                        for (const pair of imagePairs) {
                          const src = s.images[timing][pair.key];
                          if (src) {
                            thumbs.push({
                              key: `${row.key}-${timing}-${pair.key}`,
                              src,
                              caption: `${timing === 'before' ? 'B' : 'A'}-${pair.label}`,
                            });
                          }
                        }
                      }
                      return (
                        <div key={row.key} className="rounded-xl border-2 border-slate-200 bg-slate-50 p-3">
                          <p className="mb-2 text-sm font-black text-slate-900">
                            第{row.visitNumber}回 {row.date ? `（${row.date}）` : ''}
                            {row.isDraft ? ' · 下書き' : ''}
                          </p>
                          {thumbs.length === 0 ? (
                            <p className="text-xs font-black text-slate-500">この回の写真は未登録です。</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {thumbs.map((t) => (
                                <div key={t.key} className="w-20 shrink-0">
                                  <img src={t.src} alt={t.caption} className="h-20 w-full rounded-lg border-2 border-slate-300 object-cover" />
                                  <p className="mt-1 text-center text-[10px] font-black text-slate-900">{t.caption}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border-2 border-slate-300 bg-white p-4">
                <h4 className="text-lg font-black text-slate-900">任意2枚で Before / After（横並び）</h4>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-sm font-black text-slate-900">
                    左に並べる画像
                    <select
                      value={archiveBaLeftId}
                      onChange={(event) => setArchiveBaLeftId(event.target.value)}
                      className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 font-black outline-none"
                    >
                      <option value="">選択してください</option>
                      {archiveImagePickList.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-black text-slate-900">
                    右に並べる画像
                    <select
                      value={archiveBaRightId}
                      onChange={(event) => setArchiveBaRightId(event.target.value)}
                      className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-slate-900 font-black outline-none"
                    >
                      <option value="">選択してください</option>
                      {archiveImagePickList.map((item) => (
                        <option key={`r-${item.id}`} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void generateArchiveBeforeAfter()}
                  disabled={isArchiveBaGenerating || archiveImagePickList.length === 0}
                  className="rounded-full bg-slate-900 px-6 py-3 text-white font-black disabled:opacity-50"
                >
                  {isArchiveBaGenerating ? '生成中…' : '2枚横並び画像を生成'}
                </button>
                <canvas ref={archiveBaCanvasRef} className="hidden" />
                {archiveBaPreview ? (
                  <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 p-3">
                    <p className="mb-2 text-sm font-black text-slate-900">生成結果</p>
                    <p className="mb-3 text-xs font-black text-slate-700">
                      「公式LINEにプッシュ送信」は Messaging API です。PC のブラウザからも、サーバーの{' '}
                      <code className="rounded bg-slate-200 px-1">/api/line/push-image</code> を叩いて画像を届けます（基本情報の LINE userId が必要。サーバーに{' '}
                      <code className="rounded bg-slate-200 px-1">LINE_CHANNEL_ACCESS_TOKEN</code> と Storage 用キーが必要です）。
                    </p>
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={downloadArchivePreview}
                        className="rounded-xl border-2 border-slate-900 bg-slate-900 px-4 py-2 text-sm text-white font-black"
                      >
                        端末に保存
                      </button>
                      <button
                        type="button"
                        onClick={() => void sendArchiveImageViaLine()}
                        disabled={linePushSending || !baseInfo.lineUserId.trim()}
                        className="rounded-xl border-2 border-emerald-700 bg-emerald-600 px-4 py-2 text-sm text-white font-black disabled:opacity-50"
                      >
                        {linePushSending ? '送信中…' : '公式LINEにプッシュ送信'}
                      </button>
                    </div>
                    {linePushNotice ? (
                      <p className="mb-2 text-xs font-black text-emerald-800">{linePushNotice}</p>
                    ) : null}
                    <img src={archiveBaPreview} alt="アーカイブ比較" className="w-full rounded-xl border-2 border-slate-200" />
                  </div>
                ) : null}
              </div>

              <div className="max-h-[min(70vh,520px)] overflow-auto rounded-2xl border-2 border-slate-300 bg-white">
                <table className="min-w-max w-full border-collapse text-left text-sm font-black text-slate-900">
                  <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
                    <tr>
                      <th className="border-2 border-slate-300 px-3 py-2 whitespace-nowrap">回</th>
                      <th className="border-2 border-slate-300 px-3 py-2 whitespace-nowrap">受診日</th>
                      <th className="border-2 border-slate-300 px-3 py-2 whitespace-nowrap">美の偏差値</th>
                      {numericKeys.map((key) => (
                        <th key={key} className="border-2 border-slate-300 px-2 py-2 whitespace-nowrap text-center">
                          {key}
                        </th>
                      ))}
                      <th className="border-2 border-slate-300 px-3 py-2 whitespace-nowrap">備考</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visitArchiveRows.length === 0 ? (
                      <tr>
                        <td colSpan={numericKeys.length + 4} className="border-2 border-slate-300 px-4 py-6 text-center text-slate-600">
                          まだ受診記録がありません。保存するとここに表示されます。
                        </td>
                      </tr>
                    ) : (
                      visitArchiveRows.map((row) => (
                        <tr
                          key={row.key}
                          className={
                            row.isCurrent
                              ? 'bg-purple-100/80'
                              : row.isDraft
                                ? 'bg-amber-50'
                                : 'bg-white'
                          }
                        >
                          <td className="border-2 border-slate-300 px-3 py-2 whitespace-nowrap">第{row.visitNumber}回</td>
                          <td className="border-2 border-slate-300 px-3 py-2 whitespace-nowrap">{row.date || '—'}</td>
                          <td className="border-2 border-slate-300 px-3 py-2 whitespace-nowrap font-black">{row.beautyScore.toFixed(1)}</td>
                          {numericKeys.map((key) => (
                            <td key={key} className="border-2 border-slate-300 px-2 py-2 text-center tabular-nums">
                              {(row.numeric[key] ?? 0).toFixed(1)}
                            </td>
                          ))}
                          <td className="border-2 border-slate-300 px-3 py-2 whitespace-nowrap text-xs">
                            {row.isDraft ? '新規（未保存）' : row.isCurrent ? '表示中' : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        )}
      </main>
    </div>
  );
}
