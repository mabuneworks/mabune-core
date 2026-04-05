'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// --- 1. 型定義 ---
interface Session {
  date: string;
  amount: number;
  inspections: Record<string, number>;
  kneeFlexion: number;
  kneeInternalRotation: number;
  waistPos: { side: string; part: string };
  neckPos: { side: string; part: string };
  totalSum: number;
  beautyScore: number;
  treatmentNote: string;
  selfCare: string;
  bodyMapData?: string;
  images: {
    before: string[];
    after: string[];
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

const SEVEN_LEVEL_FIELDS = [
  "顔_左", "顔_右", "顔_傾き", "顔_捻れ", "顔_スライド",
  "肩上_左", "肩上_右", "肩捻じれ_左", "肩捻じれ_右",
  "肩内旋左", "肩内旋右", "軸_左", "軸_右",
  "AS_左", "AS_右", "大転子", "肘", "肩", "耳"
];

export default function MabuneUltimateCore() {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [activeTab, setActiveTab] = useState<'base' | 'visit' | 'archive'>('visit');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // A: 基本情報 (全項目)
  const [baseInfo, setBaseInfo] = useState({
    name: '', gender: '', age: '', address: '', phone: '',
    history: '', surgery: '', romLimit: '', goals: ''
  });

  // B: 受診情報
  const [visitInfo, setVisitInfo] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    inspections: SEVEN_LEVEL_FIELDS.reduce((acc, f) => ({ ...acc, [f]: 3.5 }), {} as Record<string, number>),
    kneeFlexion: 0,
    kneeInternalRotation: 0,
    waistPos: { side: '左', part: '中' },
    neckPos: { side: '左', part: '中' },
    treatmentNote: '',
    selfCare: '',
    images: { before: ['', '', '', ''], after: ['', '', '', ''] }
  });

  // --- 2. 美の偏差値計算 ((45 - (合計 * 2)) * 2 + 50) ---
  const calculateBeautyScore = () => {
    const values = Object.values(visitInfo.inspections);
    const sum = values.reduce((a, b) => a + b, 0);
    const score = ((45 - (sum * 2)) * 2) + 50;
    return { sum, score: Math.round(score * 10) / 10 };
  };

  const fetchPatients = async () => {
    const { data } = await supabase.from('patient').select('*');
    if (data) setPatients(data as Patient[]);
  };

