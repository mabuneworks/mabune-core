'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// --- 1. 型定義 ---
interface Session {
  date: string;
  amount: number;
  numericInspections: Record<string, number>;
  metaInspections: {
    faceSide: '左' | '右'; faceType: '捻れ' | '傾き' | 'スライド';
    shoulderTopSide: '左' | '右'; axisSide: '左' | '右'; asSide: '左' | '右';
    shoulderTwistSide: '左' | '右';
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
  images: {
    before: { front: string; side: string; back: string; face: string };
    after: { front: string; side: string; back: string; face: string };
    combined: string;
  };
}

interface Patient {
  id: string;
  name: string;
  base_info: { gender: string; age: string; address: string; phone: string; history: string; surgery: string; romLimit: string; goals: string; };
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

  const initialSession: Session = {
    date: new Date().toISOString().split('T')[0], amount: 0,
    numericInspections: { face: 3.5, shoulderTop: 3.5, axis: 3.5, as: 3.5, greaterTrochanter: 3.5, elbow: 3.5, shoulder: 3.5, ear: 3.5, shoulderInternalLeft: 3.5, shoulderInternalRight: 3.5 },
    metaInspections: { faceSide: '左', faceType: '捻れ', shoulderTopSide: '左', axisSide: '左', asSide: '左', shoulderTwistSide: '左', kneeFlexion: { side: '左', cm: 0 }, kneeInternalRotation: { side: '左', cm: 0 }, waist: { side: '左', pos: '中' }, neck: { side: '左', pos: '中' } },
    totalSum: 0, beautyScore: 0, treatmentNote: '', selfCare: '',
    images: { before: { front: '', side: '', back: '', face: '' }, after: { front: '', side: '', back: '', face: '' }, combined: '' }
  };

  const [visitInfo, setVisitInfo] = useState<Session>(initialSession);
  const [baseInfo, setBaseInfo] = useState({ name: '', gender: '', age: '', address: '', phone: '', history: '', surgery: '', romLimit: '', goals: '' });

