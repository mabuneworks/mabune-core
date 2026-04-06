'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// --- 1. 型定義 ---
interface Session {
  date: string; amount: number; visitNumber: number;
  numericInspections: Record<string, number>;
  metaInspections: any;
  totalSum: number; beautyScore: number;
  treatmentNote: string; selfCare: string;
  bodyMapData?: string;
  images: { 
    before: { front: string; side: string; back: string; face: string }; 
    after: { front: string; side: string; back: string; face: string }; 
    comparisons: { front: string; side: string; back: string; face: string }; 
  };
}

interface Patient {
  id: string; name: string;
  base_info: { gender: string; age: string; address: string; phone: string; history: string; surgery: string; romLimit: string; goals: string; };
  chart_data: { latest: Session; history: Session[] };
  last_visit: string;
  tags: string[]; 
}

export default function MabuneUltimateCore() {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [activeTab, setActiveTab] = useState<'base' | 'visit'>('visit');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [newTagInput, setNewTagInput] = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);

  // --- 初期値 (これがある限りクラッシュしません) ---
  const initialSession: Session = {
    date: new Date().toISOString().split('T')[0], amount: 0, visitNumber: 1,
    numericInspections: { "顔": 3.5, "肩上": 3.5, "軸": 3.5, "AS": 3.5, "大転子": 3.5, "肘": 3.5, "肩": 3.5, "耳": 3.5, "肩内旋左": 3.5, "肩内旋右": 3.5 },
    metaInspections: { "顔_左右": '左', "顔_種類": '捻れ', "肩上_左右": '左', "軸_左右": '左', "AS_左右": '左', "肩捻じれ": '左', "膝屈曲": { side: '左', cm: 0 }, "膝屈曲内旋": { side: '左', cm: 0 }, "腰": { side: '左', pos: '中' }, "首": { side: '左', pos: '中' } },
    totalSum: 0, beautyScore: 0, treatmentNote: '', selfCare: '',
    images: { before: { front: '', side: '', back: '', face: '' }, after: { front: '', side: '', back: '', face: '' }, comparisons: { front: '', side: '', back: '', face: '' } }
  };

  const [visitInfo, setVisitInfo] = useState<Session>(initialSession);
  const [baseInfo, setBaseInfo] = useState({ name: '', gender: '', age: '', address: '', phone: '', history: '', surgery: '', romLimit: '', goals: '' });
  const [currentTags, setCurrentTags] = useState<string[]>([]);

  // --- ロジック ---
  const addTag = () => {
    const t = newTagInput.trim();
    if (t && !currentTags.includes(t)) { setCurrentTags([...currentTags, t]); setNewTagInput(''); }
  };

  const calculateScore = () => {
    const ins = visitInfo?.numericInspections || initialSession.numericInspections;
    const values = Object.values(ins) as number[];
    const sum = values.reduce((a, b) => a + (typeof b === 'number' ? b : 3.5), 0);
    const score = ((45 - (sum * 2)) * 2) + 50;
    return { sum, score: Math.round(score * 10) / 10 };
  };

  const draw = (e: any) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0].clientY) - rect.top;
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.strokeStyle = '#FF3B30';
    ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
  };

  const generateAllComparisons = async () => {
    const canvas = compositeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pairs = [{ key:'front', label:'前面', b:visitInfo.images.before.front, a:visitInfo.images.after.front }, { key:'side', label:'側面', b:visitInfo.images.before.side, a:visitInfo.images.after.side }, { key:'back', label:'背面', b:visitInfo.images.before.back, a:visitInfo.images.after.back }, { key:'face', label:'顔', b:visitInfo.images.before.face, a:visitInfo.images.after.face }];
    const newComparisons = { ...visitInfo.images.comparisons };
    alert('比較画像を自動生成中...');
    for (const p of pairs) {
      if (!p.b || !p.a) continue;
      const imgB = new Image(); const imgA = new Image();
      const load = (img: HTMLImageElement, src: string) => new Promise(res => { img.onload = res; img.src = src; });
      try {
        await Promise.all([load(imgB, p.b), load(imgA, p.a)]);
        canvas.width = 1240; canvas.height = 900;
        ctx.fillStyle = 'white'; ctx.fillRect(0,0,1240,900);
        ctx.drawImage(imgB, 20, 20, 580, 780); ctx.drawImage(imgA, 640, 20, 580, 780);
        ctx.fillStyle = '#000000'; ctx.font = 'bold 40px sans-serif';
        ctx.fillText(`BEFORE (${p.label})`, 40, 860); ctx.fillText(`AFTER (${p.label})`, 660, 860);
        (newComparisons as any)[p.key] = canvas.toDataURL('image/png');
      } catch (err) { console.error(err); }
    }
    setVisitInfo({ ...visitInfo, images: { ...visitInfo.images, comparisons: newComparisons } });
    alert('生成完了しました！');
  };

  const handleSave = async () => {
    const { sum, score } = calculateScore();
    const payload = {
      name: baseInfo.name, base_info: baseInfo,
      chart_data: { latest: { ...visitInfo, totalSum: sum, beautyScore: score, bodyMapData: canvasRef.current?.toDataURL() }, history: patients.find(p => p.id === selectedId)?.chart_data?.history || [] },
      last_visit: visitInfo.date, tags: currentTags
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

  // --- 【クラッシュ完全ガード】 ---
  const openEdit = (p: Patient) => {
    setSelectedId(p.id);
    const b = p.base_info || {};
    setBaseInfo({
      name: p.name || '', gender: b.gender || '', age: b.age || '', address: b.address || '',
      phone: b.phone || '', history: b.history || '', surgery: b.surgery || '',
      romLimit: b.romLimit || '', goals: b.goals || ''
    });
    setCurrentTags(p.tags || []);
    if (p.chart_data?.latest) {
      const L = p.chart_data.latest;
      setVisitInfo({
        ...initialSession, ...L, visitNumber: L.visitNumber || (p.chart_data.history?.length + 1) || 1,
        numericInspections: { ...initialSession.numericInspections, ...(L.numericInspections || {}) },
        metaInspections: { ...initialSession.metaInspections, ...(L.metaInspections || {}) },
        images: { 
          before: { ...initialSession.images.before, ...(L.images?.before || {}) },
          after: { ...initialSession.images.after, ...(L.images?.after || {}) },
          comparisons: { ...initialSession.images.comparisons, ...(L.images?.comparisons || {}) }
        }
      });
    } else { setVisitInfo(initialSession); }
    setView('edit');
  };

  const Selector = ({ label, current, options, onSelect }: any) => (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-black text-slate-400 uppercase">{label}</span>
      <div className="flex gap-1">
        {options.map((o: string) => (
          <button key={o} onClick={() => onSelect(o)} className={`flex-grow py-2 rounded-lg text-sm font-black border-2 transition ${current === o ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-400 border-slate-100'}`}>{o}</button>
        ))}
      </div>
    </div>
  );

  if (view === 'list') {
    const allUniqueTags = Array.from(new Set(patients.flatMap(p => p.tags || []))).filter(Boolean);
    const filtered = patients.filter(p => (p.name || "").includes(searchTerm) && (filterTag ? (p.tags || []).includes(filterTag) : true));
    return (
      <div className="p-8 bg-slate-50 min-h-screen text-slate-900 font-black">
        <header className="max-w-6xl mx-auto flex justify-between items-center mb-10"><h1 className="text-4xl font-serif tracking-tighter">mabune Core</h1><button onClick={() => { setSelectedId(null); setVisitInfo(initialSession); setBaseInfo({name:'',gender:'',age:'',address:'',phone:'',history:'',surgery:'',romLimit:'',goals:''}); setCurrentTags([]); setView('edit'); }} className="bg-slate-900 text-white px-10 py-4 rounded-full font-black shadow-2xl">＋ 新規登録</button></header>
        <div className="max-w-6xl mx-auto mb-8 flex gap-4"><input placeholder="名前で検索..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="flex-grow p-4 rounded-2xl border-2 border-slate-200 outline-none focus:border-blue-600" /><select value={filterTag} onChange={e=>setFilterTag(e.target.value)} className="p-4 rounded-2xl border-2 border-slate-200 bg-white min-w-[200px] text-slate-500"><option value="">すべてのタグ</option>{allUniqueTags.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
        <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3">{filtered.map(p => (<div key={p.id} onClick={() => openEdit(p)} className="p-8 bg-white rounded-[3rem] shadow-sm border-4 border-transparent hover:border-blue-600 cursor-pointer transition flex flex-col justify-between aspect-[4/3]"><div className="text-2xl">{p.name || "名称なし"} 様</div><div className="text-blue-700 font-mono text-7xl font-black self-center">{p.chart_data?.latest?.beautyScore ?? '--'}</div><div className="flex flex-wrap gap-2 pt-4">{(p.tags || []).map(t=><span key={t} className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded-full">#{t}</span>)}</div></div>))}</div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen flex flex-col text-slate-900 font-black pb-40">
      <header className="p-4 border-b-4 flex justify-between items-center sticky top-0 bg-white z-50">
        <div className="flex items-center gap-6"><button onClick={()=>setView('list')} className="text-2xl font-black text-slate-400 mr-2">✕</button><div className="flex flex-col border-r-4 pr-6 border-slate-100"><input value={baseInfo.name} onChange={e=>setBaseInfo({...baseInfo, name:e.target.value})} className="text-2xl font-black bg-transparent outline-none focus:bg-slate-50 rounded px-1" placeholder="氏名" /><div className="flex items-center gap-1 mt-1 text-blue-600"><span className="text-[10px] font-black">受診回数: 第</span><input type="number" value={visitInfo.visitNumber} onChange={e=>setVisitInfo({...visitInfo, visitNumber:parseInt(e.target.value)||1})} className="w-10 text-center bg-slate-50 rounded font-black text-xs outline-none" /><span className="text-[10px] font-black">回</span></div></div></div>
        <nav className="flex gap-10"><button onClick={()=>setActiveTab('base')} className={`pb-2 text-lg font-black uppercase ${activeTab==='base'?'text-blue-700 border-b-8 border-blue-700':'text-slate-300'}`}>基本情報</button><button onClick={()=>setActiveTab('visit')} className={`pb-2 text-lg font-black uppercase ${activeTab==='visit'?'text-blue-700 border-b-8 border-blue-700':'text-slate-300'}`}>受診・検査</button></nav>
        <button onClick={handleSave} className="bg-blue-700 text-white px-10 py-3 rounded-full text-xl shadow-xl">保存</button>
      </header>

      <main className="p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'visit' && (
          <div className="space-y-16 animate-in fade-in">
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10 bg-slate-50 rounded-[3rem] border-2 border-slate-100"><div className="space-y-2"><label className="text-xs text-slate-400 font-black uppercase">受診日</label><input type="date" value={visitInfo.date} onChange={e=>setVisitInfo({...visitInfo, date:e.target.value})} className="w-full text-3xl font-black bg-white/50 border-b-4 border-slate-200 p-2 outline-none" /></div><div className="space-y-2"><label className="text-xs text-slate-400 font-black uppercase">支払金額</label><div className="flex items-center gap-2 bg-white/50 border-b-4 border-slate-200 p-2"><span className="text-3xl">¥</span><input type="number" value={visitInfo.amount} onChange={e=>setVisitInfo({...visitInfo, amount:parseInt(e.target.value)})} className="w-full text-3xl font-black outline-none bg-transparent" /></div></div></section>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-20 items-start">
              <div className="space-y-6"><div className="flex justify-between items-end"><h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 font-black uppercase tracking-tighter">人体図</h3><button onClick={()=>canvasRef.current?.getContext('2d')?.clearRect(0,0,800,1066)} className="bg-slate-200 text-slate-600 px-6 py-2 rounded-full text-xs font-black">記入キャンセル</button></div><div className="relative w-full bg-slate-50 rounded-[4rem] border-4 border-slate-200 overflow-hidden shadow-inner aspect-[3/4] touch-none"><img src="/body-map.png" className="absolute inset-0 w-full h-full object-contain p-12 opacity-40 pointer-events-none" /><canvas ref={canvasRef} width={800} height={1066} onMouseDown={()=>setIsDrawing(true)} onMouseMove={draw} onMouseUp={()=>setIsDrawing(false)} onMouseLeave={()=>setIsDrawing(false)} className="absolute inset-0 w-full h-full cursor-crosshair" /></div></div>
              <div className="space-y-10">
                <h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 font-black uppercase tracking-tighter">検査結果</h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-6 border-b-4 pb-10 scrollbar-hide">
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 space-y-6"><div className="flex justify-between items-center text-2xl font-black text-blue-900 underline decoration-4">顔<span>{visitInfo.numericInspections["顔"]?.toFixed(1)}</span></div><div className="grid grid-cols-2 gap-4"><Selector label="左右" current={visitInfo.metaInspections["顔_左右"]} options={['左', '右']} onSelect={(v:any)=>setVisitInfo({...visitInfo, metaInspections:{...visitInfo.metaInspections, "顔_左右":v}})} /><Selector label="種類" current={visitInfo.metaInspections["顔_種類"]} options={['捻れ','傾き','スライド']} onSelect={(v:any)=>setVisitInfo({...visitInfo, metaInspections:{...visitInfo.metaInspections, "顔_種類":v}})} /></div><input type="range" min="2" max="5" step="0.5" value={visitInfo.numericInspections["顔"]} onChange={e=>setVisitInfo({...visitInfo, numericInspections:{...visitInfo.numericInspections, "顔":parseFloat(e.target.value)}})} className="w-full h-4 accent-blue-700" /></div>
                  {["肩上","軸","AS","大転子","肘","肩","耳","肩内旋左","肩内旋右"].map(k=>(<div key={k} className="p-6 bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm space-y-4 font-black"><div className="flex justify-between items-center text-xl font-black text-slate-800">{k}<span>{visitInfo.numericInspections[k]?.toFixed(1)}</span></div>{["肩上","軸","AS"].includes(k) && <Selector label="左右" current={(visitInfo.metaInspections as any)[`${k}_左右`]} options={['左', '右']} onSelect={(v:any)=>setVisitInfo({...visitInfo, metaInspections:{...visitInfo.metaInspections, [`${k}_左右`]:v}})} />}<input type="range" min="2" max="5" step="0.5" value={visitInfo.numericInspections[k]} onChange={e=>setVisitInfo({...visitInfo, numericInspections:{...visitInfo.numericInspections, [k]:parseFloat(e.target.value)}})} className="w-full h-4 accent-blue-700" /></div>))}
                  {['膝屈曲', '膝屈曲内旋'].map(k => { const sK = k === '膝屈曲' ? 'kneeFlexion' : 'kneeInternalRotation'; return (<div key={k} className="p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 space-y-4 font-black"><label className="text-lg text-blue-800 font-black">{k}</label><Selector label="左右" current={(visitInfo.metaInspections as any)[sK].side} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, [sK]: {...(visitInfo.metaInspections as any)[sK], side: v}}})} /><input type="number" value={(visitInfo.metaInspections as any)[sK].cm} onChange={e => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, [sK]: {...(visitInfo.metaInspections as any)[sK], cm: parseFloat(e.target.value)}}})} className="w-full text-2xl font-black bg-white border-2 p-2 rounded-xl" /></div>); })}
                  {['首', '腰'].map(k => { const sK = k === '首' ? 'neck' : 'waist'; return (<div key={k} className="p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 space-y-4 font-black"><label className="text-lg text-slate-800 font-black">{k}</label><Selector label="左右" current={(visitInfo.metaInspections as any)[sK].side} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, [sK]: {...(visitInfo.metaInspections as any)[sK], side: v}}})} /><Selector label="位置" current={(visitInfo.metaInspections as any)[sK].pos} options={['上', '中', '下']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, [sK]: {...(visitInfo.metaInspections as any)[sK], pos: v}}})} /></div>); })}
                  <div className="p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 font-black"><label className="text-lg text-slate-900 font-black">肩捻じれ</label><Selector label="左右" current={visitInfo.metaInspections["肩捻じれ"]} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, "肩捻じれ": v}})} /></div>
                </div>
                <section className="bg-purple-50 text-purple-900 p-12 rounded-[3.5rem] text-center border-4 border-purple-100 shadow-xl"><h3 className="text-purple-400 text-xl font-black tracking-[0.5em] mb-4 uppercase">美の偏差値</h3><div className="text-[10rem] font-serif font-black italic leading-none">{calculateScore().score}</div></section>
              </div>
            </div>
            <section className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t-8 border-slate-100 pt-16 font-black"><div className="space-y-4"><h3 className="text-2xl border-l-[12px] border-slate-900 pl-4 uppercase">施術内容</h3><textarea value={visitInfo.treatmentNote} onChange={e=>setVisitInfo({...visitInfo, treatmentNote:e.target.value})} className="w-full h-64 p-8 bg-slate-50 border-4 border-slate-100 rounded-[3rem] text-2xl font-black outline-none focus:border-blue-700" /></div><div className="space-y-4"><h3 className="text-2xl border-l-[12px] border-blue-700 pl-4 uppercase">セルフケア指導</h3><textarea value={visitInfo.selfCare} onChange={e=>setVisitInfo({...visitInfo, selfCare:e.target.value})} className="w-full h-64 p-8 bg-purple-50/30 border-4 border-purple-100 rounded-[3rem] text-2xl font-black outline-none focus:border-purple-600" /></div></section>
            <section className="space-y-12 border-t-8 border-slate-100 pt-16 pb-20">
              <div className="flex justify-between items-end"><h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 uppercase tracking-widest font-black text-slate-900">Before & After 分析</h3><button onClick={generateAllComparisons} className="bg-green-600 text-white px-10 py-5 rounded-full text-xl shadow-2xl font-black animate-pulse">✨ 全比較画像を自動生成</button></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16">{['before', 'after'].map(timing => (<div key={timing} className="space-y-6"><p className={`text-center font-black text-xl tracking-[0.4em] uppercase ${timing === 'before' ? 'text-slate-400' : 'text-blue-700'}`}>{timing}</p><div className="grid grid-cols-2 gap-4">{['前面', '横', '背面', '顔'].map(pos => { const key = { '前面': 'front', '横': 'side', '背面': 'back', '顔': 'face' }[pos]; const currentImg = (visitInfo.images as any)[timing][key as string]; return (<div key={pos} onClick={() => { const dummy = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="; setVisitInfo({ ...visitInfo, images: { ...visitInfo.images, [timing]: { ...(visitInfo.images as any)[timing], [key as string]: dummy } } }); }} className="aspect-[3/4] bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center relative cursor-pointer overflow-hidden group">{currentImg ? <img src={currentImg} className="absolute inset-0 w-full h-full object-cover" /> : <span className="text-slate-300 font-black text-xs uppercase">{pos}</span>}<div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px]">クリックして入力</div></div>); })}</div></div>))}</div>
              <canvas ref={compositeCanvasRef} style={{display:'none'}} />
              {Object.values(visitInfo.images.comparisons).some(img => img) && (
                <div className="mt-16 p-10 bg-slate-900 rounded-[4rem] text-center shadow-inner space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">{['front','side','back','face'].map(k => (visitInfo.images.comparisons as any)[k] && <div key={k} className="p-4 bg-white rounded-3xl shadow-2xl relative group"><img src={(visitInfo.images.comparisons as any)[k]} className="rounded-xl w-full" /><button className="absolute top-4 right-4 bg-green-500 text-white px-4 py-1 rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition">LINE送信</button></div>)}</div>
                </div>
              )}
            </section>
          </div>
        )}
        {activeTab === 'base' && (
          <div className="space-y-12 font-black text-slate-900 animate-in fade-in">
            <h2 className="text-5xl border-l-[20px] border-slate-900 pl-8 uppercase tracking-tighter">基本情報 Profile</h2>
            <div className="p-10 bg-slate-50 rounded-[3rem] border-2 space-y-4"><label className="text-xs uppercase text-slate-400 tracking-widest font-black">タグ管理 (自由に追加)</label><div className="flex gap-2 flex-wrap pt-2">{currentTags.map(t => <span key={t} onClick={() => setCurrentTags(currentTags.filter(x => x !== t))} className="bg-blue-700 text-white px-5 py-2 rounded-full cursor-pointer hover:bg-red-500 transition font-bold text-sm">#{t} ✕</span>)}<div className="flex border-2 rounded-full overflow-hidden bg-white border-slate-200"><input value={newTagInput} onChange={e => setNewTagInput(e.target.value)} placeholder="タグ名..." className="px-5 py-2 outline-none font-bold text-slate-700" /><button onClick={addTag} className="bg-slate-900 text-white px-6 font-black">追加</button></div></div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16"><div className="space-y-10"><div className="border-b-8 border-slate-900 pb-4">氏名<input value={baseInfo.name} onChange={e=>setBaseInfo({...baseInfo, name:e.target.value})} className="w-full text-7xl font-black bg-transparent outline-none" /></div><div className="grid grid-cols-2 gap-6"><div className="p-8 bg-slate-50 border-2 rounded-[3rem]">性別<input value={baseInfo.gender} onChange={e=>setBaseInfo({...baseInfo, gender:e.target.value})} className="w-full bg-transparent text-3xl font-black" /></div><div className="p-8 bg-slate-50 border-2 rounded-[3rem]">年齢<input value={baseInfo.age} onChange={e=>setBaseInfo({...baseInfo, age:e.target.value})} className="w-full bg-transparent text-3xl font-black" /></div></div><div className="p-8 bg-slate-50 border-2 rounded-[3rem]">住所<input value={baseInfo.address} onChange={e=>setBaseInfo({...baseInfo, address:e.target.value})} className="w-full bg-transparent text-3xl font-black" /></div><div className="p-8 bg-slate-50 border-2 rounded-[3rem]">電話番号<input value={baseInfo.phone} onChange={e=>setBaseInfo({...baseInfo, phone:e.target.value})} className="w-full bg-transparent text-3xl font-black" /></div></div><div className="space-y-10"><div className="p-12 bg-slate-900 text-white rounded-[4.5rem] shadow-2xl"><h4 className="text-blue-400 text-xl font-black uppercase mb-6">なりたい姿</h4><textarea value={baseInfo.goals} onChange={e=>setBaseInfo({...baseInfo, goals:e.target.value})} className="w-full h-80 bg-transparent text-4xl font-serif mt-4 outline-none leading-relaxed" /></div><div className="p-8 bg-slate-50 border-2 rounded-[3rem] space-y-6"><div>既往歴<textarea value={baseInfo.history} onChange={e=>setBaseInfo({...baseInfo, history:e.target.value})} className="w-full h-24 bg-transparent text-xl font-black outline-none border-b" /></div><div>手術歴<textarea value={baseInfo.surgery} onChange={e=>setBaseInfo({...baseInfo, surgery:e.target.value})} className="w-full h-24 bg-transparent text-xl font-black outline-none border-b" /></div><div>可動域制限・指示<textarea value={baseInfo.romLimit} onChange={e=>setBaseInfo({...baseInfo, romLimit:e.target.value})} className="w-full h-24 bg-transparent text-xl font-black outline-none" /></div></div></div></div>
          </div>
        )}
      </main>
    </div>
  );
}