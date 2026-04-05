'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// --- 1. 型定義 (すべての情報を網羅) ---
interface Session {
  date: string;       // 受診日
  amount: number;     // 支払金額
  // 7段階評価項目 (数値合計の対象)
  numericInspections: {
    face: number; shoulderTop: number; axis: number; as: number;
    greaterTrochanter: number; elbow: number; shoulder: number; ear: number;
    shoulderInternalLeft: number; shoulderInternalRight: number;
  };
  // 選択・位置・センチ項目 (数値合計の対象外)
  metaInspections: {
    faceSide: '左' | '右'; faceType: '捻れ' | '傾き' | 'スライド';
    shoulderTopSide: '左' | '右';
    axisSide: '左' | '右';
    asSide: '左' | '右';
    shoulderTwistSide: '左' | '右'; // 数値入力なし
    kneeFlexion: { side: '左' | '右'; cm: number };
    kneeInternalRotation: { side: '左' | '右'; cm: number };
    waist: { side: '左' | '右'; pos: '上' | '中' | '下' };
    neck: { side: '左' | '右'; pos: '上' | '中' | '下' };
  };
  totalSum: number;
  beautyScore: number;
  treatmentNote: string;
  selfCare: string;
  bodyMapData?: string;
  // 画像管理
  images: {
    before: { front: string; side: string; back: string; face: string };
    after: { front: string; side: string; back: string; face: string };
    combined: string; // 合成画像
  };
}

interface Patient {
  id: string;
  name: string;
  base_info: {
    gender: string; age: string; address: string; phone: string;
    history: string; surgery: string; romLimit: string; goals: string;
  };
  chart_data: { latest: Session; history: Session[] };
  last_visit: string;
}

