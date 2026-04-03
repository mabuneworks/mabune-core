// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { saveRecord, getRecords } from './actions';

// === フォトセクション ===
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
                <span className="text-lg">+</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(i, e)} />
              </label>
            )}
            {src && <button onClick={() => {const n=[...photos]; n[i]=null; setPhotos(n);}} className="absolute top-1 right-1 bg-black/50 text-white w-4 h-4 rounded-full text-[8px]">×</button>}
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
        <img src="/body-map.png" className="w-full h-full object-contain" alt="Chart" />
      </div>
      <canvas ref={canvasRef} width={1200} height={675} 
        onMouseDown={(e)=>{const {x,y}=getPos(e); canvasRef.current.getContext('2d').beginPath(); canvasRef.current.getContext('2d').moveTo(x,y); setIsDrawing(true);}}
        onMouseMove={(e)=>{if(!isDrawing)return; const {x,y}=getPos(e); canvasRef.current.getContext('2d').lineTo(x,y); canvasRef.current.getContext('2d').stroke();}}
        onMouseUp={()=>{setIsDrawing(false); onSave(canvasRef.current.toDataURL());}}
        onTouchStart={(e)=>{e.preventDefault(); const {x,y}=getPos(e); canvasRef.current.getContext('2d').beginPath(); canvasRef.current.getContext('2d').moveTo(x,y); setIsDrawing(true);}}
        onTouchMove={(e)=>{e.preventDefault(); if(!isDrawing)return; const {x,y}=getPos(e); canvasRef.current.getContext('2d').lineTo(x,y); canvasRef.current.getContext('2d').stroke();}}
        onTouchEnd={()=>{setIsDrawing(false); onSave(canvasRef.current.toDataURL());}}
        className="w-full h-full cursor-crosshair touch-none relative z-10" />
      <button onClick={() => {canvasRef.current.getContext('2d').clearRect(0,0,1200,675); onSave(null);}} className="absolute top-4 right-4 bg-white/90 text-[10px] font-bold px-3 py-1 rounded-full z-20">消去</button>
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

  return (
    <div className="min-h-screen bg-slate-50 pb-40 font-sans text-slate-900">
      <header className="bg-white/80 backdrop-blur-md border-b p-4 sticky top-0 z-40 flex justify-between items-center">
        <div><h1 className="text-xl font-bold">mabune Core</h1><p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">RESET Chart</p></div>
        <input type="text" placeholder="お名前" className="border-b-2 border-blue-500 outline-none px-2 text-right w-32 font-bold bg-transparent" value={basicInfo.name} onChange={(e) => setBasicInfo({...basicInfo, name: e.target.value})} />
      </header>

      <main className="max-w-md mx-auto p-4 space-y-12">
        {/* 01. Intake */}
        <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-widest uppercase italic">01. Intake Form</h2>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="年齢" className="p-3 bg-slate-50 rounded-xl text-sm" value={basicInfo.age} onChange={e => setBasicInfo({...basicInfo, age: e.target.value})} />
            <input type="text" placeholder="電話番号" className="p-3 bg-slate-50 rounded-xl text-sm" value={basicInfo.phone} onChange={e => setBasicInfo({...basicInfo, phone: e.target.value})} />
          </div>
          <input type="text" placeholder="ご住所" className="w-full p-3 bg-slate-50 rounded-xl text-sm" value={basicInfo.address} onChange={e => setBasicInfo({...basicInfo, address: e.target.value})} />
          <textarea placeholder="既往歴・手術歴・禁止事項" className="w-full p-3 bg-slate-50 rounded-xl text-sm h-24" value={basicInfo.history} onChange={e => setBasicInfo({...basicInfo, history: e.target.value})} />
          <div className="p-5 bg-blue-50 rounded-[1.5rem] border border-blue-100 italic">
            <label className="text-[10px] font-bold text-blue-500 block mb-1">My Vision</label>
            <textarea className="w-full bg-transparent outline-none text-sm h-20 text-blue-900" placeholder="本来の自分、ありたい姿" value={basicInfo.idealState} onChange={e => setBasicInfo({...basicInfo, idealState: e.target.value})} />
          </div>
        </section>

        {/* 02. Body Map */}
        <section className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-widest uppercase italic">02. Body Map</h2>
          <BodyMapCanvas onSave={setDrawingData} />
        </section>

        {/* 03. Photos */}
        <section className="bg-white p-7 rounded-[2.5rem] shadow-sm border space-y-6">
          <h2 className="text-xs font-black text-slate-400 tracking-widest uppercase italic">03. Visual Records</h2>
          <PhotoSection title="Before" photos={imagesBefore} setPhotos={setImagesBefore} colorClass="text-slate-400" />
          <PhotoSection title="After" photos={imagesAfter} setPhotos={setImagesAfter} colorClass="text-blue-600" />
          <div className="pt-4 border-t space-y-4">
            {["顔", "前面", "背面", "側面"].map((label, i) => imagesBefore[i] && imagesAfter[i] && (
              <div key={i} className="flex bg-black rounded-2xl overflow-hidden border-4 border-white shadow-xl aspect-[3/2]">
                <div className="relative flex-1"><img src={imagesBefore[i]} className="w-full h-full object-cover" /><span className="absolute bottom-1 left-2 text-[8px] text-white bg-black/50 px-1 uppercase">Before</span></div>
                <div className="relative flex-1 border-l border-white/20"><img src={imagesAfter[i]} className="w-full h-full object-cover" /><span className="absolute bottom-1 left-2 text-[8px] text-white bg-blue-600/80 px-1 uppercase">After</span></div>
              </div>
            ))}
            <p className="text-[9px] text-slate-400 text-center">※比較画像を長押しで保存して患者様に送信できます</p>
          </div>
        </section>

        {/* 04. Measurement */}
        <section className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-widest uppercase italic">04. Measurement</h2>
          <div className="grid gap-3">
            {Object.keys(examData).map(key => (
              <div key={key} className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col">
                <span className="font-bold text-slate-700 text-xs mb-2">{key}</span>
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

        {/* 05. Notes & Archive */}
        <section className="space-y-4 pb-20">
          <h2 className="text-xs font-black text-slate-400 tracking-widest uppercase italic">05. Session Notes & Archive</h2>
          <textarea placeholder="セルフケア指導等" className="w-full p-5 bg-white rounded-[2rem] text-sm h-32 shadow-sm border" value={memos.counseling} onChange={e => setMemos({...memos, counseling: e.target.value})} />
          
          <div className="bg-white rounded-[2rem] overflow-hidden shadow-sm border overflow-x-auto">
            <table className="w-full text-left text-[10px] min-w-[1200px]">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                <tr><th className="p-4">Date/Name</th><th className="p-2 text-blue-700">Dev</th><th className="p-2">肩上</th><th className="p-2">内L</th><th className="p-2">内R</th><th className="p-2">ｳｴｽﾄ</th><th className="p-2">AS</th><th className="p-2">大転</th><th className="p-2">肘比</th><th className="p-2">肩</th><th className="p-2">耳</th><th className="p-2 text-pink-600">顔</th></tr>
              </thead>
              <tbody>
                {history.map(rec => (
                  <tr key={rec.id} className="border-t border-slate-50">
                    <td className="p-4"><b>{new Date(rec.date).toLocaleDateString()}</b><br/>{rec.patient?.name}</td>
                    <td className="p-2 font-black text-blue-700 text-sm">{calcDev(rec).toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreShoulderUp?.toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreShoulderInL?.toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreShoulderInR?.toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreWaistHip?.toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreAS?.toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreGreaterTro?.toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreElbowRatio?.toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreShoulder?.toFixed(1)}</td>
                    <td className="p-2 font-mono">{rec.scoreEar?.toFixed(1)}</td>
                    <td className="p-2 font-mono text-pink-600 font-bold">{rec.scoreFace?.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-8 shadow-2xl rounded-t-[3rem] z-50 flex justify-between items-center">
        <div><p className="text-[10px] text-slate-400 font-bold uppercase mb-1">RE:SET Deviation</p><p className="text-5xl font-black text-blue-400 tracking-tighter">
          {calcDev({
            scoreShoulderUp: examData["肩上"]?.score, scoreShoulderInL: examData["肩内旋左"], scoreShoulderInR: examData["肩内旋右"], scoreWaistHip: examData["ウエスト・お尻"],
            scoreAS: examData["AS"]?.score, scoreGreaterTro: examData["大転子"], scoreElbowRatio: examData["肘比率"], scoreShoulder: examData["肩"], scoreEar: examData["耳"], scoreFace: examData["顔"]?.score
          }).toFixed(1)}
        </p></div>
        <button onClick={async () => {
          const res = await saveRecord({ ...basicInfo, examData, counselingMemo: memos.counseling, drawingData, imagesBefore, imagesAfter });
          if (res.success) { alert("大切な記録を保存しました。"); setHistory(await getRecords()); }
        }} className="bg-blue-600 hover:bg-blue-500 px-10 py-5 rounded-2xl font-bold shadow-lg transition-all active:scale-95">記録を保存</button>
      </footer>
    </div>
  );
}