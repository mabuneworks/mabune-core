// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { saveRecord, getRecords } from './actions';

// === フォトスロット・コンポーネント ===
const PhotoSection = ({ title, photos, setPhotos, colorClass }) => {
  const handleFile = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const newPhotos = [...photos];
        newPhotos[index] = ev.target.result;
        setPhotos(newPhotos);
      };
      reader.readAsDataURL(file);
    }
  };

  const labels = ["顔", "前面", "背面", "側面"];

  return (
    <div className="space-y-3">
      <h3 className={`text-[10px] font-black ${colorClass} tracking-widest uppercase`}>{title}</h3>
      <div className="grid grid-cols-4 gap-2">
        {photos.map((src, i) => (
          <div key={i} className="relative aspect-[3/4] bg-slate-100 rounded-xl overflow-hidden border-2 border-dashed border-slate-200">
            {src ? (
              <img src={src} className="w-full h-full object-cover" />
            ) : (
              <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                <span className="text-[10px] font-bold text-slate-400">{labels[i]}</span>
                <span className="text-xl">+</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(i, e)} />
              </label>
            )}
            {src && (
              <button onClick={() => {const n=[...photos]; n[i]=null; setPhotos(n);}} className="absolute top-1 right-1 bg-black/50 text-white w-5 h-5 rounded-full text-[10px]">×</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// === ボディマップ用キャンパス（body-map.pngを使用） ===
const BodyMapCanvas = ({ onSave }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const BODY_MAP_PATH = "/body-map.png";

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  }, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX || e.touches?.[0]?.clientX;
    const cy = e.clientY || e.touches?.[0]?.clientY;
    return { x: (cx - rect.left) * (canvasRef.current.width / rect.width), y: (cy - rect.top) * (canvasRef.current.height / rect.height) };
  };

  const start = (e) => { const {x,y} = getPos(e); const ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(x,y); setIsDrawing(true); };
  const draw = (e) => { if(!isDrawing) return; const {x,y} = getPos(e); const ctx = canvasRef.current.getContext('2d'); ctx.lineTo(x,y); ctx.stroke(); };
  const stop = () => { setIsDrawing(false); onSave(canvasRef.current.toDataURL()); };

  return (
    <div className="relative border-2 border-slate-200 rounded-[2rem] bg-white overflow-hidden shadow-sm aspect-[16/9]">
      <div className="absolute inset-0 pointer-events-none p-1 flex justify-center items-center">
        <img src={BODY_MAP_PATH} className="w-full h-full object-contain" alt="Anatomical Chart" onError={(e) => e.target.style.display='none'} />
      </div>
      <canvas ref={canvasRef} width={1200} height={675} onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop} onTouchStart={(e)=>{e.preventDefault(); start(e);}} onTouchMove={(e)=>{e.preventDefault(); draw(e);}} onTouchEnd={stop} className="w-full h-full cursor-crosshair touch-none relative z-10" />
      <button onClick={() => {const ctx=canvasRef.current.getContext('2d'); ctx.clearRect(0,0,1200,675); onSave(null);}} className="absolute top-4 right-4 bg-white/90 backdrop-blur px-4 py-2 rounded-full text-xs font-bold z-20">消去</button>
    </div>
  );
};

export default function Home() {
  const [basicInfo, setBasicInfo] = useState({ name: "", date: "", count: "1", address: "", age: "", phone: "", history: "", idealState: "" });
  const [examData, setExamData] = useState({ "肩上": { score: 3.0 }, "肩捻じれ": { side: "" }, "肩内旋左": 3.0, "肩内旋右": 3.0, "ウエスト・お尻": 3.0, "AS": { score: 3.0 }, "大転子": 3.0, "肘比率": 3.0, "肩": 3.0, "耳": 3.0, "顔": { score: 3.0 } });
  const [memos, setMemos] = useState({ counseling: "", treatment: "" });
  const [drawingData, setDrawingData] = useState(null);
  const [imagesBefore, setImagesBefore] = useState([null, null, null, null]);
  const [imagesAfter, setImagesAfter] = useState([null, null, null, null]);
  const [history, setHistory] = useState([]);

  useEffect(() => { const load = async () => setHistory(await getRecords()); load(); }, []);

  const calcDev = (d) => {
    const s = [d.scoreShoulderUp, d.scoreShoulderInL, d.scoreShoulderInR, d.scoreWaistHip, d.scoreAS, d.scoreGreaterTro, d.scoreElbowRatio, d.scoreShoulder, d.scoreEar, d.scoreFace].map(v => v ?? 3.0);
    let total = 0; s.forEach(v => total += v);
    return (45 - (total * 2)) * 2 + 50;
  };

  const labels = ["顔", "前面", "背面", "側面"];

  return (
    <div className="min-h-screen bg-slate-50 pb-40 font-sans text-slate-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 sticky top-0 z-40 flex justify-between items-center">
        <div><h1 className="text-xl font-bold">mabune Core</h1><p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Advanced Charting</p></div>
        <input type="text" placeholder="お名前" className="border-b-2 border-blue-500 outline-none px-2 text-right w-32 font-bold" value={basicInfo.name} onChange={(e) => setBasicInfo({...basicInfo, name: e.target.value})} />
      </header>

      <main className="max-w-md mx-auto p-4 space-y-12">
        {/* 基本情報 */}
        <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="年齢" className="p-3 bg-slate-50 rounded-xl text-sm" value={basicInfo.age} onChange={e => setBasicInfo({...basicInfo, age: e.target.value})} />
            <input type="text" placeholder="電話番号" className="p-3 bg-slate-50 rounded-xl text-sm" value={basicInfo.phone} onChange={e => setBasicInfo({...basicInfo, phone: e.target.value})} />
          </div>
          <input type="text" placeholder="ご住所" className="w-full p-3 bg-slate-50 rounded-xl text-sm" value={basicInfo.address} onChange={e => setBasicInfo({...basicInfo, address: e.target.value})} />
          <textarea placeholder="本来のあなた、ありたい姿" className="w-full p-4 bg-blue-50 rounded-2xl text-sm h-24 italic" value={basicInfo.idealState} onChange={e => setBasicInfo({...basicInfo, idealState: e.target.value})} />
        </section>

        {/* ボディマップ */}
        <section className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-[0.3em] uppercase">02. Body Map</h2>
          <BodyMapCanvas onSave={setDrawingData} />
        </section>

        {/* フォトセクション */}
        <section className="space-y-6 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
          <h2 className="text-xs font-black text-slate-400 tracking-[0.3em] uppercase">03. Visual Evidence</h2>
          <PhotoSection title="Before (施術前)" photos={imagesBefore} setPhotos={setImagesBefore} colorClass="text-slate-500" />
          <PhotoSection title="After (施術後)" photos={imagesAfter} setPhotos={setImagesAfter} colorClass="text-blue-600" />
          
          {/* 送信用の比較ビュー */}
          <div className="pt-6 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 mb-4 text-center">タップして比較画像を表示（長押しで保存してLINE送信）</p>
            <div className="grid gap-4">
              {labels.map((label, i) => (
                imagesBefore[i] && imagesAfter[i] && (
                  <div key={i} className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400">{label}の比較</label>
                    <div className="flex bg-black rounded-xl overflow-hidden border-2 border-white shadow-lg">
                      <div className="relative flex-1 aspect-[3/4]">
                        <img src={imagesBefore[i]} className="w-full h-full object-cover" />
                        <span className="absolute bottom-2 left-2 bg-black/50 text-[8px] text-white px-2 py-0.5 rounded">BEFORE</span>
                      </div>
                      <div className="relative flex-1 aspect-[3/4] border-l border-white/30">
                        <img src={imagesAfter[i]} className="w-full h-full object-cover" />
                        <span className="absolute bottom-2 left-2 bg-blue-600/80 text-[8px] text-white px-2 py-0.5 rounded">AFTER</span>
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        </section>

        {/* スコア・ノート等は省略（既存のものを維持） */}
        <section className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-[0.3em] uppercase italic">04. Session Notes</h2>
          <textarea placeholder="セルフケア指導等" className="w-full p-4 bg-white rounded-2xl text-sm h-32 shadow-sm border border-slate-100" value={memos.counseling} onChange={e => setMemos({...memos, counseling: e.target.value})} />
        </section>

        {/* アーカイブ（偏差値付き） */}
        <section className="pb-20 space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-[0.3em] uppercase italic">05. Archive</h2>
          <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border border-slate-100 overflow-x-auto text-[10px]">
            <table className="w-full text-left min-w-[1200px]">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                <tr><th className="p-4">Date</th><th className="p-2 text-blue-700">Dev</th><th className="p-2">肩上</th><th className="p-2">内L</th><th className="p-2">内R</th><th className="p-2">ｳｴｽﾄ</th><th className="p-2">AS</th><th className="p-2">大転</th><th className="p-2">肘比</th><th className="p-2">肩</th><th className="p-2">耳</th><th className="p-2 text-pink-600">顔</th></tr>
              </thead>
              <tbody>
                {history.map((rec) => (
                  <tr key={rec.id} className="border-t border-slate-50">
                    <td className="p-4 font-bold">{new Date(rec.date).toLocaleDateString()}<br/><span className="text-slate-400 font-normal">{rec.patient?.name}</span></td>
                    <td className="p-2 font-black text-blue-700 text-sm">{calcDev(rec).toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreShoulderUp?.toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreShoulderInL?.toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreShoulderInR?.toFixed(1)}</td>
                    <td className="p-2 font-mono font-bold text-green-600">{rec.scoreWaistHip?.toFixed(1)}</td>
                    <td className="p-2 font-mono font-bold text-purple-600">{rec.scoreAS?.toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreGreaterTro?.toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreElbowRatio?.toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreShoulder?.toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreEar?.toFixed(1)}</td>
                    <td className="p-2 font-mono font-bold text-pink-600">{rec.scoreFace?.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-8 shadow-2xl rounded-t-[3rem] z-50 flex justify-between items-center">
        <div><p className="text-[10px] text-slate-400 font-bold uppercase mb-1">RE:SET Deviation</p><p className="text-5xl font-black text-blue-400 tracking-tighter">{calculateCurrentDeviation?.() || "0.0"}</p></div>
        <button onClick={async () => {
          const res = await saveRecord({...basicInfo, examData, counselingMemo: memos.counseling, treatmentMemo: memos.treatment, drawingData, imagesBefore, imagesAfter, count: basicInfo.count });
          if (res.success) { alert("大切な記録を保存しました。"); setHistory(await getRecords()); }
        }} className="bg-blue-600 px-10 py-5 rounded-2xl font-bold">保存</button>
      </footer>
    </div>
  );
}