export default function MabuneUltimateCore() {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [activeTab, setActiveTab] = useState<'base' | 'visit' | 'archive'>('visit');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);

  // --- 初期値設定 ---
  const initialSession: Session = {
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    numericInspections: { face: 3.5, shoulderTop: 3.5, axis: 3.5, as: 3.5, greaterTrochanter: 3.5, elbow: 3.5, shoulder: 3.5, ear: 3.5, shoulderInternalLeft: 3.5, shoulderInternalRight: 3.5 },
    metaInspections: { faceSide: '左', faceType: '捻れ', shoulderTopSide: '左', axisSide: '左', asSide: '左', shoulderTwistSide: '左', kneeFlexion: { side: '左', cm: 0 }, kneeInternalRotation: { side: '左', cm: 0 }, waist: { side: '左', pos: '中' }, neck: { side: '左', pos: '中' } },
    totalSum: 0, beautyScore: 0, treatmentNote: '', selfCare: '',
    images: { before: { front: '', side: '', back: '', face: '' }, after: { front: '', side: '', back: '', face: '' }, combined: '' }
  };

  const [visitInfo, setVisitInfo] = useState<Session>(initialSession);
  const [baseInfo, setBaseInfo] = useState({ name: '', gender: '', age: '', address: '', phone: '', history: '', surgery: '', romLimit: '', goals: '' });

  // --- 計算ロジック: ((45 - (合計 * 2)) * 2 + 50) ---
  const calculateScore = () => {
    const sum = Object.values(visitInfo.numericInspections).reduce((a, b) => a + b, 0);
    const score = ((45 - (sum * 2)) * 2) + 50;
    return { sum, score: Math.round(score * 10) / 10 };
  };

  // --- 画像合成ロジック ---
  const generateComparison = () => {
    const canvas = compositeCanvasRef.current;
    if (!canvas || !visitInfo.images.before.face || !visitInfo.images.after.face) return alert('Before/Afterの両方の「顔」写真が必要です。');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgB = new Image(); const imgA = new Image();
    const load = (img: HTMLImageElement, src: string) => new Promise(res => { img.onload = res; img.src = src; });
    
    Promise.all([load(imgB, visitInfo.images.before.face), load(imgA, visitInfo.images.after.face)]).then(() => {
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 860, 630);
      ctx.drawImage(imgB, 20, 20, 400, 533);
      ctx.drawImage(imgA, 440, 20, 400, 533);
      ctx.fillStyle = '#0f172a'; ctx.font = 'bold 24px sans-serif';
      ctx.fillText('BEFORE', 30, 590); ctx.fillText('AFTER', 450, 590);
      setVisitInfo({ ...visitInfo, images: { ...visitInfo.images, combined: canvas.toDataURL('image/png') } });
    });
  };

  const fetchPatients = async () => {
    const { data } = await supabase.from('patient').select('*');
    if (data) setPatients(data as Patient[]);
  };

  useEffect(() => { fetchPatients(); }, []);

  const handleSave = async () => {
    const { sum, score } = calculateScore();
    const payload = {
      name: baseInfo.name, base_info: baseInfo,
      chart_data: { latest: { ...visitInfo, totalSum: sum, beautyScore: score }, history: [] },
      last_visit: visitInfo.date
    };
    if (selectedId) await supabase.from('patient').update(payload).eq('id', selectedId);
    else await supabase.from('patient').insert([payload]);
    setView('list'); fetchPatients();
  };

  const openEdit = (p: Patient) => {
    setSelectedId(p.id); setBaseInfo({ name: p.name, ...p.base_info });
    if (p.chart_data?.latest) setVisitInfo({ ...initialSession, ...p.chart_data.latest });
    setView('edit');
  };

  // 汎用セレクター
  const Selector = ({ label, current, options, onSelect }: any) => (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <div className="flex gap-1">
        {options.map((o: string) => (
          <button key={o} onClick={() => onSelect(o)} className={`flex-grow py-2 rounded-lg text-sm font-black border-2 transition ${current === o ? 'bg-blue-700 text-white border-blue-700 shadow-md' : 'bg-white text-slate-400 border-slate-100'}`}>{o}</button>
        ))}
      </div>
    </div>
  );

  if (view === 'list') {
    return (
      <div className="p-8 bg-slate-50 min-h-screen text-slate-900 font-black">
        <h1 className="text-4xl font-serif mb-10 tracking-tighter">mabune Core</h1>
        <button onClick={() => { setSelectedId(null); setVisitInfo(initialSession); setView('edit'); }} className="mb-10 bg-slate-900 text-white px-10 py-4 rounded-full font-black shadow-2xl">＋ 新規カルテ作成</button>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {patients.map(p => (
            <div key={p.id} onClick={() => openEdit(p)} className="p-8 bg-white rounded-[3rem] shadow-sm border-4 border-transparent hover:border-blue-600 cursor-pointer transition">
              <div className="text-2xl">{p.name} 様</div>
              <div className="mt-4 text-blue-700 text-xl font-mono">Score: {p.chart_data?.latest?.beautyScore ?? '--'}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen flex flex-col text-slate-900 font-black pb-40">
      <header className="p-6 border-b-4 flex justify-between items-center sticky top-0 bg-white z-50">
        <button onClick={() => setView('list')} className="text-2xl font-black text-slate-400">✕</button>
        <div className="flex gap-10">
          <button onClick={() => setActiveTab('base')} className={`pb-2 text-lg font-black uppercase ${activeTab === 'base' ? 'text-blue-700 border-b-8 border-blue-700' : 'text-slate-300'}`}>基本情報</button>
          <button onClick={() => setActiveTab('visit')} className={`pb-2 text-lg font-black uppercase ${activeTab === 'visit' ? 'text-blue-700 border-b-8 border-blue-700' : 'text-slate-300'}`}>受診・検査</button>
        </div>
        <button onClick={handleSave} className="bg-blue-700 text-white px-10 py-3 rounded-full text-xl shadow-xl">保存</button>
      </header>

      <main className="p-8 max-w-6xl mx-auto w-full">
        {activeTab === 'visit' && (
          <div className="space-y-16">
            {/* 受診日・金額入力欄 (復活) */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 bg-slate-100 rounded-[3rem] border-4 border-slate-200">
              <div className="space-y-2">
                <label className="text-xs text-slate-500 tracking-widest uppercase">受診日</label>
                <input type="date" value={visitInfo.date} onChange={e => setVisitInfo({...visitInfo, date: e.target.value})} className="w-full text-3xl font-black bg-transparent border-b-4 border-slate-900 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-500 tracking-widest uppercase">支払金額</label>
                <div className="flex items-center gap-2">
                  <span className="text-3xl text-slate-400">¥</span>
                  <input type="number" value={visitInfo.amount} onChange={e => setVisitInfo({...visitInfo, amount: parseInt(e.target.value)})} className="w-full text-3xl font-black bg-transparent border-b-4 border-slate-900 outline-none" />
                </div>
              </div>
            </section>

            {/* スコア表示 */}
            <section className="bg-slate-900 text-white p-16 rounded-[4.5rem] text-center shadow-2xl">
              <h3 className="text-blue-400 text-xl font-black tracking-[0.5em] mb-4 uppercase">Beauty Deviation</h3>
              <div className="text-[12rem] font-serif font-black italic leading-none">{calculateScore().score}</div>
              <div className="text-slate-500 mt-6 font-normal">合計数値: {calculateScore().sum.toFixed(1)}</div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* 人体図 */}
              <div className="space-y-6">
                <h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 uppercase tracking-tighter text-slate-900">Body Map</h3>
                <div className="relative aspect-[3/4] bg-slate-50 rounded-[3.5rem] border-4 border-slate-200 overflow-hidden shadow-inner">
                  <img src="/body-map.png" className="absolute inset-0 w-full h-full object-contain p-8 opacity-40" />
                  <canvas ref={canvasRef} width={450} height={600} className="absolute inset-0 w-full h-full cursor-crosshair" />
                </div>
              </div>

              {/* 検査項目 */}
              <div className="space-y-10">
                <h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 uppercase tracking-tighter text-slate-900">Inspections</h3>
                <div className="space-y-6 max-h-[700px] overflow-y-auto pr-4 border-b-4 pb-10">
                  {/* 顔セクション */}
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border-2 space-y-6">
                    <div className="flex justify-between items-center"><span className="text-2xl text-blue-900 font-black underline decoration-4 underline-offset-8">顔</span><span className="text-4xl font-mono text-blue-700">{visitInfo.numericInspections.face.toFixed(1)}</span></div>
                    <div className="grid grid-cols-2 gap-4">
                      <Selector label="左右" current={visitInfo.metaInspections.faceSide} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, faceSide: v}})} />
                      <Selector label="種類" current={visitInfo.metaInspections.faceType} options={['捻れ', '傾き', 'スライド']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, faceType: v}})} />
                    </div>
                    <input type="range" min="2" max="5" step="0.5" value={visitInfo.numericInspections.face} onChange={e => setVisitInfo({...visitInfo, numericInspections: {...visitInfo.numericInspections, face: parseFloat(e.target.value)}})} className="w-full h-4 accent-blue-700" />
                  </div>

                  {/* 肩捻じれ (選択のみ) */}
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border-2 space-y-4">
                    <label className="text-xl font-black text-slate-900 underline decoration-4 decoration-slate-300 underline-offset-8">肩捻じれ</label>
                    <Selector label="左右" current={visitInfo.metaInspections.shoulderTwistSide} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, shoulderTwistSide: v}})} />
                  </div>

                  {/* その他7段階 */}
                  {[
                    { key: 'shoulderTop', label: '肩上', side: true },
                    { key: 'axis', label: '軸', side: true },
                    { key: 'as', label: 'AS', side: true },
                    { key: 'greaterTrochanter', label: '大転子' },
                    { key: 'elbow', label: '肘' },
                    { key: 'shoulder', label: '肩' },
                    { key: 'ear', label: '耳' },
                    { key: 'shoulderInternalLeft', label: '肩内旋左' },
                    { key: 'shoulderInternalRight', label: '肩内旋右' }
                  ].map(item => (
                    <div key={item.key} className="p-8 bg-slate-50 rounded-[2.5rem] border-2 space-y-4">
                      <div className="flex justify-between items-center"><span className="text-xl font-black text-slate-800">{item.label}</span><span className="text-3xl font-mono text-blue-700">{visitInfo.numericInspections[item.key as keyof typeof visitInfo.numericInspections].toFixed(1)}</span></div>
                      {item.side && <Selector label="左右" current={(visitInfo.metaInspections as any)[`${item.key}Side`]} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, [`${item.key}Side`]: v}})} />}
                      <input type="range" min="2" max="5" step="0.5" value={visitInfo.numericInspections[item.key as keyof typeof visitInfo.numericInspections]} onChange={e => setVisitInfo({...visitInfo, numericInspections: {...visitInfo.numericInspections, [item.key]: parseFloat(e.target.value)}})} className="w-full h-4 accent-blue-700" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 特別検査項目 (膝・腰・首) */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 uppercase col-span-full">Special Inspections</h3>
              {['kneeFlexion', 'kneeInternalRotation'].map(k => (
                <div key={k} className="p-10 bg-slate-900 text-white rounded-[3.5rem] space-y-6 shadow-xl">
                  <label className="text-3xl font-serif italic text-blue-400">{k === 'kneeFlexion' ? '膝屈曲' : '膝屈曲内旋'}</label>
                  <Selector label="左右" current={(visitInfo.metaInspections as any)[k].side} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, [k]: {...(visitInfo.metaInspections as any)[k], side: v}}})} />
                  <div className="flex items-center gap-4 bg-white p-6 rounded-2xl">
                    <input type="number" value={(visitInfo.metaInspections as any)[k].cm} onChange={e => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, [k]: {...(visitInfo.metaInspections as any)[k], cm: parseFloat(e.target.value)}}})} className="text-6xl font-black text-slate-900 w-full bg-transparent outline-none font-mono" />
                    <span className="text-2xl text-slate-400">cm</span>
                  </div>
                </div>
              ))}
              {['waist', 'neck'].map(k => (
                <div key={k} className="p-10 bg-slate-50 border-4 border-slate-200 rounded-[3.5rem] space-y-6">
                  <label className="text-3xl font-black text-slate-800">{k === 'waist' ? '腰' : '首'}</label>
                  <Selector label="左右" current={(visitInfo.metaInspections as any)[k].side} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, [k]: {...(visitInfo.metaInspections as any)[k], side: v}}})} />
                  <Selector label="位置" current={(visitInfo.metaInspections as any)[k].pos} options={['上', '中', '下']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, [k]: {...(visitInfo.metaInspections as any)[k], pos: v}}})} />
                </div>
              ))}
            </section>

            {/* Visual Record */}
            <section className="space-y-12 border-t-8 border-slate-100 pt-16">
              <div className="flex justify-between items-end">
                <h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 uppercase tracking-widest">Visual Record</h3>
                <button onClick={generateComparison} className="bg-green-600 text-white px-10 py-4 rounded-full text-xl shadow-2xl animate-bounce">✨ 顔比較画像を自動生成</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                {['before', 'after'].map(timing => (
                  <div key={timing} className="space-y-6">
                    <p className={`text-center font-black text-xl tracking-[0.4em] uppercase ${timing === 'before' ? 'text-slate-400' : 'text-blue-700'}`}>{timing} (4枚)</p>
                    <div className="grid grid-cols-2 gap-4">
                      {['前', '横', '後ろ', '顔'].map(pos => {
                        const key = { '前': 'front', '横': 'side', '後ろ': 'back', '顔': 'face' }[pos];
                        const currentImg = (visitInfo.images as any)[timing][key as string];
                        return (
                          <div key={pos} onClick={() => {
                            const dummy = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
                            setVisitInfo({ ...visitInfo, images: { ...visitInfo.images, [timing]: { ...(visitInfo.images as any)[timing], [key as string]: dummy } } });
                          }} className="aspect-[3/4] bg-slate-50 border-4 border-dashed border-slate-300 rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden cursor-pointer group">
                            {currentImg ? <img src={currentImg} className="absolute inset-0 w-full h-full object-cover" /> : <span className="text-slate-300 font-black text-xs uppercase">{pos}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              
              <canvas ref={compositeCanvasRef} width={860} height={630} className="hidden" />
              {visitInfo.images.combined && (
                <div className="mt-16 p-10 bg-slate-900 rounded-[4rem] text-center shadow-inner">
                  <h4 className="text-blue-400 text-sm font-black tracking-[0.5em] mb-8 uppercase underline decoration-2 decoration-blue-600 underline-offset-8">Analysis Card (Faces)</h4>
                  <img src={visitInfo.images.combined} className="mx-auto rounded-3xl shadow-2xl border-8 border-white max-w-full" alt="Combined Analysis" />
                  <button className="mt-12 bg-green-500 text-white px-12 py-5 rounded-full text-2xl font-black shadow-2xl hover:scale-105 transition-all">公式LINEでゲストに送信</button>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'base' && (
          <div className="space-y-12">
            <input placeholder="氏名" value={baseInfo.name} onChange={e => setBaseInfo({...baseInfo, name: e.target.value})} className="w-full p-6 border-b-8 border-slate-900 text-7xl font-black bg-transparent outline-none" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 font-black">
              <div className="space-y-8">
                <div className="p-8 bg-slate-100 rounded-[3rem]">年齢<input value={baseInfo.age} onChange={e => setBaseInfo({...baseInfo, age: e.target.value})} className="w-full bg-transparent text-3xl font-black mt-2" /></div>
                <div className="p-8 bg-slate-100 rounded-[3rem]">住所<input value={baseInfo.address} onChange={e => setBaseInfo({...baseInfo, address: e.target.value})} className="w-full bg-transparent text-3xl font-black mt-2" /></div>
              </div>
              <div className="p-10 bg-slate-900 text-white rounded-[4rem] shadow-2xl">
                <h4 className="text-blue-400 text-xs tracking-widest uppercase mb-4 underline decoration-2 decoration-blue-600 underline-offset-8">Improvements & Goals</h4>
                <textarea value={baseInfo.goals} onChange={e => setBaseInfo({...baseInfo, goals: e.target.value})} className="w-full h-80 bg-transparent text-4xl font-serif mt-4 outline-none leading-snug" placeholder="..." />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}