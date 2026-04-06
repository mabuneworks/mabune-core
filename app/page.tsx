'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// --- 1. 型定義 ---
interface Session {
  date: string; amount: number;
  numericInspections: { "顔": number; "肩上": number; "軸": number; "AS": number; "大転子": number; "肘": number; "肩": number; "耳": number; "肩内旋左": number; "肩内旋右": number; };
  metaInspections: { "顔_左右": '左' | '右'; "顔_種類": '捻れ' | '傾き' | 'スライド'; "肩上_左右": '左' | '右'; "軸_左右": '左' | '右'; "AS_左右": '左' | '右'; "肩捻じれ": '左' | '右'; "膝屈曲": { side: '左' | '右'; cm: number }; "膝屈曲内旋": { side: '左' | '右'; cm: number }; "腰": { side: '左' | '右'; pos: '上' | '中' | '下' }; "首": { side: '左' | '右'; pos: '上' | '中' | '下' }; };
  totalSum: number; beautyScore: number; treatmentNote: string; selfCare: string; bodyMapData?: string;
  images: { before: { front: string; side: string; back: string; face: string }; after: { front: string; side: string; back: string; face: string }; combined: string; };
}

interface Patient { id: string; name: string; base_info: { gender: string; age: string; address: string; phone: string; history: string; surgery: string; romLimit: string; goals: string; }; chart_data: { latest: Session; history: Session[] }; last_visit: string; }