  const calculateScore = () => {
    const values = Object.values(visitInfo.numericInspections) as number[];
    const sum = values.reduce((a, b) => a + b, 0);
    const score = ((45 - (sum * 2)) * 2) + 50;
    return { sum, score: Math.round(score * 10) / 10 };
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
      chart_data: { latest: { ...visitInfo, totalSum: sum, beautyScore: score }, history: patients.find(p => p.id === selectedId)?.chart_data?.history || [] },
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

  const Selector = ({ label, current, options, onSelect }: any) => (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-black text-slate-400 uppercase">{label}</span>
      <div className="flex gap-1">
        {options.map((o: string) => (
          <button key={o} onClick={() => onSelect(o)} className={`flex-grow py-2 rounded-lg text-sm font-black border-2 transition ${current === o ? 'bg-blue-700 text-white border-blue-700 shadow-md' : 'bg-white text-slate-400 border-slate-200'}`}>{o}</button>
        ))}
      </div>
    </div>
  );

  if (view === 'list') {
    return (
      <div className="p-8 bg-slate-50 min-h-screen text-slate-900 font-black">
        <h1 className="text-4xl font-serif mb-10 tracking-tighter">mabune Core</h1>
        <button onClick={() => { setSelectedId(null); setVisitInfo(initialSession); setBaseInfo({name: '', gender: '', age: '', address: '', phone: '', history: '', surgery: '', romLimit: '', goals: ''}); setView('edit'); }} className="mb-10 bg-slate-900 text-white px-10 py-4 rounded-full font-black shadow-2xl">＋ 新規カルテ</button>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {patients.map(p => (
            <div key={p.id} onClick={() => openEdit(p)} className="p-8 bg-white rounded-[3rem] shadow-sm border-4 border-transparent hover:border-blue-600 cursor-pointer">
              <div className="text-2xl">{p.name} 様</div>
              <div className="mt-2 text-blue-700 font-mono text-xl">Score: {p.chart_data?.latest?.beautyScore ?? '--'}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const visitCount = (patients.find(p => p.id === selectedId)?.chart_data?.history?.length || 0) + 1;

  return (
    <div className="bg-white min-h-screen flex flex-col text-slate-900 font-black pb-40">
      <header className="p-4 border-b-4 flex justify-between items-center sticky top-0 bg-white z-50">
        <div className="flex items-center gap-6">
          <button onClick={() => setView('list')} className="text-2xl font-black text-slate-400 mr-2">✕</button>
          <div className="flex flex-col border-r-2 pr-6">
            <span className="text-xl font-black text-slate-900">{baseInfo.name || '新規ゲスト'} 様</span>
            <span className="text-[10px] text-blue-600 tracking-widest uppercase">Visit Count: 第{visitCount}回</span>
          </div>
        </div>
        <nav className="flex gap-10">
          <button onClick={() => setActiveTab('base')} className={`pb-2 text-lg font-black uppercase ${activeTab === 'base' ? 'text-blue-700 border-b-8 border-blue-700' : 'text-slate-300'}`}>基本情報</button>
          <button onClick={() => setActiveTab('visit')} className={`pb-2 text-lg font-black uppercase ${activeTab === 'visit' ? 'text-blue-700 border-b-8 border-blue-700' : 'text-slate-300'}`}>受診・検査</button>
        </nav>
        <button onClick={handleSave} className="bg-blue-700 text-white px-10 py-3 rounded-full text-xl shadow-xl">保存</button>
      </header>

      <main className="p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'visit' && (
          <div className="space-y-16">
            {/* 受診日・金額 */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10 bg-slate-50 rounded-[3rem] border-2 border-slate-200">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-black uppercase">受診日</label>
                <input type="date" value={visitInfo.date} onChange={e => setVisitInfo({...visitInfo, date: e.target.value})} className="w-full text-3xl font-black bg-white border-b-4 border-slate-200 p-2 outline-none focus:border-blue-700" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-black uppercase">支払金額</label>
                <div className="flex items-center gap-2 bg-white border-b-4 border-slate-200 p-2">
                  <span className="text-3xl text-slate-300">¥</span>
                  <input type="number" value={visitInfo.amount} onChange={e => setVisitInfo({...visitInfo, amount: parseInt(e.target.value)})} className="w-full text-3xl font-black outline-none" />
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-20 items-start">
              {/* 人体図 (大型化) */}
              <div className="space-y-6">
                <h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 uppercase tracking-tighter">Body Map (臨床記録)</h3>
                <div className="relative w-full bg-slate-50 rounded-[4rem] border-4 border-slate-200 overflow-hidden shadow-inner aspect-[3/4]">
                  <img src="/body-map.png" className="absolute inset-0 w-full h-full object-contain p-12 opacity-50" />
                  <canvas ref={canvasRef} width={600} height={800} className="absolute inset-0 w-full h-full cursor-crosshair" />
                </div>
              </div>

              {/* 検査項目入力 */}
              <div className="space-y-10">
                <h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 uppercase tracking-tighter">Inspections</h3>
                <div className="space-y-4 max-h-[900px] overflow-y-auto pr-6 scrollbar-hide">
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-200 space-y-6">
                    <div className="flex justify-between items-center text-2xl font-black text-blue-900 underline decoration-4">顔<span>{visitInfo.numericInspections.face.toFixed(1)}</span></div>
                    <div className="grid grid-cols-2 gap-4">
                      <Selector label="左右" current={visitInfo.metaInspections.faceSide} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, faceSide: v}})} />
                      <Selector label="種類" current={visitInfo.metaInspections.faceType} options={['捻れ', '傾き', 'スライド']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, faceType: v}})} />
                    </div>
                    <input type="range" min="2" max="5" step="0.5" value={visitInfo.numericInspections.face} onChange={e => setVisitInfo({...visitInfo, numericInspections: {...visitInfo.numericInspections, face: parseFloat(e.target.value)}})} className="w-full h-4 accent-blue-700" />
                  </div>

                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-200">
                    <label className="text-xl font-black">肩捻じれ</label>
                    <Selector label="左右" current={visitInfo.metaInspections.shoulderTwistSide} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, shoulderTwistSide: v}})} />
                  </div>

                  {['shoulderTop', 'axis', 'as', 'greaterTrochanter', 'elbow', 'shoulder', 'ear', 'shoulderInternalLeft', 'shoulderInternalRight'].map(k => (
                    <div key={k} className="p-6 bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm space-y-4">
                      <div className="flex justify-between items-center text-xl font-black">{k}<span>{visitInfo.numericInspections[k as keyof typeof visitInfo.numericInspections].toFixed(1)}</span></div>
                      <input type="range" min="2" max="5" step="0.5" value={visitInfo.numericInspections[k as keyof typeof visitInfo.numericInspections]} onChange={e => setVisitInfo({...visitInfo, numericInspections: {...visitInfo.numericInspections, [k]: parseFloat(e.target.value)}})} className="w-full h-4 accent-blue-700" />
                    </div>
                  ))}

                  {/* 膝・首・腰 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['kneeFlexion', 'kneeInternalRotation'].map(k => (
                      <div key={k} className="p-6 bg-slate-100 rounded-[2rem] border-2 border-slate-200 space-y-4">
                        <label className="text-lg text-blue-800">{k === 'kneeFlexion' ? '膝屈曲' : '膝屈曲内旋'}</label>
                        <Selector label="左右" current={(visitInfo.metaInspections as any)[k].side} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, [k]: {...(visitInfo.metaInspections as any)[k], side: v}}})} />
                        <div className="bg-white p-2 rounded-xl border-2"><input type="number" value={(visitInfo.metaInspections as any)[k].cm} onChange={e => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, [k]: {...(visitInfo.metaInspections as any)[k], cm: parseFloat(e.target.value)}}})} className="w-full text-2xl font-black outline-none" /></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 偏差値表示 (検査項目の直下へ配置) */}
                <section className="bg-slate-900 text-white p-12 rounded-[3.5rem] text-center shadow-2xl">
                  <h3 className="text-blue-400 text-xl font-black tracking-[0.5em] mb-4 uppercase">Beauty Deviation</h3>
                  <div className="text-[10rem] font-serif font-black italic leading-none">{calculateScore().score}</div>
                  <div className="text-slate-500 mt-6">合計数値: {calculateScore().sum.toFixed(1)}</div>
                </section>
              </div>
            </div>

            {/* 施術内容・セルフケア (復活・追加) */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t-8 border-slate-100 pt-16">
               <div className="space-y-4">
                 <h3 className="text-2xl border-l-[12px] border-slate-900 pl-4 uppercase">Treatment Note (施術内容)</h3>
                 <textarea value={visitInfo.treatmentNote} onChange={e => setVisitInfo({...visitInfo, treatmentNote: e.target.value})} className="w-full h-64 p-8 bg-slate-50 border-4 border-slate-200 rounded-[3rem] text-2xl font-black outline-none focus:border-blue-700" placeholder="本日の施術内容を記載..." />
               </div>
               <div className="space-y-4">
                 <h3 className="text-2xl border-l-[12px] border-blue-700 pl-4 uppercase">Self-Care Advice (セルフケア)</h3>
                 <textarea value={visitInfo.selfCare} onChange={e => setVisitInfo({...visitInfo, selfCare: e.target.value})} className="w-full h-64 p-8 bg-blue-50 border-4 border-blue-200 rounded-[3rem] text-2xl font-black outline-none focus:border-blue-700" placeholder="ゲストへのアドバイスを記載..." />
               </div>
            </section>

            {/* Visual Record */}
            <section className="space-y-12 border-t-8 border-slate-100 pt-16 pb-20">
              <h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 uppercase tracking-widest text-slate-900">Visual Comparison</h3>
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
                          }} className="aspect-[3/4] bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center relative cursor-pointer overflow-hidden group">
                             {currentImg ? <img src={currentImg} className="absolute inset-0 w-full h-full object-cover" /> : <span className="text-slate-300 font-black text-xs uppercase">{pos}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'base' && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <h2 className="text-5xl font-black border-l-[20px] border-slate-900 pl-8">Guest Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 font-black text-slate-900">
              <div className="space-y-10">
                <div className="border-b-8 border-slate-900 pb-4">氏名<input value={baseInfo.name} onChange={e => setBaseInfo({...baseInfo, name: e.target.value})} className="w-full text-7xl font-black bg-transparent outline-none mt-2" /></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-8 bg-slate-50 border-2 rounded-[3rem]">年齢<input value={baseInfo.age} onChange={e => setBaseInfo({...baseInfo, age: e.target.value})} className="w-full bg-transparent text-3xl font-black mt-2" /></div>
                  <div className="p-8 bg-slate-50 border-2 rounded-[3rem]">性別<input value={baseInfo.gender} onChange={e => setBaseInfo({...baseInfo, gender: e.target.value})} className="w-full bg-transparent text-3xl font-black mt-2" /></div>
                </div>
                <div className="p-8 bg-slate-50 border-2 rounded-[3rem]">住所<input value={baseInfo.address} onChange={e => setBaseInfo({...baseInfo, address: e.target.value})} className="w-full bg-transparent text-3xl font-black mt-2" /></div>
              </div>
              <div className="p-12 bg-slate-900 text-white rounded-[4.5rem] shadow-2xl">
                <h4 className="text-blue-400 text-xl tracking-widest uppercase mb-6">Aspiration / なりたい姿</h4>
                <textarea value={baseInfo.goals} onChange={e => setBaseInfo({...baseInfo, goals: e.target.value})} className="w-full h-96 bg-transparent text-4xl font-serif mt-4 outline-none leading-relaxed" placeholder="想いを記載してください..." />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}