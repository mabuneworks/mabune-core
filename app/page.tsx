// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { saveRecord, getRecords } from './actions';

// === フォトセクション（カメラ即起動対応） ===
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
            {src ? <img src={src} className="w-full h-full object-cover" /> : (
              <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                <span className="text-[8px] font-bold text-slate-400">{labels[i]}</span>
                <span className="text-lg text-slate-300">+</span>
                {/* capture="environment" を追加：スマホでカメラが優先起動します */}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(i, e)} />
              </label>
            )}
            {src && <button onClick={() => {const n=[...photos]; n[i]=null; setPhotos(n);}} className="absolute top-1 right-1 bg-black/50 text-white w-5 h-5 rounded-full text-[10px]">×</button>}
          </div>
        ))}
      </div>
    </div>
  );
};

// === ボディマップ（body-map.pngを使用） ===
const BodyMapCanvas = ({ onSave }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if(ctx) { ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 3; ctx.lineCap = 'round'; }
  }, []);
  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX || e.touches?.[0]?.clientX;
    const cy = e.clientY || e.touches?.[0]?.clientY;
    return { x: (cx - rect.left) * (canvasRef.current.width / rect.width), y: (cy - rect.top) * (canvasRef.current.height / rect.height) };
  };
  return (
    <div className="relative border-2 border-slate-200 rounded-[2rem] bg-white overflow-hidden aspect-[16/9] shadow-sm">
      <div className="absolute inset-0 pointer-events-none p-1 flex justify-center items-center">
        <img src="/body-map.png" className="w-full h-full object-contain opacity-80" alt="Chart" />
      </div>
      <canvas ref={canvasRef} width={1200} height={675} 
        onMouseDown={(e)=>{const {x,y}=getPos(e); canvasRef.current.getContext('2d').beginPath(); canvasRef.current.getContext('2d').moveTo(x,y); setIsDrawing(true);}}
        onMouseMove={(e)=>{if(!isDrawing)return; const {x,y}=getPos(e); canvasRef.current.getContext('2d').lineTo(x,y); canvasRef.current.getContext('2d').stroke();}}
        onMouseUp={()=>{setIsDrawing(false); onSave(canvasRef.current.toDataURL());}}
        onTouchStart={(e)=>{e.preventDefault(); const {x,y}=getPos(e); canvasRef.current.getContext('2d').beginPath(); canvasRef.current.getContext('2d').moveTo(x,y); setIsDrawing(true);}}
        onTouchMove={(e)=>{e.preventDefault(); if(!isDrawing)return; const {x,y}=getPos(e); canvasRef.current.getContext('2d').lineTo(x,y); canvasRef.current.getContext('2d').stroke();}}
        onTouchEnd={()=>{setIsDrawing(false); onSave(canvasRef.current.toDataURL());}}
        className="w-full h-full cursor-crosshair touch-none relative z-10" />
      <button onClick={() => {canvasRef.current.getContext('2d').clearRect(0,0,1200,675); onSave(null);}} className="absolute top-4 right-4 bg-white/90 text-[10px] font-bold px-3 py-1 rounded-full z-20">リセット</button>
    </div>
  );
};