export default function MabuneUltimateCore() {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [activeTab, setActiveTab] = useState<'base' | 'visit'>('visit');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);

  // --- 初期値 ---
  const initialSession: Session = {
    date: new Date().toISOString().split('T')[0], amount: 0,
    numericInspections: { "顔": 3.5, "肩上": 3.5, "軸": 3.5, "AS": 3.5, "大転子": 3.5, "肘": 3.5, "肩": 3.5, "耳": 3.5, "肩内旋左": 3.5, "肩内旋右": 3.5 },
    metaInspections: { "顔_左右": '左', "顔_種類": '捻れ', "肩上_左右": '左', "軸_左右": '左', "AS_左右": '左', "肩捻じれ": '左', "膝屈曲": { side: '左', cm: 0 }, "膝屈曲内旋": { side: '左', cm: 0 }, "腰": { side: '左', pos: '中' }, "首": { side: '左', pos: '中' } },
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

  const startDrawing = (e: any) => { setIsDrawing(true); draw(e); };
  const endDrawing = () => { setIsDrawing(false); canvasRef.current?.getContext('2d')?.beginPath(); };
  const draw = (e: any) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0].clientY) - rect.top;
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#FF3B30';
    ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
  };

  const generateComparison = () => {
    const canvas = compositeCanvasRef.current;
    if (!canvas || !visitInfo.images.before.face || !visitInfo.images.after.face) return alert('顔写真が不足しています。');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgB = new Image(); const imgA = new Image();
    const load = (img: HTMLImageElement, src: string) => new Promise(res => { img.onload = res; img.src = src; });
    Promise.all([load(imgB, visitInfo.images.before.face), load(imgA, visitInfo.images.after.face)]).then(() => {
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 860, 630);
      ctx.drawImage(imgB, 20, 20, 400, 533); ctx.drawImage(imgA, 440, 20, 400, 533);
      ctx.fillStyle = '#000000'; ctx.font = 'bold 24px sans-serif';
      ctx.fillText('BEFORE', 40, 590); ctx.fillText('AFTER', 460, 590);
      setVisitInfo({ ...visitInfo, images: { ...visitInfo.images, combined: canvas.toDataURL('image/png') } });
    });
  };

  const handleSave = async () => {
    const { sum, score } = calculateScore();
    const payload = {
      name: baseInfo.name, base_info: baseInfo,
      chart_data: { latest: { ...visitInfo, totalSum: sum, beautyScore: score, bodyMapData: canvasRef.current?.toDataURL() }, history: patients.find(p => p.id === selectedId)?.chart_data?.history || [] },
      last_visit: visitInfo.date
    };
    if (selectedId) await supabase.from('patient').update(payload).eq('id', selectedId);
    else await supabase.from('patient').insert([payload]);
    setView('list'); fetchPatients();
  };

  const fetchPatients = async () => {
    const { data } = await supabase.from('patient').select('*');
    if (data) setPatients(data as Patient[]);
  };
  useEffect(() => { fetchPatients(); }, []);

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
        <button onClick={() => { setSelectedId(null); setVisitInfo(initialSession); setBaseInfo({name:'',gender:'',age:'',address:'',phone:'',history:'',surgery:'',romLimit:'',goals:''}); setView('edit'); }} className="mb-10 bg-slate-900 text-white px-10 py-4 rounded-full font-black shadow-2xl">＋ 新規カルテ</button>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {patients.map(p => (
            <div key={p.id} onClick={() => openEdit(p)} className="p-8 bg-white rounded-[3rem] shadow-sm border-4 border-transparent hover:border-blue-600 cursor-pointer">
              <div className="text-2xl">{p.name} 様</div>
              <div className="mt-2 text-blue-700 text-xl font-mono">Score: {p.chart_data?.latest?.beautyScore ?? '--'}</div>
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
          <div className="flex flex-col border-r-4 pr-6 border-slate-100">
            <span className="text-2xl font-black">{baseInfo.name || '新規'} 様</span>
            <span className="text-xs text-blue-600 font-bold uppercase mt-1 tracking-widest">受診回数: 第{visitCount}回</span>
          </div>
        </div>
        <nav className="flex gap-10">
          <button onClick={() => setActiveTab('base')} className={`pb-2 text-lg font-black ${activeTab === 'base' ? 'text-blue-700 border-b-8 border-blue-700' : 'text-slate-300'}`}>基本情報</button>
          <button onClick={() => setActiveTab('visit')} className={`pb-2 text-lg font-black ${activeTab === 'visit' ? 'text-blue-700 border-b-8 border-blue-700' : 'text-slate-300'}`}>受診・検査</button>
        </nav>
        <button onClick={handleSave} className="bg-blue-700 text-white px-10 py-3 rounded-full text-xl shadow-xl">保存</button>
      </header>

      <main className="p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'visit' && (
          <div className="space-y-16">
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10 bg-slate-50 rounded-[3rem] border-2 border-slate-100 shadow-sm">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-black uppercase tracking-widest">受診日</label>
                <input type="date" value={visitInfo.date} onChange={e => setVisitInfo({...visitInfo, date: e.target.value})} className="w-full text-3xl font-black bg-white/50 border-b-4 border-slate-200 p-2 outline-none focus:border-blue-700" />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-black uppercase tracking-widest">支払金額</label>
                <div className="flex items-center gap-2 bg-white/50 border-b-4 border-slate-200 p-2">
                  <span className="text-3xl font-black text-slate-900">¥</span>
                  <input type="number" value={visitInfo.amount} onChange={e => setVisitInfo({...visitInfo, amount: parseInt(e.target.value)})} className="w-full text-3xl font-black outline-none bg-transparent" />
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-20 items-start">
              <div className="space-y-6">
                <div className="flex justify-between items-end"><h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 font-black uppercase tracking-tighter">人体図</h3><button onClick={() => canvasRef.current?.getContext('2d')?.clearRect(0,0,800,1066)} className="bg-slate-200 text-slate-600 px-6 py-2 rounded-full text-xs font-black">記入キャンセル</button></div>
                <div className="relative w-full bg-slate-50 rounded-[4rem] border-4 border-slate-200 overflow-hidden shadow-inner aspect-[3/4] touch-none">
                  <img src="/body-map.png" className="absolute inset-0 w-full h-full object-contain p-8 opacity-40 pointer-events-none" />
                  <canvas ref={canvasRef} width={800} height={1066} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={endDrawing} onMouseLeave={endDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={endDrawing} className="absolute inset-0 w-full h-full cursor-crosshair" />
                </div>
              </div>

              <div className="space-y-10">
                <h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 font-black uppercase tracking-tighter">検査項目</h3>
                <div className="space-y-4 max-h-[700px] overflow-y-auto pr-6 scrollbar-hide border-b-4 pb-10">
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 space-y-6">
                    <div className="flex justify-between items-center text-2xl font-black text-blue-900 underline decoration-4 underline-offset-8">顔<span>{visitInfo.numericInspections["顔"].toFixed(1)}</span></div>
                    <div className="grid grid-cols-2 gap-4"><Selector label="左右" current={visitInfo.metaInspections["顔_左右"]} options={['左', '右']} onSelect={(v:any)=>setVisitInfo({...visitInfo, metaInspections:{...visitInfo.metaInspections, "顔_左右":v}})} /><Selector label="種類" current={visitInfo.metaInspections["顔_種類"]} options={['捻れ','傾き','スライド']} onSelect={(v:any)=>setVisitInfo({...visitInfo, metaInspections:{...visitInfo.metaInspections, "顔_種類":v}})} /></div>
                    <input type="range" min="2" max="5" step="0.5" value={visitInfo.numericInspections["顔"]} onChange={e=>setVisitInfo({...visitInfo, numericInspections:{...visitInfo.numericInspections, "顔":parseFloat(e.target.value)}})} className="w-full h-4 accent-blue-700" />
                  </div>
                  <div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100"><label className="text-xl font-black">肩捻じれ</label><Selector label="左右" current={visitInfo.metaInspections["肩捻じれ"]} options={['左', '右']} onSelect={(v:any)=>setVisitInfo({...visitInfo, metaInspections:{...visitInfo.metaInspections, "肩捻じれ":v}})} /></div>
                  {["肩上","軸","AS","大転子","肘","肩","耳","肩内旋左","肩内旋右"].map(k=>(
                    <div key={k} className="p-6 bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm space-y-4">
                      <div className="flex justify-between items-center text-xl font-black text-slate-900">{k}<span>{visitInfo.numericInspections[k as keyof typeof visitInfo.numericInspections].toFixed(1)}</span></div>
                      {["肩上","軸","AS"].includes(k) && <Selector label="左右" current={(visitInfo.metaInspections as any)[`${k}_左右`]} options={['左', '右']} onSelect={(v:any)=>setVisitInfo({...visitInfo, metaInspections:{...visitInfo.metaInspections, [`${k}_左右`]:v}})} />}
                      <input type="range" min="2" max="5" step="0.5" value={visitInfo.numericInspections[k as keyof typeof visitInfo.numericInspections]} onChange={e=>setVisitInfo({...visitInfo, numericInspections:{...visitInfo.numericInspections, [k]:parseFloat(e.target.value)}})} className="w-full h-4 accent-blue-700" />
                    </div>
                  ))}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['膝屈曲', '膝屈曲内旋'].map(k=>{
                      const key = k === '膝屈曲' ? 'kneeFlexion' : 'kneeInternalRotation';
                      return (<div key={k} className="p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 space-y-4 font-black"><label className="text-lg text-blue-800">{k}</label><Selector label="左右" current={(visitInfo.metaInspections as any)[key].side} options={['左','右']} onSelect={(v:any)=>setVisitInfo({...visitInfo, metaInspections:{...visitInfo.metaInspections,[key]:{...(visitInfo.metaInspections as any)[key],side:v}}})} /><div className="bg-white p-2 border-2 rounded-xl"><input type="number" value={(visitInfo.metaInspections as any)[key].cm} onChange={e=>setVisitInfo({...visitInfo, metaInspections:{...visitInfo.metaInspections,[key]:{...(visitInfo.metaInspections as any)[key],cm:parseFloat(e.target.value)}}})} className="w-full text-2xl font-black outline-none" /></div></div>);
                    })}
                    {['首','腰'].map(k=>{
                      const key = k === '首' ? 'neck' : 'waist';
                      return (<div key={k} className="p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 space-y-4 font-black"><label className="text-lg text-slate-800">{k}</label><Selector label="左右" current={(visitInfo.metaInspections as any)[key].side} options={['左','右']} onSelect={(v:any)=>setVisitInfo({...visitInfo, metaInspections:{...visitInfo.metaInspections,[key]:{...(visitInfo.metaInspections as any)[key],side:v}}})} /><Selector label="位置" current={(visitInfo.metaInspections as any)[key].pos} options={['上','中','下']} onSelect={(v:any)=>setVisitInfo({...visitInfo, metaInspections:{...visitInfo.metaInspections,[key]:{...(visitInfo.metaInspections as any)[key],pos:v}}})} /></div>);
                    })}
                  </div>
                </div>

                <section className="bg-purple-50 text-purple-900 p-12 rounded-[3.5rem] text-center border-4 border-purple-100 shadow-xl">
                  <h3 className="text-purple-400 text-xl font-black tracking-[0.5em] mb-4 uppercase">美の偏差値</h3>
                  <div className="text-[10rem] font-serif font-black italic leading-none">{calculateScore().score}</div>
                  <div className="text-purple-300 mt-6 font-bold uppercase tracking-widest text-xs">合計数値: {calculateScore().sum.toFixed(1)}</div>
                </section>
              </div>
            </div>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t-8 border-slate-100 pt-16 font-black">
               <div className="space-y-4"><h3 className="text-2xl border-l-[12px] border-slate-900 pl-4 uppercase">施術内容</h3><textarea value={visitInfo.treatmentNote} onChange={e=>setVisitInfo({...visitInfo, treatmentNote:e.target.value})} className="w-full h-64 p-8 bg-slate-50 border-4 border-slate-100 rounded-[3rem] text-2xl font-black outline-none focus:border-blue-700" /></div>
               <div className="space-y-4"><h3 className="text-2xl border-l-[12px] border-blue-700 pl-4 uppercase">セルフケア指導</h3><textarea value={visitInfo.selfCare} onChange={e=>setVisitInfo({...visitInfo, selfCare:e.target.value})} className="w-full h-64 p-8 bg-purple-50/30 border-4 border-purple-100 rounded-[3rem] text-2xl font-black outline-none focus:border-purple-600" /></div>
            </section>

            <section className="space-y-12 border-t-8 border-slate-100 pt-16 pb-20">
              <div className="flex justify-between items-end"><h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 uppercase tracking-widest font-black">Before & After 分析</h3><button onClick={generateComparison} className="bg-green-600 text-white px-10 py-4 rounded-full text-xl shadow-2xl font-black animate-pulse">✨ 写真を合成して保存</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                {['before', 'after'].map(timing => (
                  <div key={timing} className="space-y-6"><p className={`text-center font-black text-xl tracking-[0.4em] uppercase ${timing === 'before' ? 'text-slate-400' : 'text-blue-700'}`}>{timing === 'before' ? 'Before' : 'After'}</p>
                    <div className="grid grid-cols-2 gap-4">
                      {['前', '横', '後ろ', '顔'].map(pos => {
                        const key = { '前': 'front', '横': 'side', '後ろ': 'back', '顔': 'face' }[pos];
                        const currentImg = (visitInfo.images as any)[timing][key as string];
                        return (<div key={pos} onClick={() => { const dummy = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="; setVisitInfo({ ...visitInfo, images: { ...visitInfo.images, [timing]: { ...(visitInfo.images as any)[timing], [key as string]: dummy } } }); }} className="aspect-[3/4] bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center relative cursor-pointer overflow-hidden">{currentImg ? <img src={currentImg} className="absolute inset-0 w-full h-full object-cover" /> : <span className="text-slate-300 font-black text-xs uppercase">{pos}</span>}</div>);
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <canvas ref={compositeCanvasRef} width={860} height={630} className="hidden" />
              {visitInfo.images.combined && <div className="mt-16 p-10 bg-slate-900 rounded-[4rem] text-center shadow-inner relative"><img src={visitInfo.images.combined} className="mx-auto rounded-3xl shadow-2xl border-8 border-white max-w-full" /><button className="mt-8 bg-green-500 text-white px-8 py-4 rounded-full font-black">公式LINE送信</button></div>}
            </section>
          </div>
        )}

        {activeTab === 'base' && (
          <div className="space-y-12 font-black text-slate-900">
            <h2 className="text-5xl border-l-[20px] border-slate-900 pl-8 font-black uppercase tracking-tighter">基本情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <div className="space-y-8">
                <div className="border-b-8 border-slate-900 pb-4">氏名<input value={baseInfo.name} onChange={e=>setBaseInfo({...baseInfo, name:e.target.value})} className="w-full text-7xl font-black bg-transparent outline-none mt-2" /></div>
                <div className="grid grid-cols-2 gap-6"><div className="p-8 bg-slate-50 border-2 rounded-[3rem]">年齢<input value={baseInfo.age} onChange={e=>setBaseInfo({...baseInfo, age:e.target.value})} className="w-full bg-transparent text-3xl font-black mt-2" /></div><div className="p-8 bg-slate-50 border-2 rounded-[3rem]">性別<input value={baseInfo.gender} onChange={e=>setBaseInfo({...baseInfo, gender:e.target.value})} className="w-full bg-transparent text-3xl font-black mt-2" /></div></div>
                <div className="p-8 bg-slate-50 border-2 rounded-[3rem]">住所<input value={baseInfo.address} onChange={e=>setBaseInfo({...baseInfo, address:e.target.value})} className="w-full bg-transparent text-3xl font-black mt-2" /></div>
                <div className="p-8 bg-slate-50 border-2 rounded-[3rem]">電話番号<input value={baseInfo.phone} onChange={e=>setBaseInfo({...baseInfo, phone:e.target.value})} className="w-full bg-transparent text-3xl font-black mt-2" /></div>
              </div>
              <div className="space-y-10">
                <div className="p-12 bg-slate-900 text-white rounded-[4.5rem] shadow-2xl"><h4 className="text-blue-400 text-xl tracking-widest uppercase mb-6">ありたい姿</h4><textarea value={baseInfo.goals} onChange={e=>setBaseInfo({...baseInfo, goals:e.target.value})} className="w-full h-80 bg-transparent text-4xl font-serif mt-4 outline-none leading-relaxed" /></div>
                <div className="p-8 bg-slate-50 border-2 rounded-[3rem]"><h4 className="text-slate-400 text-xs tracking-widest uppercase mb-4 tracking-tighter">既往歴・手術歴・医師の指示</h4><textarea value={baseInfo.history} onChange={e=>setBaseInfo({...baseInfo, history:e.target.value})} className="w-full h-32 bg-transparent text-xl font-black mt-2 outline-none" /></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}