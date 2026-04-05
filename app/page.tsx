'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// --- 1. 型定義（TypeScriptのエラーを根絶する） ---
interface Session {
  date: string;
  amount: number;
  inspections: Record<string, number>;
  meta: Record<string, any>; // 左右や位置の選択状態を保存
  kneeFlexion: { side: string; cm: number };
  kneeInternalRotation: { side: string; cm: number };
  neck: { side: string; pos: string };
  waist: { side: string; pos: string };
  totalSum: number;
  beautyScore: number;
  treatmentNote: string;
  selfCare: string;
  bodyMapData?: string;
  images: {
    before: string[];
    after: string[];
    combined: string; // ここを必須(string)に固定
  };
}

interface Patient {
  id: string;
  name: string;
  base_info: {
    gender: string;
    age: string;
    address: string;
    phone: string;
    history: string;
    surgery: string;
    romLimit: string;
    goals: string;
  };
  chart_data: {
    latest: Session;
    history: Session[];
  };
  last_visit: string;
}

// 7段階評価(2.0-5.0)の対象11項目
const INSPECTION_KEYS = [
  "顔", "肩上", "肩捻じれ", "肩内旋左", "肩内旋右", "軸", "AS", "大転子", "肘", "肩", "耳"
];

export default function MabuneUltimateCore() {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [activeTab, setActiveTab] = useState<'base' | 'visit' | 'archive'>('visit');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- 2. データ初期化 ---
  const [baseInfo, setBaseInfo] = useState({
    name: '', gender: '', age: '', address: '', phone: '',
    history: '', surgery: '', romLimit: '', goals: ''
  });

  const initialSession: Session = {
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    inspections: INSPECTION_KEYS.reduce((acc, k) => ({ ...acc, [k]: 3.5 }), {}),
    meta: { faceSide: '左', faceType: '捻れ', shoulderTopSide: '左', axisSide: '左', asSide: '左' },
    kneeFlexion: { side: '左', cm: 0 },
    kneeInternalRotation: { side: '左', cm: 0 },
    neck: { side: '左', pos: '中' },
    waist: { side: '左', pos: '中' },
    totalSum: 0,
    beautyScore: 0,
    treatmentNote: '',
    selfCare: '',
    images: { before: ['', '', '', ''], after: ['', '', '', ''], combined: '' }
  };

  const [visitInfo, setVisitInfo] = useState<Session>(initialSession);

  // --- 3. 美の偏差値計算 ((45 - (合計 * 2)) * 2 + 50) ---
  const calculateBeautyScore = () => {
    const vals = Object.values(visitInfo.inspections) as number[];
    const sum = vals.reduce((a, b) => a + b, 0);
    const score = ((45 - (sum * 2)) * 2) + 50;
    return { sum, score: Math.round(score * 10) / 10 };
  };

  const fetchPatients = async () => {
    const { data } = await supabase.from('patient').select('*');
    if (data) setPatients(data as Patient[]);
  };

  useEffect(() => { fetchPatients(); }, []);

  const handleSave = async () => {
    const { sum, score } = calculateBeautyScore();
    const bodyMapData = canvasRef.current?.toDataURL() || "";
    
    const sessionRecord: Session = { ...visitInfo, totalSum: sum, beautyScore: score, bodyMapData };
    const target = patients.find(p => p.id === selectedId);
    const newHistory = [...(target?.chart_data?.history || []), sessionRecord];

    const payload = {
      name: baseInfo.name,
      base_info: baseInfo,
      chart_data: { latest: sessionRecord, history: newHistory },
      last_visit: sessionRecord.date
    };

    if (selectedId) await supabase.from('patient').update(payload).eq('id', selectedId);
    else await supabase.from('patient').insert([payload]);

    setView('list'); fetchPatients();
  };

  const openEdit = (p: Patient) => {
    setSelectedId(p.id);
    setBaseInfo({ name: p.name, ...p.base_info });
    if (p.chart_data?.latest) {
      // images.combined が undefined の場合に備えて補完する
      const latest = p.chart_data.latest;
      setVisitInfo({
        ...latest,
        images: {
          ...latest.images,
          combined: latest.images.combined || ''
        }
      });
    } else {
      setVisitInfo(initialSession);
    }
    setView('edit');
  };

  // --- UI部品 ---
  const Selector = ({ label, current, options, onSelect }: any) => (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-black text-slate-500">{label}</span>
      <div className="flex gap-2">
        {options.map((opt: string) => (
          <button key={opt} onClick={() => onSelect(opt)} className={`px-4 py-2 rounded-xl font-black transition ${current === opt ? 'bg-blue-700 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>{opt}</button>
        ))}
      </div>
    </div>
  );

  if (view === 'list') {
    return (
      <div className="p-8 bg-slate-50 min-h-screen font-sans text-slate-900">
        <header className="max-w-6xl mx-auto flex justify-between items-center mb-12">
          <h1 className="text-4xl font-serif font-black tracking-tighter">mabune Core</h1>
          <button onClick={() => { setSelectedId(null); setVisitInfo(initialSession); setView('edit'); }} className="bg-slate-900 text-white px-10 py-4 rounded-full font-black shadow-2xl hover:scale-105 transition">＋ 新規ゲスト登録</button>
        </header>
        <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {patients.map(p => (
            <div key={p.id} onClick={() => openEdit(p)} className="p-8 bg-white rounded-[2.5rem] shadow-sm border-4 border-transparent hover:border-blue-600 cursor-pointer transition-all">
              <div className="text-2xl font-black">{p.name} 様</div>
              <div className="mt-4 text-blue-700 font-mono font-black text-xl">Beauty Score: {p.chart_data?.latest?.beautyScore ?? '--'}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen flex flex-col text-slate-900 font-sans">
      <header className="p-6 border-b-4 flex justify-between items-center sticky top-0 bg-white z-50">
        <button onClick={() => setView('list')} className="text-2xl font-black text-slate-400">✕</button>
        <div className="flex gap-8">
          {['base', 'visit'].map((t) => (
            <button key={t} onClick={() => setActiveTab(t as any)} className={`pb-2 text-sm font-black uppercase tracking-widest ${activeTab === t ? 'text-blue-700 border-b-8 border-blue-700' : 'text-slate-300'}`}>{t === 'base' ? '基本情報' : '受診・検査'}</button>
          ))}
        </div>
        <button onClick={handleSave} className="bg-blue-700 text-white px-10 py-3 rounded-full font-black shadow-xl">保存</button>
      </header>

      <main className="p-8 max-w-6xl mx-auto w-full pb-32">
        {activeTab === 'visit' && (
          <div className="space-y-20">
            {/* スコア表示 */}
            <section className="bg-slate-900 text-white p-16 rounded-[4rem] text-center shadow-2xl relative overflow-hidden">
              <h3 className="text-blue-400 text-sm font-black tracking-[0.5em] mb-6 uppercase">Beauty Deviation Score</h3>
              <div className="text-[12rem] font-serif font-black italic leading-none">{calculateBeautyScore().score}</div>
              <div className="text-slate-500 font-black mt-8">合計数値: {calculateBeautyScore().sum.toFixed(1)}</div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
              {/* 人体図 */}
              <div className="space-y-6">
                <h3 className="text-2xl font-black border-l-[12px] border-blue-700 pl-4">Body Map</h3>
                <div className="relative aspect-[3/4] bg-slate-50 rounded-[3rem] border-4 border-slate-200 overflow-hidden">
                  <img src="/body-map.png" className="absolute inset-0 w-full h-full object-contain p-8 opacity-40" />
                  <canvas ref={canvasRef} width={450} height={600} className="absolute inset-0 w-full h-full cursor-crosshair" />
                </div>
              </div>

              {/* 検査項目 */}
              <div className="space-y-8">
                <h3 className="text-2xl font-black border-l-[12px] border-blue-700 pl-4">Inspections</h3>
                <div className="space-y-8 max-h-[800px] overflow-y-auto pr-4">
                  {/* 顔セクション */}
                  <div className="p-6 bg-slate-50 rounded-[2rem] border-2 space-y-6">
                    <div className="flex justify-between items-center"><span className="text-xl font-black text-blue-900 underline decoration-4">顔</span><span className="text-3xl font-mono font-black text-blue-700">{visitInfo.inspections["顔"].toFixed(1)}</span></div>
                    <div className="grid grid-cols-2 gap-4">
                      <Selector label="左右" current={visitInfo.meta.faceSide} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, meta: {...visitInfo.meta, faceSide: v}})} />
                      <Selector label="種類" current={visitInfo.meta.faceType} options={['捻れ', '傾き', 'スライド']} onSelect={(v: any) => setVisitInfo({...visitInfo, meta: {...visitInfo.meta, faceType: v}})} />
                    </div>
                    <input type="range" min="2" max="5" step="0.5" value={visitInfo.inspections["顔"]} onChange={e => setVisitInfo({...visitInfo, inspections: {...visitInfo.inspections, "顔": parseFloat(e.target.value)}})} className="w-full h-4 accent-blue-700 cursor-pointer" />
                  </div>

                  {/* その他7段階 */}
                  {INSPECTION_KEYS.filter(k => k !== "顔").map(k => (
                    <div key={k} className="p-6 bg-slate-50 rounded-[2rem] border-2 space-y-4">
                      <div className="flex justify-between items-center"><span className="text-xl font-black text-slate-800">{k}</span><span className="text-3xl font-mono font-black text-blue-700">{visitInfo.inspections[k].toFixed(1)}</span></div>
                      {["肩上", "軸", "AS"].includes(k) && <Selector label="左右" current={visitInfo.meta[`${k}Side`]} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, meta: {...visitInfo.meta, [`${k}Side`]: v}})} />}
                      <input type="range" min="2" max="5" step="0.5" value={visitInfo.inspections[k]} onChange={e => setVisitInfo({...visitInfo, inspections: {...visitInfo.inspections, [k]: parseFloat(e.target.value)}})} className="w-full h-4 accent-blue-700" />
                    </div>
                  ))}

                  {/* センチ単位項目 */}
                  {['膝屈曲', '膝屈曲内旋'].map((k) => {
                    const key = k === '膝屈曲' ? 'kneeFlexion' : 'kneeInternalRotation';
                    return (
                      <div key={k} className="p-6 bg-slate-900 text-white rounded-[2rem] space-y-4">
                        <span className="text-xl font-black text-blue-400">{k}</span>
                        <div className="flex gap-4">
                          {['左', '右'].map(s => <button key={s} onClick={() => setVisitInfo({...visitInfo, [key]: {...(visitInfo as any)[key], side: s}})} className={`flex-grow py-3 rounded-xl font-black ${(visitInfo as any)[key].side === s ? 'bg-blue-600' : 'bg-slate-800 text-slate-500'}`}>{s}</button>)}
                        </div>
                        <div className="flex items-center gap-4 bg-white p-4 rounded-xl">
                          <input type="number" value={(visitInfo as any)[key].cm} onChange={e => setVisitInfo({...visitInfo, [key]: {...(visitInfo as any)[key], cm: parseFloat(e.target.value)}})} className="text-4xl font-black text-slate-900 w-full bg-transparent outline-none" />
                          <span className="text-slate-400 font-black">cm</span>
                        </div>
                      </div>
                    );
                  })}

                  {/* 首・腰 */}
                  {['neck', 'waist'].map(k => (
                    <div key={k} className="p-6 bg-slate-50 rounded-[2rem] border-2 space-y-6">
                      <span className="text-xl font-black text-slate-800">{k === 'neck' ? '首' : '腰'}</span>
                      <Selector label="左右" current={(visitInfo as any)[k].side} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, [k]: {...(visitInfo as any)[k], side: v}})} />
                      <Selector label="位置" current={(visitInfo as any)[k].pos} options={['上', '中', '下']} onSelect={(v: any) => setVisitInfo({...visitInfo, [k]: {...(visitInfo as any)[k], pos: v}})} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Before After 画像エリア */}
            <section className="space-y-10">
              <h3 className="text-3xl font-black border-l-[16px] border-blue-700 pl-6">Visual Record</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div>
                  <p className="text-center font-black text-slate-400 mb-6 tracking-widest uppercase">Before (4枚)</p>
                  <div className="grid grid-cols-2 gap-4">
                    {[0,1,2,3].map(i => <div key={i} className="aspect-[3/4] bg-slate-100 rounded-[2.5rem] border-4 border-dashed border-slate-300 flex items-center justify-center text-slate-400 font-black cursor-pointer hover:bg-slate-200 transition">📸 PHOTO</div>)}
                  </div>
                </div>
                <div>
                  <p className="text-center font-black text-blue-700 mb-6 tracking-widest uppercase">After (4枚)</p>
                  <div className="grid grid-cols-2 gap-4">
                    {[0,1,2,3].map(i => <div key={i} className="aspect-[3/4] bg-blue-50 rounded-[2.5rem] border-4 border-dashed border-blue-200 flex items-center justify-center text-blue-300 font-black cursor-pointer hover:bg-blue-100 transition">📸 PHOTO</div>)}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'base' && (
          <div className="space-y-12">
            <h2 className="text-4xl font-black border-l-[20px] border-slate-900 pl-6">Patient Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                <div className="border-b-8 border-slate-900 pb-2">氏名<input value={baseInfo.name} onChange={e => setBaseInfo({...baseInfo, name: e.target.value})} className="w-full text-5xl font-black bg-transparent outline-none" /></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-6 bg-slate-100 rounded-3xl">年齢<input value={baseInfo.age} onChange={e => setBaseInfo({...baseInfo, age: e.target.value})} className="w-full bg-transparent text-2xl font-black" /></div>
                  <div className="p-6 bg-slate-100 rounded-3xl">性別<input value={baseInfo.gender} onChange={e => setBaseInfo({...baseInfo, gender: e.target.value})} className="w-full bg-transparent text-2xl font-black" /></div>
                </div>
                <div className="p-6 bg-slate-100 rounded-3xl">住所<input value={baseInfo.address} onChange={e => setBaseInfo({...baseInfo, address: e.target.value})} className="w-full bg-transparent text-2xl font-black" /></div>
              </div>
              <div className="space-y-6">
                <div className="p-8 bg-slate-900 text-white rounded-[3rem] shadow-2xl">なりたい姿・改善したいもの<textarea value={baseInfo.goals} onChange={e => setBaseInfo({...baseInfo, goals: e.target.value})} className="w-full h-48 bg-transparent text-2xl font-serif mt-4 outline-none" /></div>
                <div className="p-8 bg-slate-50 border-4 border-slate-200 rounded-[3rem]">既往歴・手術歴<textarea value={baseInfo.history} onChange={e => setBaseInfo({...baseInfo, history: e.target.value})} className="w-full h-32 bg-transparent text-xl font-black mt-2 outline-none" /></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}