'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// --- 1. 型定義（エラーの門番を黙らせる設定） ---
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

// ゆかりさん指定の「7段階（2.0〜5.0）」を入力する19項目
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

  // A: 基本情報
  const [baseInfo, setBaseInfo] = useState({
    name: '', gender: '', age: '', address: '', phone: '',
    history: '', surgery: '', romLimit: '', goals: ''
  });

  // B: 受診情報（今回の1枚）
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

  // --- 2. 美の偏差値ロジック (45 - (合計 * 2)) * 2 - 50 ---
  const calculateBeautyScore = () => {
    const values = Object.values(visitInfo.inspections);
    const sum = values.reduce((a, b) => a + b, 0);
    const score = ((45 - (sum * 2)) * 2) - 50;
    return { sum, score: Math.round(score * 10) / 10 };
  };

  const fetchPatients = async () => {
    const { data } = await supabase.from('patient').select('*');
    if (data) setPatients(data as Patient[]);
  };

  useEffect(() => { fetchPatients(); }, []);

  // 人体図の描画（ペン機能）
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

  // --- 3. 保存と更新 ---
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

  // 編集画面を開く（エラーの起きていた部分を修正済み）
  const openEdit = (p: Patient) => {
    setSelectedId(p.id);
    // nameとbase_infoを合体させてセットする
    setBaseInfo({ name: p.name, ...p.base_info });
    const latest = p.chart_data?.latest;
    if (latest) {
      setVisitInfo({ ...latest });
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
              <div className="text-xl font-bold">{p.name} 様</div>
              <div className="text-xs text-slate-400 mt-2">最終受診: {p.last_visit} / {p.base_info.address}</div>
              <div className="mt-4 text-blue-600 font-mono font-bold">Beauty Score: {p.chart_data?.latest?.beautyScore}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen flex flex-col font-sans">
      <header className="p-4 border-b flex justify-between items-center sticky top-0 bg-white z-50">
        <button onClick={() => setView('list')} className="text-slate-400">✕ 閉じる</button>
        <div className="flex gap-6 font-bold text-sm">
          <button onClick={() => setActiveTab('base')} className={activeTab === 'base' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-300'}>基本情報</button>
          <button onClick={() => setActiveTab('visit')} className={activeTab === 'visit' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-300'}>受診情報</button>
          <button onClick={() => setActiveTab('archive')} className={activeTab === 'archive' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-300'}>アーカイブ</button>
        </div>
        <button onClick={handleSave} className="bg-blue-600 text-white px-8 py-2 rounded-full font-bold shadow-lg">保存</button>
      </header>

      <main className="p-8 max-w-6xl mx-auto w-full">
        {activeTab === 'visit' && (
          <div className="space-y-16">
            {/* 偏差値表示 */}
            <div className="bg-slate-900 text-white p-12 rounded-[3.5rem] text-center shadow-2xl">
              <h3 className="text-blue-400 text-xs font-black tracking-[0.4em] mb-4 uppercase">Beauty Deviation Score</h3>
              <div className="text-9xl font-serif italic">{calculateBeautyScore().score}</div>
              <div className="text-slate-500 text-sm mt-4">検査値合計: {calculateBeautyScore().sum.toFixed(1)}</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* 人体図 */}
              <div className="space-y-4">
                <h3 className="font-bold border-l-8 border-blue-600 pl-4">Body Map (人体図)</h3>
                <div className="relative aspect-[3/4] bg-slate-50 rounded-[2rem] border border-slate-100 overflow-hidden shadow-inner">
                  <img src="/body-map.png" className="absolute inset-0 w-full h-full object-contain p-8 opacity-80" alt="Body Map" />
                  <canvas ref={canvasRef} width={450} height={600} onMouseDown={draw} className="absolute inset-0 w-full h-full cursor-crosshair" />
                </div>
              </div>

              {/* 検査項目 */}
              <div className="space-y-6">
                <h3 className="font-bold border-l-8 border-blue-600 pl-4">Inspections (7段階)</h3>
                <div className="grid gap-3 max-h-[600px] overflow-y-auto pr-4">
                  {SEVEN_LEVEL_FIELDS.map(f => (
                    <div key={f} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                      <label className="text-xs font-black text-slate-500 uppercase">{f}</label>
                      <div className="flex items-center gap-4">
                        <input type="range" min="2" max="5" step="0.5" value={visitInfo.inspections[f]} 
                          onChange={e => setVisitInfo({...visitInfo, inspections: {...visitInfo.inspections, [f]: parseFloat(e.target.value)}})} />
                        <span className="font-mono font-bold text-blue-600 w-10 text-right">{visitInfo.inspections[f].toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 自由記載欄 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="font-bold text-slate-400 text-xs">施術内容・セルフケア指導</h4>
                <textarea value={visitInfo.treatmentNote} onChange={e => setVisitInfo({...visitInfo, treatmentNote: e.target.value})} className="w-full h-48 p-4 bg-slate-50 rounded-2xl" placeholder="自由記載..." />
              </div>
              <div className="grid grid-cols-2 gap-4 h-fit">
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">受診日</label>
                  <input type="date" value={visitInfo.date} onChange={e => setVisitInfo({...visitInfo, date: e.target.value})} className="bg-transparent font-bold" />
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">支払金額</label>
                  <input type="number" value={visitInfo.amount} onChange={e => setVisitInfo({...visitInfo, amount: parseInt(e.target.value)})} className="bg-transparent font-bold w-full" />
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">膝屈曲 (cm)</label>
                  <input type="number" value={visitInfo.kneeFlexion} onChange={e => setVisitInfo({...visitInfo, kneeFlexion: parseFloat(e.target.value)})} className="bg-transparent font-bold w-full" />
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">膝屈曲内旋 (cm)</label>
                  <input type="number" value={visitInfo.kneeInternalRotation} onChange={e => setVisitInfo({...visitInfo, kneeInternalRotation: parseFloat(e.target.value)})} className="bg-transparent font-bold w-full" />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'base' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <div className="space-y-8">
              <input placeholder="氏名" value={baseInfo.name} onChange={e => setBaseInfo({...baseInfo, name: e.target.value})} className="w-full p-4 border-b-2 text-4xl font-bold focus:border-blue-600 outline-none" />
              <div className="grid grid-cols-2 gap-6">
                <input placeholder="年齢" value={baseInfo.age} onChange={e => setBaseInfo({...baseInfo, age: e.target.value})} className="p-4 bg-slate-50 rounded-2xl" />
                <input placeholder="性別" value={baseInfo.gender} onChange={e => setBaseInfo({...baseInfo, gender: e.target.value})} className="p-4 bg-slate-50 rounded-2xl" />
              </div>
              <input placeholder="住所" value={baseInfo.address} onChange={e => setBaseInfo({...baseInfo, address: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl" />
              <input placeholder="電話番号" value={baseInfo.phone} onChange={e => setBaseInfo({...baseInfo, phone: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl" />
            </div>
            <div className="space-y-6">
               <h3 className="text-xs font-bold text-slate-400 tracking-widest uppercase">臨床メモ</h3>
               <textarea placeholder="改善したいもの・どうありたいか" value={baseInfo.goals} onChange={e => setBaseInfo({...baseInfo, goals: e.target.value})} className="w-full h-32 p-4 bg-slate-50 rounded-2xl" />
               <textarea placeholder="既往歴・手術歴" value={baseInfo.history} onChange={e => setBaseInfo({...baseInfo, history: e.target.value})} className="w-full h-32 p-4 bg-slate-50 rounded-2xl" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}