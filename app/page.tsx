'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function MabuneUltimateChart() {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // --- プロ仕様：ゆかりさんの現場データ ---
  const [name, setName] = useState('');
  const [measurements, setMeasurements] = useState({ waist: 0, hip: 0, under: 0 }); // 単位: cm
  
  // 7段階評価 (2.0 〜 5.0)
  const [inspections, setInspections] = useState({
    posture: 3.5,
    symmetry: 3.5,
    flexibility: 3.5,
    aura: 3.5
  });

  // 画像：Before 4枚 / After 4枚
  const [images, setImages] = useState({
    before: ['', '', '', ''],
    after: ['', '', '', '']
  });

  // --- 美の偏差値 関数 (Beauty Deviation Score) ---
  const calculateBeautyScore = () => {
    const vals = Object.values(inspections);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    // 3.5を標準(偏差値50)とし、評価値の振れ幅を計算する独自の関数
    const score = 50 + (avg - 3.5) * 20;
    return Math.round(score * 10) / 10;
  };

  useEffect(() => { fetchPatients(); }, []);

  const fetchPatients = async () => {
    const { data } = await supabase.from('patient').select('*').order('last_visit', { ascending: false });
    if (data) setPatients(data);
  };

  const handleSave = async () => {
    const beautyScore = calculateBeautyScore();
    const sessionData = { measurements, inspections, images, beautyScore, date: new Date().toISOString() };
    
    // 履歴管理（アーカイブ）
    const prevHistory = patients.find(p => p.id === selectedId)?.chart_data?.history || [];
    const payload = { 
      name, 
      chart_data: { current: sessionData, history: [...prevHistory, sessionData] },
      last_visit: new Date().toISOString() 
    };

    if (selectedId) {
      await supabase.from('patient').update(payload).eq('id', selectedId);
    } else {
      await supabase.from('patient').insert([payload]);
    }
    setView('list');
    fetchPatients();
  };

  if (view === 'list') {
    return (
      <div className="p-6 bg-slate-50 min-h-screen font-sans">
        <h1 className="text-2xl font-serif font-bold text-slate-800 mb-6">mabune Core <span className="text-sm font-light text-slate-400 italic">Management</span></h1>
        <button onClick={() => { setSelectedId(null); setName(''); setView('edit'); }} className="mb-8 bg-slate-900 text-white px-8 py-3 rounded-full shadow-lg hover:bg-black transition">＋ 新規ゲストを輝かせる</button>
        <div className="grid gap-4 md:grid-cols-2">
          {patients.map(p => (
            <div key={p.id} onClick={() => { setSelectedId(p.id); setName(p.name); setView('edit'); }} className="p-6 bg-white rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-blue-300 transition">
              <div className="text-xl font-bold text-slate-800">{p.name} 様</div>
              <div className="text-blue-500 text-sm mt-2 font-mono">Beauty Score: {p.chart_data?.current?.beautyScore || '--'}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <header className="p-4 border-b flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-30">
        <button onClick={() => setView('list')} className="text-slate-400">✕ 閉じる</button>
        <div className="text-center">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="text-lg font-bold text-center border-b focus:outline-none" placeholder="お名前を入力" />
        </div>
        <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold">セッション保存</button>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-12 pb-24">
        {/* --- 美の偏差値 --- */}
        <section className="text-center p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[3rem]">
          <h3 className="text-slate-400 text-xs font-bold tracking-widest uppercase mb-2">Current Beauty Deviation</h3>
          <div className="text-6xl font-serif font-bold text-blue-600">{calculateBeautyScore()}</div>
        </section>

        {/* --- 7段階評価：ゆかりさんの目 --- */}
        <section className="space-y-6">
          <h3 className="font-bold border-l-4 border-blue-600 pl-4">検査結果 (7段階: 2.0 〜 5.0)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {Object.entries(inspections).map(([key, val]) => (
              <div key={key}>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-bold text-slate-600 uppercase">{key}</label>
                  <span className="text-blue-600 font-bold font-mono">{val.toFixed(1)}</span>
                </div>
                <input type="range" min="2" max="5" step="0.5" value={val} onChange={(e) => setInspections({...inspections, [key]: parseFloat(e.target.value)})} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" />
              </div>
            ))}
          </div>
        </section>

        {/* --- Before / After 4枚ずつ --- */}
        <section className="space-y-8">
          <h3 className="font-bold border-l-4 border-blue-600 pl-4">Before / After 分析 (各4枚)</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Before */}
            <div className="space-y-4">
              <div className="text-xs font-bold text-slate-400 text-center">BEFORE</div>
              <div className="grid grid-cols-2 gap-2">
                {images.before.map((img, i) => (
                  <div key={i} className="aspect-[3/4] bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 text-xs">Photo {i+1}</div>
                ))}
              </div>
            </div>
            {/* After */}
            <div className="space-y-4">
              <div className="text-xs font-bold text-blue-400 text-center">AFTER</div>
              <div className="grid grid-cols-2 gap-2">
                {images.after.map((img, i) => (
                  <div key={i} className="aspect-[3/4] bg-blue-50 rounded-2xl flex items-center justify-center text-blue-200 text-xs border-2 border-dashed border-blue-200">Photo {i+1}</div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}