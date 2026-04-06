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
    comparisons: { front: string; side: string; back: string; face: string }; // 4種類の合成画像
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

  // --- 初期値 ---
  const initialSession: Session = {
    date: new Date().toISOString().split('T')[0], amount: 0, visitNumber: 1,
    numericInspections: { "顔": 3.5, "肩上": 3.5, "軸": 3.5, "AS": 3.5, "大転子": 3.5, "肘": 3.5, "肩": 3.5, "耳": 3.5, "肩内旋左": 3.5, "肩内旋右": 3.5 },
    metaInspections: { "顔_左右": '左', "顔_種類": '捻れ', "肩上_左右": '左', "軸_左右": '左', "AS_左右": '左', "肩捻じれ": '左', "膝屈曲": { side: '左', cm: 0 }, "膝屈曲内旋": { side: '左', cm: 0 }, "腰": { side: '左', pos: '中' }, "首": { side: '左', pos: '中' } },
    totalSum: 0, beautyScore: 0, treatmentNote: '', selfCare: '',
    images: { 
      before: { front: '', side: '', back: '', face: '' }, 
      after: { front: '', side: '', back: '', face: '' }, 
      comparisons: { front: '', side: '', back: '', face: '' } // 初期化
    }
  };

  const [visitInfo, setVisitInfo] = useState<Session>(initialSession);
  const [baseInfo, setBaseInfo] = useState({ name: '', gender: '', age: '', address: '', phone: '', history: '', surgery: '', romLimit: '', goals: '' });
  const [currentTags, setCurrentTags] = useState<string[]>([]);

  // --- ロジック ---
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
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#FF3B30';
    ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y);
  };

  // --- 【新規】全方面 Before/After 自動合成ロジック ---
  const generateComparisons = async () => {
    const canvas = compositeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newComparisons = { ...visitInfo.images.comparisons };

    // 合成するペアの定義
    const pairs = [
      { key: 'front', label: '全身前面', before: visitInfo.images.before.front, after: visitInfo.images.after.front },
      { key: 'side', label: '全身側面', before: visitInfo.images.before.side, after: visitInfo.images.after.side },
      { key: 'back', label: '全身背面', before: visitInfo.images.before.back, after: visitInfo.images.after.back },
      { key: 'face', label: '顔', before: visitInfo.images.before.face, after: visitInfo.images.after.face },
    ];

    // ローディング表示（簡易版）
    alert('比較画像を自動生成しています。少々お待ちください...');

    for (const pair of pairs) {
      if (!pair.before || !pair.after) continue; // 画像が揃っていない場合はスキップ

      const imgB = new Image(); const imgA = new Image();
      const load = (img: HTMLImageElement, src: string) => new Promise(res => { img.onload = res; img.src = src; });
      
      try {
        await Promise.all([load(imgB, pair.before), load(imgA, pair.after)]);

        // キャンバスサイズ (LINE送信を考慮して以前の顔合成のサイズを基準にするか、調整するか)
        // ボディマップと同じアスペクト比 3:4 (e.g. 600x800) とする。
        // 横並びだと 1240 x 900 (余白ラベル含む) 
        const canvasWidth = 1240;
        const canvasHeight = 900;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 画像描画サイズ (余白を考慮)
        const targetW = 600;
        const targetH = 800;
        const margin = 20;

        // BEFORE
        ctx.drawImage(imgB, margin, margin, targetW, targetH);
        // AFTER
        ctx.drawImage(imgA, margin * 2 + targetW, margin, targetW, targetH);

        // ラベル描画
        ctx.fillStyle = '#000000'; ctx.font = 'bold 36px sans-serif';
        ctx.fillText(`BEFORE (${pair.label})`, margin + 20, canvasHeight - 30);
        ctx.fillText(`AFTER (${pair.label})`, margin * 2 + targetW + 20, canvasHeight - 30);

        // DataURLを保存
        (newComparisons as any)[pair.key] = canvas.toDataURL('image/png');

      } catch (error) {
        console.error(`合成エラー (${pair.label}):`, error);
      }
    }

    setVisitInfo({ ...visitInfo, images: { ...visitInfo.images, comparisons: newComparisons } });
    canvas.width = 0; canvas.height = 0; // キャンバスをクリア
    alert('Before/After比較画像の生成が完了しました！');
  };

  const handleSave = async () => {
    const { sum, score } = calculateScore();
    const payload = {
      name: baseInfo.name, 
      base_info: baseInfo,
      chart_data: { latest: { ...visitInfo, totalSum: sum, beautyScore: score, bodyMapData: canvasRef.current?.toDataURL() }, history: patients.find(p => p.id === selectedId)?.chart_data?.history || [] },
      last_visit: visitInfo.date,
      tags: currentTags
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
    setSelectedId(p.id);
    setBaseInfo({ 
      name: p.name || '', gender: p.base_info?.gender || '', age: p.base_info?.age || '', 
      address: p.base_info?.address || '', phone: p.base_info?.phone || '', 
      history: p.base_info?.history || '', surgery: p.base_info?.surgery || '', 
      romLimit: p.base_info?.romLimit || '', goals: p.base_info?.goals || '' 
    });
    setCurrentTags(p.tags || []);

    if (p.chart_data?.latest) {
      const latest = p.chart_data.latest;
      // 古いデータ形式（combined）がある場合、comparisons.faceへ移行（後方互換性）
      const comparisons = latest.images?.comparisons || initialSession.images.comparisons;
      if (!comparisons.face && (latest.images as any)?.combined) {
          comparisons.face = (latest.images as any).combined;
      }

      setVisitInfo({ 
        ...initialSession, 
        ...latest,
        visitNumber: p.chart_data.history?.length + 1 || 1,
        images: {
          ...initialSession.images,
          ...(latest.images || {}),
          comparisons: comparisons
        }
      });
    } else {
      setVisitInfo({ ...initialSession, visitNumber: 1 });
    }
    setView('edit');
  };

  // タグ追加
  const addTag = () => {
    if (newTagInput && !currentTags.includes(newTagInput)) {
      setCurrentTags([...currentTags, newTagInput]);
      setNewTagInput('');
    }
  };

  // フィルタリング
  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.includes(searchTerm) || p.base_info?.address?.includes(searchTerm);
    const matchesTag = filterTag ? p.tags?.includes(filterTag) : true;
    return matchesSearch && matchesTag;
  });

  const Selector = ({ label, current, options, onSelect }: any) => (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-black text-slate-400 uppercase">{label}</span>
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
        <header className="max-w-6xl mx-auto flex justify-between items-center mb-10">
          <h1 className="text-4xl font-serif tracking-tighter">mabune Core</h1>
          <button onClick={() => { setSelectedId(null); setVisitInfo(initialSession); setBaseInfo({name:'',gender:'',age:'',address:'',phone:'',history:'',surgery:'',romLimit:'',goals:''}); setCurrentTags([]); setView('edit'); }} className="bg-slate-900 text-white px-10 py-4 rounded-full font-black shadow-2xl">＋ 新規ゲスト登録</button>
        </header>

        <div className="max-w-6xl mx-auto mb-8 flex gap-4">
          <input placeholder="氏名・住所で検索..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-grow p-4 rounded-2xl border-2 border-slate-200 outline-none focus:border-blue-600 font-black" />
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)} className="p-4 rounded-2xl border-2 border-slate-200 bg-white font-black text-slate-600">
            <option value="">すべてのタグ</option>
            {Array.from(new Set(patients.flatMap(p => p.tags || []))).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="max-w-6xl mx-auto grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPatients.map(p => (
            <div key={p.id} onClick={() => openEdit(p)} className="p-8 bg-white rounded-[3rem] shadow-sm border-4 border-transparent hover:border-blue-600 cursor-pointer transition flex flex-col justify-between aspect-[4/3]">
              <div className="text-2xl">{p.name} 様</div>
              <div className="flex-grow flex items-center justify-center">
                <div className="text-blue-700 font-mono text-7xl font-black">{p.chart_data?.latest?.beautyScore ?? '--'}</div>
              </div>
              <div className="flex justify-between items-end">
                  <div className="flex flex-wrap gap-2">
                    {p.tags?.map(t => <span key={t} className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded-full">#{t}</span>)}
                  </div>
                  <span className="text-xs text-slate-400 font-normal">最終受診: {p.last_visit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen flex flex-col text-slate-900 font-black pb-40">
      <header className="p-4 border-b-4 flex justify-between items-center sticky top-0 bg-white z-50">
        <div className="flex items-center gap-6">
          <button onClick={() => setView('list')} className="text-2xl font-black text-slate-400 mr-2">✕</button>
          <div className="flex flex-col border-r-4 pr-6 border-slate-100">
            <input value={baseInfo.name} onChange={e => setBaseInfo({...baseInfo, name: e.target.value})} className="text-2xl font-black bg-transparent outline-none border-b-2 border-transparent focus:border-slate-200" placeholder="氏名を入力" />
            <div className="flex items-center gap-1 mt-1 text-blue-600">
              <span className="text-[10px] font-black uppercase tracking-widest">受診回数: 第</span>
              <input type="number" value={visitInfo.visitNumber} onChange={e => setVisitInfo({...visitInfo, visitNumber: parseInt(e.target.value) || 1})} className="w-12 text-center bg-slate-50 rounded border font-black text-xs outline-none" />
              <span className="text-[10px] font-black uppercase tracking-widest">回</span>
            </div>
          </div>
        </div>
        <nav className="flex gap-10">
          <button onClick={() => setActiveTab('base')} className={`pb-2 text-lg font-black uppercase tracking-widest ${activeTab === 'base' ? 'text-blue-700 border-b-8 border-blue-700' : 'text-slate-300'}`}>基本情報</button>
          <button onClick={() => setActiveTab('visit')} className={`pb-2 text-lg font-black uppercase tracking-widest ${activeTab === 'visit' ? 'text-blue-700 border-b-8 border-blue-700' : 'text-slate-300'}`}>受診・検査</button>
        </nav>
        <button onClick={handleSave} className="bg-blue-700 text-white px-10 py-3 rounded-full text-xl shadow-xl hover:scale-105 transition">保存</button>
      </header>

      <main className="p-8 max-w-7xl mx-auto w-full">
        {activeTab === 'visit' && (
          <div className="space-y-16 animate-in fade-in duration-500">
            <section className="grid grid-cols-1 md:grid-cols-2 gap-8 p-10 bg-slate-50 rounded-[3rem] border-2 border-slate-100 shadow-sm">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-black uppercase tracking-widest">受診日</label>
                <input type="date" value={visitInfo.date} onChange={e => setVisitInfo({...visitInfo, date: e.target.value})} className="w-full text-3xl font-black bg-white/50 border-b-4 border-slate-200 p-2 outline-none focus:border-blue-700 transition-colors" />
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
                <div className="flex justify-between items-end"><h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 font-black uppercase tracking-tighter text-slate-900">人体図 (臨床メモ)</h3><button onClick={() => canvasRef.current?.getContext('2d')?.clearRect(0,0,800,1066)} className="bg-slate-200 text-slate-600 px-6 py-2 rounded-full text-xs font-black hover:bg-red-100 hover:text-red-600 transition">記入キャンセル (全消去)</button></div>
                <div className="relative w-full bg-slate-50 rounded-[4rem] border-4 border-slate-200 overflow-hidden shadow-inner aspect-[3/4] touch-none">
                  <img src="/body-map.png" className="absolute inset-0 w-full h-full object-contain p-10 opacity-40 pointer-events-none" />
                  <canvas ref={canvasRef} width={800} height={1066} onMouseDown={() => setIsDrawing(true)} onMouseMove={draw} onMouseUp={() => setIsDrawing(false)} onMouseLeave={() => setIsDrawing(false)} className="absolute inset-0 w-full h-full cursor-crosshair" />
                </div>
              </div>

              <div className="space-y-10">
                <h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 font-black uppercase tracking-tighter text-slate-900">検査項目・結果</h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-6 border-b-4 pb-10 scrollbar-hide">
                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 space-y-6">
                    <div className="flex justify-between items-center text-2xl font-black text-blue-900 underline decoration-4 underline-offset-8">顔<span>{visitInfo.numericInspections["顔"]?.toFixed(1)}</span></div>
                    <div className="grid grid-cols-2 gap-4"><Selector label="左右" current={visitInfo.metaInspections["顔_左右"]} options={['左', '右']} onSelect={(v:any)=>setVisitInfo({...visitInfo, metaInspections:{...visitInfo.metaInspections, "顔_左右":v}})} /><Selector label="種類" current={visitInfo.metaInspections["顔_種類"]} options={['捻れ','傾き','スライド']} onSelect={(v:any)=>setVisitInfo({...visitInfo, metaInspections:{...visitInfo.metaInspections, "顔_種類":v}})} /></div>
                    <input type="range" min="2" max="5" step="0.5" value={visitInfo.numericInspections["顔"]} onChange={e=>setVisitInfo({...visitInfo, numericInspections:{...visitInfo.numericInspections, "顔":parseFloat(e.target.value)}})} className="w-full h-4 accent-blue-700" />
                  </div>
                  {["肩上","軸","AS","大転子","肘","肩","耳","肩内旋左","肩内旋右"].map(k=>(
                    <div key={k} className="p-6 bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm space-y-4 font-black">
                      <div className="flex justify-between items-center text-xl font-black text-slate-900">{k}<span>{visitInfo.numericInspections[k]?.toFixed(1)}</span></div>
                      {["肩上","軸","AS"].includes(k) && <Selector label="左右" current={(visitInfo.metaInspections as any)[`${k}_左右`]} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, [`${k}_左右`]: v}})} />}
                      <input type="range" min="2" max="5" step="0.5" value={visitInfo.numericInspections[k]} onChange={e=>setVisitInfo({...visitInfo, numericInspections:{...visitInfo.numericInspections, [k]:parseFloat(e.target.value)}})} className="w-full h-4 accent-blue-700" />
                    </div>
                  ))}
                  {['膝屈曲', '膝屈曲内旋'].map(k => {
                    const stateKey = k === '膝屈曲' ? 'kneeFlexion' : 'kneeInternalRotation';
                    return (<div key={k} className="p-6 bg-slate-50 rounded-[2rem] border-2 border-slate-100 space-y-4 font-black"><label className="text-lg text-blue-800 font-black">{k}</label><Selector label="左右" current={(visitInfo.metaInspections as any)[stateKey].side} options={['左', '右']} onSelect={(v: any) => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, [stateKey]: {...(visitInfo.metaInspections as any)[stateKey], side: v}}})} /><div className="flex items-center gap-2 bg-white p-2 rounded-xl border-2"><input type="number" value={(visitInfo.metaInspections as any)[stateKey].cm} onChange={e => setVisitInfo({...visitInfo, metaInspections: {...visitInfo.metaInspections, [stateKey]: {...(visitInfo.metaInspections as any)[stateKey], cm: parseFloat(e.target.value)}}})} className="w-full text-2xl font-black outline-none bg-transparent" /><span className="text-slate-400 font-bold">cm</span></div></div>);
                  })}
                </div>
                {/* 偏差値表示: 上品な薄紫色 */}
                <section className="bg-purple-50 text-purple-900 p-12 rounded-[3.5rem] text-center border-4 border-purple-100 shadow-xl">
                  <h3 className="text-purple-400 text-xl font-black tracking-[0.5em] mb-4 uppercase relavitve z-10">美の偏差値</h3>
                  <div className="text-[10rem] font-serif font-black italic leading-none relavitve z-10">{calculateScore().score}</div>
                  <div className="text-purple-300 mt-6 font-normal relavitve z-10 uppercase tracking-widest text-xs">合計数値: {calculateScore().sum.toFixed(1)}</div>
                </section>
              </div>
            </div>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-10 border-t-8 border-slate-100 pt-16 font-black">
               <div className="space-y-4"><h3 className="text-2xl border-l-[12px] border-slate-900 pl-4 uppercase text-slate-900 tracking-tighter">施術内容</h3><textarea value={visitInfo.treatmentNote} onChange={e=>setVisitInfo({...visitInfo, treatmentNote:e.target.value})} className="w-full h-64 p-8 bg-slate-50 border-4 border-slate-100 rounded-[3rem] text-2xl font-black outline-none focus:border-blue-700 leading-snug" placeholder="本日の施術内容・工夫..." /></div>
               <div className="space-y-4"><h3 className="text-2xl border-l-[12px] border-blue-700 pl-4 uppercase text-blue-700 tracking-tighter">セルフケア指導 Advice</h3><textarea value={visitInfo.selfCare} onChange={e=>setVisitInfo({...visitInfo, selfCare:e.target.value})} className="w-full h-64 p-8 bg-purple-50/30 border-4 border-purple-100 rounded-[3rem] text-2xl font-black outline-none focus:border-purple-600 leading-snug" placeholder="ゲストへ伝える宿題・改善点..." /></div>
            </section>

            {/* Visual Record & All Comparisons (全自動合成) */}
            <section className="space-y-12 border-t-8 border-slate-100 pt-16 pb-20">
              <div className="flex justify-between items-end gap-6">
                <h3 className="text-3xl border-l-[16px] border-blue-700 pl-6 uppercase tracking-widest font-black text-slate-900">Visual Record & Analysis</h3>
                {/* 【修正】全方面合成ボタン */}
                <button onClick={generateComparisons} className="bg-green-600 text-white px-10 py-5 rounded-full text-xl shadow-2xl font-black hover:scale-110 transition animate-pulse">✨ 全比較画像を自動生成</button>
              </div>
              
              {/* 写真入力エリア */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-16 pt-10">
                {['before', 'after'].map(timing => (
                  <div key={timing} className="space-y-6">
                    <p className={`text-center font-black text-2xl tracking-[0.4em] uppercase ${timing === 'before' ? 'text-slate-400' : 'text-blue-700'}`}>{timing === 'before' ? 'Before' : 'After'}</p>
                    <div className="grid grid-cols-2 gap-4">
                      {['前面', '横', '背面', '顔'].map(pos => {
                        const key = { '前面': 'front', '横': 'side', '背面': 'back', '顔': 'face' }[pos];
                        const currentImg = (visitInfo.images as any)[timing][key as string];
                        return (
                          <div key={pos} onClick={() => {
                            const dummy = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
                            setVisitInfo({ ...visitInfo, images: { ...visitInfo.images, [timing]: { ...(visitInfo.images as any)[timing], [key as string]: dummy } } });
                          }} className="aspect-[3/4] bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center relative cursor-pointer overflow-hidden group">
                             {currentImg ? <img src={currentImg} className="absolute inset-0 w-full h-full object-cover" /> : <span className="text-slate-300 font-black text-xl uppercase">{pos}</span>}
                             <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"><span className="text-white font-black">クリックして入力</span></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              
              <canvas ref={compositeCanvasRef} width={0} height={0} className="hidden" />
              
              {/* 【修正】合成画像表示エリア（4方面すべて） */}
              {Object.values(visitInfo.images.comparisons).some(img => img) && (
                <div className="mt-16 p-12 bg-slate-900 rounded-[4rem] shadow-inner space-y-12">
                  <h4 className="text-blue-400 text-sm font-black tracking-[0.6em] mb-12 uppercase text-center underline decoration-4 underline-offset-8">公式LINE送信用 Before/After カード</h4>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {[
                      { key: 'front', label: '全身前面' },
                      { key: 'side', label: '全身側面' },
                      { key: 'back', label: '全身背面' },
                      { key: 'face', label: '顔 Analysis' },
                    ].map(card => {
                      const img = (visitInfo.images.comparisons as any)[card.key];
                      if (!img) return null;
                      return (
                        <div key={card.key} className="p-6 bg-white rounded-3xl shadow-2xl relative group">
                          <img src={img} className="mx-auto rounded-xl max-w-full" alt={card.label} />
                          <p className="text-center font-black mt-4 text-slate-800 tracking-wider">#{card.label}</p>
                          <button className="absolute top-4 right-4 bg-green-500 text-white px-6 py-2 rounded-full font-black opacity-0 group-hover:opacity-100 transition hover:scale-110">LINE送信</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'base' && (
          <div className="space-y-12 font-black animate-in fade-in duration-500">
            <h2 className="text-5xl border-l-[20px] border-slate-900 pl-8 font-black uppercase tracking-tighter text-slate-900">基本情報 Guest Profile</h2>
            
            {/* タグ管理 */}
            <div className="p-10 bg-slate-50 rounded-[3rem] border-2 space-y-4 shadow-sm">
              <label className="text-xs uppercase text-slate-400 tracking-widest">タグ管理 Tags</label>
              <div className="flex gap-2 flex-wrap pt-2">
                {currentTags.map(t => <span key={t} onClick={() => setCurrentTags(currentTags.filter(x => x !== t))} className="bg-blue-700 text-white px-5 py-2 rounded-full cursor-pointer hover:bg-red-500 transition font-bold text-sm">#{t} ✕</span>)}
                <div className="flex border-2 rounded-full overflow-hidden bg-white border-slate-200">
                  <input value={newTagInput} onChange={e => setNewTagInput(e.target.value)} placeholder="新しいタグ..." className="px-5 py-2 outline-none font-bold" />
                  <button onClick={addTag} className="bg-slate-900 text-white px-6 py-2 font-black">追加</button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <div className="space-y-10">
                <div className="border-b-8 border-slate-900 pb-4">氏名<input value={baseInfo.name} onChange={e=>setBaseInfo({...baseInfo, name:e.target.value})} className="w-full text-7xl font-black bg-transparent outline-none mt-2" /></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[3rem]">性別<input value={baseInfo.gender} onChange={e=>setBaseInfo({...baseInfo, gender:e.target.value})} className="w-full bg-transparent text-3xl font-black" /></div>
                  <div className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[3rem]">年齢<input value={baseInfo.age} onChange={e=>setBaseInfo({...baseInfo, age:e.target.value})} className="w-full bg-transparent text-3xl font-black" /></div>
                </div>
                <div className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[3rem]">住所<input value={baseInfo.address} onChange={e=>setBaseInfo({...baseInfo, address:e.target.value})} className="w-full bg-transparent text-3xl font-black" /></div>
                <div className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[3rem]">電話番号<input value={baseInfo.phone} onChange={e=>setBaseInfo({...baseInfo, phone:e.target.value})} className="w-full bg-transparent text-3xl font-black" /></div>
              </div>
              <div className="space-y-10">
                <div className="p-12 bg-slate-900 text-white rounded-[4.5rem] shadow-2xl"><h4 className="text-blue-400 text-2xl tracking-widest uppercase mb-6 font-black tracking-tighter">なりたい姿 cải thiện</h4><textarea value={baseInfo.goals} onChange={e=>setBaseInfo({...baseInfo, goals:e.target.value})} className="w-full h-80 bg-transparent text-4xl font-serif mt-4 outline-none leading-relaxed" placeholder="..." /></div>
                <div className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[3rem] space-y-6">
                  <div>既往歴<textarea value={baseInfo.history} onChange={e=>setBaseInfo({...baseInfo, history:e.target.value})} className="w-full h-24 bg-transparent text-xl font-black mt-2 outline-none border-b-2 border-slate-200" /></div>
                  <div>手術歴<textarea value={baseInfo.surgery} onChange={e=>setBaseInfo({...baseInfo, surgery:e.target.value})} className="w-full h-24 bg-transparent text-xl font-black mt-2 outline-none border-b-2 border-slate-200" /></div>
                  <div>可動域制限/医師の指示<textarea value={baseInfo.romLimit} onChange={e=>setBaseInfo({...baseInfo, romLimit:e.target.value})} className="w-full h-24 bg-transparent text-xl font-black mt-2 outline-none" /></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}