export default function Home() {
  const [basicInfo, setBasicInfo] = useState({ name: "", date: "", count: "1", address: "", age: "", phone: "", history: "", surgery: "", romLimit: "", noTouch: "", doctorNote: "", idealState: "" });
  const [examData, setExamData] = useState({ "肩上": { score: 3.0 }, "肩捻じれ": { side: "" }, "肩内旋左": 3.0, "肩内旋右": 3.0, "ウエスト・お尻": 3.0, "AS": { score: 3.0 }, "大転子": 3.0, "肘比率": 3.0, "肩": 3.0, "耳": 3.0, "顔": { score: 3.0 } });
  const [memos, setMemos] = useState({ counseling: "", treatment: "" });
  const [drawingData, setDrawingData] = useState(null);
  const [imagesBefore, setImagesBefore] = useState([null, null, null, null]);
  const [imagesAfter, setImagesAfter] = useState([null, null, null, null]);
  const [history, setHistory] = useState([]);

  useEffect(() => { const load = async () => setHistory(await getRecords()); load(); }, []);

  const calcDev = (d) => {
    if (!d) return 50.0;
    const s = [d.scoreShoulderUp, d.scoreShoulderInL, d.scoreShoulderInR, d.scoreWaistHip, d.scoreAS, d.scoreGreaterTro, d.scoreElbowRatio, d.scoreShoulder, d.scoreEar, d.scoreFace].map(v => typeof v === 'number' ? v : 3.0);
    let total = 0; s.forEach(v => total += v);
    return (45 - (total * 2)) * 2 + 50;
  };

  // 比較画像を1枚の画像としてダウンロードする機能
  const downloadComparison = (before, after, label) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const imgB = new Image();
    const imgA = new Image();
    imgB.src = before;
    imgA.src = after;
    imgB.onload = () => {
      canvas.width = 1200; canvas.height = 800; // 横並びのサイズ
      ctx.fillStyle = "black"; ctx.fillRect(0, 0, 1200, 800);
      ctx.drawImage(imgB, 0, 0, 600, 800);
      ctx.drawImage(imgA, 600, 0, 600, 800);
      // ラベル追加
      ctx.fillStyle = "white"; ctx.font = "bold 30px Arial";
      ctx.fillText("BEFORE", 20, 780); ctx.fillText("AFTER", 620, 780);
      ctx.fillText(label, 500, 50);
      
      const link = document.createElement("a");
      link.download = `mabune_${label}_compare.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-40 font-sans text-slate-900">
      <header className="bg-white/80 backdrop-blur-md border-b p-4 sticky top-0 z-40 flex justify-between items-center">
        <div><h1 className="text-xl font-bold">mabune Core</h1><p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest italic">mabune beauty & care</p></div>
        <input type="text" placeholder="氏名" className="border-b-2 border-blue-500 outline-none px-2 text-right w-32 font-bold bg-transparent" value={basicInfo.name} onChange={(e) => setBasicInfo({...basicInfo, name: e.target.value})} />
      </header>

      <main className="max-w-md mx-auto p-4 space-y-10">
        {/* 問診票 */}
        <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border space-y-4">
          <h2 className="text-[10px] font-black text-slate-400 tracking-widest uppercase italic">01. Intake Form</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <input type="text" placeholder="年齢" className="p-3 bg-slate-50 rounded-xl" value={basicInfo.age} onChange={e => setBasicInfo({...basicInfo, age: e.target.value})} />
            <input type="text" placeholder="電話番号" className="p-3 bg-slate-50 rounded-xl" value={basicInfo.phone} onChange={e => setBasicInfo({...basicInfo, phone: e.target.value})} />
          </div>
          <input type="text" placeholder="ご住所" className="w-full p-3 bg-slate-50 rounded-xl text-sm" value={basicInfo.address} onChange={e => setBasicInfo({...basicInfo, address: e.target.value})} />
          <textarea placeholder="本来の自分、ありたい姿" className="w-full p-4 bg-blue-50/50 rounded-2xl text-sm h-24 italic" value={basicInfo.idealState} onChange={e => setBasicInfo({...basicInfo, idealState: e.target.value})} />
        </section>

        {/* ボディマップ */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-black text-slate-400 tracking-widest uppercase italic">02. Body Map</h2>
          <BodyMapCanvas onSave={setDrawingData} />
        </section>

        {/* 撮影・比較 */}
        <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border space-y-6">
          <h2 className="text-[10px] font-black text-slate-400 tracking-widest uppercase italic">03. Visual Records</h2>
          <PhotoSection title="Before (施術前)" photos={imagesBefore} setPhotos={setImagesBefore} colorClass="text-slate-400" />
          <PhotoSection title="After (施術後)" photos={imagesAfter} setPhotos={setImagesAfter} colorClass="text-blue-600" />
          
          <div className="pt-6 border-t space-y-6">
            {["顔", "前面", "背面", "側面"].map((label, i) => imagesBefore[i] && imagesAfter[i] && (
              <div key={i} className="space-y-2">
                <div className="flex bg-black rounded-2xl overflow-hidden border-4 border-white shadow-lg aspect-[3/2]">
                  <div className="relative flex-1"><img src={imagesBefore[i]} className="w-full h-full object-cover" /></div>
                  <div className="relative flex-1 border-l border-white/20"><img src={imagesAfter[i]} className="w-full h-full object-cover" /></div>
                </div>
                <button 
                  onClick={() => downloadComparison(imagesBefore[i], imagesAfter[i], label)}
                  className="w-full py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-bold"
                >
                  {label}の比較画像を保存してLINEで送る
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* 測定スコア */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-black text-slate-400 tracking-widest uppercase italic">04. Measurement</h2>
          <div className="grid gap-3">
            {Object.keys(examData).map(key => (
              <div key={key} className="bg-white p-5 rounded-2xl border shadow-sm">
                <span className="font-bold text-slate-700 text-xs mb-2 block">{key}</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map(n => {
                    const curr = typeof examData[key] === 'number' ? examData[key] : examData[key].score;
                    return (
                      <button key={n} onClick={() => setExamData({...examData, [key]: typeof examData[key]==='number' ? n : {...examData[key], score: n}})} 
                        className={`py-2 rounded-lg font-bold text-[10px] transition-all ${curr===n?'bg-blue-600 text-white shadow-md':'bg-slate-100 text-slate-500'}`}>{n.toFixed(1)}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* メモ */}
        <section className="space-y-4 pb-20">
          <h2 className="text-[10px] font-black text-slate-400 tracking-widest uppercase italic">05. Session Notes</h2>
          <textarea placeholder="セルフケア指導等" className="w-full p-5 bg-white rounded-[2rem] text-sm h-32 shadow-sm border outline-none" value={memos.counseling} onChange={e => setMemos({...memos, counseling: e.target.value})} />
          
          {/* アーカイブテーブル（省略：前回のものを維持） */}
        </section>
      </main>

      {/* フッター */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-8 shadow-2xl rounded-t-[3rem] z-50 flex justify-between items-center">
        <div><p className="text-[10px] text-slate-400 font-bold uppercase mb-1 tracking-widest">RE:SET Deviation</p><p className="text-5xl font-black text-blue-400 tracking-tighter">
          {calcDev({
            scoreShoulderUp: examData["肩上"]?.score, scoreShoulderInL: examData["肩内旋左"], scoreShoulderInR: examData["肩内旋右"], scoreWaistHip: examData["ウエスト・お尻"],
            scoreAS: examData["AS"]?.score, scoreGreaterTro: examData["大転子"], scoreElbowRatio: examData["肘比率"], scoreShoulder: examData["肩"], scoreEar: examData["耳"], scoreFace: examData["顔"]?.score
          }).toFixed(1)}
        </p></div>
        <button onClick={async () => {
          const res = await saveRecord({ ...basicInfo, examData, counselingMemo: memos.counseling, drawingData, imagesBefore, imagesAfter, count: basicInfo.count });
          if (res.success) { alert("大切な記録を保存しました。"); setHistory(await getRecords()); }
        }} className="bg-blue-600 px-10 py-5 rounded-2xl font-bold shadow-lg active:scale-95 transition-all">保存</button>
      </footer>
    </div>
  );
}