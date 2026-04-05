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
}

interface Patient {
  id: string;
  name: string;
  base_info?: { // ?をつけて必須ではなくする
    gender?: string;
    age?: string;
    address?: string;
    phone?: string;
    history?: string;
    surgery?: string;
    romLimit?: string;
    goals?: string;
  };
  chart_data?: { // ?をつけて必須ではなくする
    latest?: Session;
    history?: Session[];
  };
  last_visit?: string;
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

  const [baseInfo, setBaseInfo] = useState({
    name: '', gender: '', age: '', address: '', phone: '',
    history: '', surgery: '', romLimit: '', goals: ''
  });

  const [visitInfo, setVisitInfo] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    inspections: SEVEN_LEVEL_FIELDS.reduce((acc, f) => ({ ...acc, [f]: 3.5 }), {} as Record<string, number>),
    kneeFlexion: 0,
    kneeInternalRotation: 0,
    waistPos: { side: '左', part: '中' },
    neckPos: { side: '左', part: '中' },
    treatmentNote: '',
    selfCare: ''
  });

  const calculateBeautyScore = () => {
    const values = Object.values(visitInfo.inspections);
    const sum = values.reduce((a, b) => a + b, 0);
    const score = ((45 - (sum * 2)) * 2) - 50;
    return { sum, score: Math.round(score * 10) / 10 };
  };

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase.from('patient').select('*');
      if (error) throw error;
      if (data) setPatients(data as Patient[]);
    } catch (err) {
      console.error("データ取得エラー:", err);
    }
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
    
    const sessionRecord: Session = { 
      ...visitInfo, 
      totalSum: sum, 
      beautyScore: score,
      bodyMapData 
    };
    
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
    setBaseInfo({
      name: p.name || '',
      gender: p.base_info?.gender || '',
      age: p.base_info?.age || '',
      address: p.base_info?.address || '',
      phone: p.base_info?.phone || '',
      history: p.base_info?.history || '',
      surgery: p.base_info?.surgery || '',
      romLimit: p.base_info?.romLimit || '',
      goals: p.base_info?.goals || ''
    });
    const latest = p.chart_data?.latest;
    if (latest) {
      setVisitInfo({
        ...latest,
        inspections: latest.inspections || SEVEN_LEVEL_FIELDS.reduce((acc, f) => ({ ...acc, [f]: 3.5 }), {} as Record<string, number>)
      });
    }
    setView('edit');
  };

  if (view === 'list') {
    return (
      <div className="p-8 bg-slate-50 min-h-screen">
        <h1 className="text-3xl font-serif font-bold text-slate-800 mb-8">mabune Core</h1>
        <button onClick={() => { setSelectedId(null); setView('edit'); }} className="mb-8 bg-slate-900 text-white px-8 py-3 rounded-full font-bold">＋ 新規カルテ</button>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {patients.map(p => (
            <div key={p.id} onClick={() => openEdit(p)} className="p-6 bg-white rounded-3xl border border-slate-100 cursor-pointer hover:shadow-xl transition">
              <div className="text-xl font-bold">{p.name || '名前なし'} 様</div>
              <div className="text-xs text-slate-400 mt-2">最終受診: {p.last_visit || '---'}</div>
              <div className="mt-4 text-blue-600 font-mono font-bold">Score: {p.chart_data?.latest?.beautyScore ?? '--'}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen flex flex-col">
      <header className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-50">
        <button onClick={() => setView('list')} className="text-slate-400">✕ 閉じる</button>
        <div className="flex gap-6 font-bold text-sm">
          <button onClick={() => setActiveTab('base')} className={activeTab === 'base' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-300'}>基本情報</button>
          <button onClick={() => setActiveTab('visit')} className={activeTab === 'visit' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-300'}>受診情報</button>
        </div>
        <button onClick={handleSave} className="bg-blue-600 text-white px-8 py-2 rounded-full font-bold">保存</button>
      </header>

      <main className="p-8 max-w-6xl mx-auto w-full">
        {activeTab === 'visit' && (
          <div className="space-y-12">
            <div className="bg-slate-900 text-white p-12 rounded-[3rem] text-center">
              <h3 className="text-blue-400 text-xs mb-4">BEAUTY DEVIATION SCORE</h3>
              <div className="text-8xl font-serif italic">{calculateBeautyScore().score}</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="space-y-4">
                <h3 className="font-bold border-l-4 border-blue-600 pl-2">Body Map</h3>
                <div className="relative aspect-[3/4] bg-slate-50 rounded-2xl border overflow-hidden">
                  <img src="/body-map.png" className="absolute inset-0 w-full h-full object-contain p-4 opacity-50" />
                  <canvas ref={canvasRef} width={400} height={533} onMouseDown={draw} className="absolute inset-0 w-full h-full cursor-crosshair" />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold border-l-4 border-blue-600 pl-2">Inspections</h3>
                <div className="grid gap-2 max-h-[500px] overflow-y-auto pr-2">
                  {SEVEN_LEVEL_FIELDS.map(f => (
                    <div key={f} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg text-sm">
                      <label>{f}</label>
                      <input type="range" min="2" max="5" step="0.5" value={visitInfo.inspections[f]} 
                        onChange={e => setVisitInfo({...visitInfo, inspections: {...visitInfo.inspections, [f]: parseFloat(e.target.value)}})} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'base' && (
          <div className="space-y-6">
            <input placeholder="氏名" value={baseInfo.name} onChange={e => setBaseInfo({...baseInfo, name: e.target.value})} className="w-full p-2 border-b text-2xl font-bold" />
            <input placeholder="住所" value={baseInfo.address} onChange={e => setBaseInfo({...baseInfo, address: e.target.value})} className="w-full p-2 border-b" />
          </div>
        )}
      </main>
    </div>
  );
}