  useEffect(() => { fetchPatients(); }, []);

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ctx.fillStyle = "#FF3B30";
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  };

  const handleSave = async () => {
    const { sum, score } = calculateBeautyScore();
    const bodyMapData = canvasRef.current?.toDataURL();
    const sessionRecord: Session = { ...visitInfo, totalSum: sum, beautyScore: score, bodyMapData };
    const targetPatient = patients.find(p => p.id === selectedId);
    const newHistory = [...(targetPatient?.chart_data?.history || []), sessionRecord];

    const payload = {
      name: baseInfo.name,
      base_info: { ...baseInfo },
      chart_data: { latest: sessionRecord, history: newHistory },
      last_visit: sessionRecord.date
    };

    if (selectedId) {
      await supabase.from('patient').update(payload).eq('id', selectedId);
    } else {
      await supabase.from('patient').insert([payload]);
    }
    setView('list');
    fetchPatients();
  };

  const openEdit = (p: Patient) => {
    setSelectedId(p.id);
    setBaseInfo({ name: p.name, ...p.base_info });
    if (p.chart_data?.latest) setVisitInfo({ ...p.chart_data.latest });
    setView('edit');
  };

  if (view === 'list') {
    return (
      <div className="p-8 bg-slate-100 min-h-screen text-slate-900">
        <header className="max-w-6xl mx-auto flex justify-between items-center mb-10">
          <h1 className="text-3xl font-serif font-bold">mabune Core 受付</h1>
          <button onClick={() => { setSelectedId(null); setView('edit'); }} className="bg-slate-900 text-white px-8 py-3 rounded-full font-bold shadow-lg">＋ 新規カルテ</button>
        </header>
        <div className="max-w-6xl mx-auto grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {patients.map(p => (
            <div key={p.id} onClick={() => openEdit(p)} className="p-6 bg-white rounded-3xl shadow-sm border-2 border-transparent hover:border-slate-900 cursor-pointer transition">
              <div className="text-xl font-bold">{p.name} 様</div>
              <div className="text-sm font-bold text-blue-700 mt-2">偏差値: {p.chart_data?.latest?.beautyScore ?? '--'}</div>
              <div className="text-xs text-slate-500 mt-1">住所: {p.base_info?.address}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen flex flex-col text-slate-900">
      <header className="p-4 border-b-2 flex justify-between items-center sticky top-0 bg-white z-50">
        <button onClick={() => setView('list')} className="font-bold text-slate-500">✕ 閉じる</button>
        <div className="flex gap-6 font-black text-sm">
          <button onClick={() => setActiveTab('base')} className={activeTab === 'base' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-slate-400'}>基本情報</button>
          <button onClick={() => setActiveTab('visit')} className={activeTab === 'visit' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-slate-400'}>受診情報</button>
          <button onClick={() => setActiveTab('archive')} className={activeTab === 'archive' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-slate-400'}>アーカイブ</button>
        </div>
        <button onClick={handleSave} className="bg-blue-700 text-white px-8 py-2 rounded-full font-bold shadow-lg">保存</button>
      </header>

      <main className="p-8 max-w-6xl mx-auto w-full">
        {activeTab === 'visit' && (
          <div className="space-y-16">
            <section className="bg-slate-900 text-white p-12 rounded-[3.5rem] text-center shadow-2xl">
              <h3 className="text-blue-400 text-xs font-black tracking-widest mb-4 uppercase">Beauty Deviation Score</h3>
              <div className="text-9xl font-serif font-bold italic">{calculateBeautyScore().score}</div>
              <div className="text-slate-400 text-sm mt-4 font-bold">検査数値合計: {calculateBeautyScore().sum.toFixed(1)}</div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              <div className="space-y-6">
                <h3 className="text-xl font-black border-l-8 border-blue-700 pl-4">Body Map (人体図自由記載)</h3>
                <div className="relative aspect-[3/4] bg-slate-50 rounded-[2rem] border-2 border-slate-200 overflow-hidden shadow-inner">
                  <img src="/body-map.png" className="absolute inset-0 w-full h-full object-contain p-8 opacity-60" alt="Body Map" />
                  <canvas ref={canvasRef} width={450} height={600} onMouseDown={draw} className="absolute inset-0 w-full h-full cursor-crosshair" />
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-black border-l-8 border-blue-700 pl-4">Inspection (19項目)</h3>
                <div className="grid gap-3 max-h-[600px] overflow-y-auto pr-4 border-b-2">
                  {SEVEN_LEVEL_FIELDS.map(f => (
                    <div key={f} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="text-sm font-black text-slate-700">{f}</label>
                      <div className="flex items-center gap-4">
                        <input type="range" min="2" max="5" step="0.5" value={visitInfo.inspections[f]} 
                          onChange={e => setVisitInfo({...visitInfo, inspections: {...visitInfo.inspections, [f]: parseFloat(e.target.value)}})} className="accent-blue-700" />
                        <span className="font-mono font-black text-xl text-blue-700 w-10 text-right">{visitInfo.inspections[f].toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <section className="space-y-8">
              <h3 className="text-xl font-black border-l-8 border-blue-700 pl-4">Visual Record (Before & After)</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div>
                  <p className="text-center font-black text-slate-400 mb-4 tracking-widest uppercase">Before (4 Photos)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[0,1,2,3].map(i => (
                      <div key={i} className="aspect-[3/4] bg-slate-100 rounded-2xl border-4 border-dashed border-slate-300 flex items-center justify-center text-slate-400 font-bold">
                        Photo {i+1}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-center font-black text-blue-600 mb-4 tracking-widest uppercase">After (4 Photos)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[0,1,2,3].map(i => (
                      <div key={i} className="aspect-[3/4] bg-blue-50 rounded-2xl border-4 border-dashed border-blue-200 flex items-center justify-center text-blue-300 font-bold">
                        Photo {i+1}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="font-black text-slate-500 text-sm">施術内容・セルフケア指導</h4>
                <textarea value={visitInfo.treatmentNote} onChange={e => setVisitInfo({...visitInfo, treatmentNote: e.target.value})} className="w-full h-48 p-4 bg-slate-50 border-2 border-slate-200 rounded-3xl font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-4 h-fit font-bold">
                <div className="p-4 bg-slate-50 rounded-2xl border-2">受診日<br/><input type="date" value={visitInfo.date} onChange={e => setVisitInfo({...visitInfo, date: e.target.value})} className="w-full bg-transparent font-black mt-2" /></div>
                <div className="p-4 bg-slate-50 rounded-2xl border-2">金額<br/><input type="number" value={visitInfo.amount} onChange={e => setVisitInfo({...visitInfo, amount: parseInt(e.target.value)})} className="w-full bg-transparent font-black mt-2" /></div>
                <div className="p-4 bg-slate-50 rounded-2xl border-2">膝屈曲 (cm)<br/><input type="number" value={visitInfo.kneeFlexion} onChange={e => setVisitInfo({...visitInfo, kneeFlexion: parseFloat(e.target.value)})} className="w-full bg-transparent font-black mt-2" /></div>
                <div className="p-4 bg-slate-50 rounded-2xl border-2">内旋 (cm)<br/><input type="number" value={visitInfo.kneeInternalRotation} onChange={e => setVisitInfo({...visitInfo, kneeInternalRotation: parseFloat(e.target.value)})} className="w-full bg-transparent font-black mt-2" /></div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'base' && (
          <div className="space-y-12">
            <h2 className="text-2xl font-black border-l-8 border-slate-900 pl-4">Patient Profile (基本情報)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6 font-bold">
                <div>氏名<input value={baseInfo.name} onChange={e => setBaseInfo({...baseInfo, name: e.target.value})} className="w-full p-4 border-b-4 border-slate-900 text-3xl font-black outline-none" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>性別<input value={baseInfo.gender} onChange={e => setBaseInfo({...baseInfo, gender: e.target.value})} className="w-full p-4 bg-slate-100 rounded-2xl" /></div>
                  <div>年齢<input value={baseInfo.age} onChange={e => setBaseInfo({...baseInfo, age: e.target.value})} className="w-full p-4 bg-slate-100 rounded-2xl" /></div>
                </div>
                <div>住所<input value={baseInfo.address} onChange={e => setBaseInfo({...baseInfo, address: e.target.value})} className="w-full p-4 bg-slate-100 rounded-2xl" /></div>
                <div>電話番号<input value={baseInfo.phone} onChange={e => setBaseInfo({...baseInfo, phone: e.target.value})} className="w-full p-4 bg-slate-100 rounded-2xl" /></div>
              </div>
              <div className="space-y-6 font-bold">
                <div>改善したいもの・どうありたいか<textarea value={baseInfo.goals} onChange={e => setBaseInfo({...baseInfo, goals: e.target.value})} className="w-full h-32 p-4 bg-slate-50 border-2 rounded-2xl" /></div>
                <div>既往歴・手術歴<textarea value={baseInfo.history} onChange={e => setBaseInfo({...baseInfo, history: e.target.value})} className="w-full h-24 p-4 bg-slate-50 border-2 rounded-2xl" /></div>
                <div>可動域制限・医師の指示<textarea value={baseInfo.romLimit} onChange={e => setBaseInfo({...baseInfo, romLimit: e.target.value})} className="w-full h-24 p-4 bg-slate-50 border-2 rounded-2xl" /></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}