// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { saveRecord, getRecords } from './actions';

// === ボディマップ用キャンバス（人体図背景付き） ===
const BodyMapCanvas = ({ onSave }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#ef4444'; // 描き込みは「赤」
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
  }, []);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    onSave(canvas.toDataURL());
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSave(null);
  };

  return (
    <div className="relative border-2 border-slate-200 rounded-[2rem] bg-white overflow-hidden shadow-sm aspect-[16/9]">
      {/* 人体図の背景（SVG） */}
      <div className="absolute inset-0 opacity-20 pointer-events-none flex justify-around items-center px-4">
        <img src="https://api.iconify.design/mdi:human-male-height.svg" className="h-4/5" alt="正面" />
        <img src="https://api.iconify.design/mdi:human-handsdown.svg" className="h-4/5 rotate-90" alt="側面" />
        <img src="https://api.iconify.design/mdi:human-male.svg" className="h-4/5" alt="背面" />
      </div>
      <div className="absolute inset-0 flex justify-around items-end pb-2 pointer-events-none text-[10px] font-bold text-slate-400">
        <span>FRONT</span><span>SIDE</span><span>BACK</span>
      </div>
      
      <canvas
        ref={canvasRef}
        width={800}
        height={450}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="w-full h-full cursor-crosshair touch-none relative z-10"
      />
      <button onClick={clear} className="absolute top-4 right-4 bg-white/80 backdrop-blur shadow-sm text-slate-500 px-4 py-2 rounded-full text-xs font-bold z-20">リセット</button>
    </div>
  );
};

export default function Home() {
  const [basicInfo, setBasicInfo] = useState({ 
    name: "", date: "", count: "1", 
    address: "", age: "", phone: "", 
    history: "", surgery: "", romLimit: "", 
    noTouch: "", doctorNote: "", idealState: "" 
  });
  const [examData, setExamData] = useState({
    "肩上": { side: "", score: 3.0 },
    "肩捻じれ": { side: "" }, 
    "肩内旋左": 3.0, "肩内旋右": 3.0,
    "ウエスト・お尻": 3.0, "AS": { side: "", score: 3.0 },
    "大転子": 3.0, "肘比率": 3.0, "肩": 3.0, "耳": 3.0,
    "顔": { side: "", alignment: "", score: 3.0 },
  });
  const [memos, setMemos] = useState({ counseling: "", treatment: "" });
  const [drawingData, setDrawingData] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const load = async () => {
      const data = await getRecords();
      setHistory(data);
    };
    load();
  }, []);

  const calculateDeviation = () => {
    let total = 0;
    const scoreItems = ["肩上", "肩内旋左", "肩内旋右", "ウエスト・お尻", "AS", "大転子", "肘比率", "肩", "耳", "顔"] as const;
    scoreItems.forEach((item) => {
      const data = examData[item];
      total += (typeof data === 'number') ? data : (data.score || 3.0);
    });
    return (45 - (total * 2)) * 2 + 50;
  };

  const updateExamItem = (itemKey, data) => setExamData(prev => ({ ...prev, [itemKey]: data }));

  const ScoreButtons = ({ currentScore, onSelect }) => (
    <div className="grid grid-cols-4 gap-1.5 mt-2">
      {[2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map((num) => (
        <button key={num} onClick={() => onSelect(num)} className={`py-2 rounded-lg font-bold text-[10px] transition-all ${currentScore === num ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>{num.toFixed(1)}</button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-40 font-sans text-slate-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 sticky top-0 z-40">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800">mabune Core</h1>
            <p className="text-[10px] text-blue-600 font-bold tracking-widest uppercase">RE:SET Chart System</p>
          </div>
          <input type="text" placeholder="お名前" className="border-b-2 border-blue-500 outline-none px-2 text-right w-32 text-lg font-bold bg-transparent" value={basicInfo.name} onChange={(e) => setBasicInfo({...basicInfo, name: e.target.value})} />
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-12">
        {/* 問診 */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xs font-black text-slate-400 tracking-[0.3em] uppercase">01. Intake Form</h2>
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="年齢" className="p-3 bg-slate-50 rounded-xl text-sm" value={basicInfo.age} onChange={e => setBasicInfo({...basicInfo, age: e.target.value})} />
              <input type="text" placeholder="電話番号" className="p-3 bg-slate-50 rounded-xl text-sm" value={basicInfo.phone} onChange={e => setBasicInfo({...basicInfo, phone: e.target.value})} />
            </div>
            <textarea placeholder="既往歴・手術歴・禁止事項" className="w-full p-3 bg-slate-50 rounded-xl text-sm h-24" value={basicInfo.history} onChange={e => setBasicInfo({...basicInfo, history: e.target.value})} />
            <div className="p-5 bg-blue-50 rounded-[1.5rem] border border-blue-100">
              <label className="text-[10px] font-bold text-blue-500 uppercase block mb-2 tracking-tighter">My Vision: 本来のあなた、ありたい姿</label>
              <textarea className="w-full bg-transparent outline-none text-sm text-blue-900 placeholder:text-blue-300 h-20" value={basicInfo.idealState} onChange={e => setBasicInfo({...basicInfo, idealState: e.target.value})} />
            </div>
          </div>
        </section>

        {/* ボディマップ */}
        <section className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-[0.3em] uppercase">02. Body Map</h2>
          <BodyMapCanvas onSave={setDrawingData} />
        </section>

        {/* スコア入力 */}
        <section className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-[0.3em] uppercase">03. Measurement</h2>
          <div className="grid gap-3">
            {Object.keys(examData).map(key => (
              <div key={key} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                <span className="font-bold text-slate-700 text-xs mb-1">{key}</span>
                {typeof examData[key] === 'number' ? (
                  <ScoreButtons currentScore={examData[key]} onSelect={(val) => updateExamItem(key, val)} />
                ) : (
                  <ScoreButtons currentScore={examData[key].score} onSelect={(val) => updateExamItem(key, { ...examData[key], score: val })} />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ノート・画像 */}
        <section className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-[0.3em] uppercase">04. Session Notes</h2>
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <div>
              <label className="text-[10px] font-bold text-slate-400 mb-2 block uppercase">セルフケア指導等</label>
              <textarea className="w-full p-4 bg-slate-50 rounded-2xl text-sm h-32" value={memos.counseling} onChange={e => setMemos({...memos, counseling: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 mb-2 block uppercase">施術内容メモ</label>
              <textarea className="w-full p-4 bg-slate-50 rounded-2xl text-sm h-32" value={memos.treatment} onChange={e => setMemos({...memos, treatment: e.target.value})} />
            </div>
            <div className="pt-4 border-t border-slate-100">
              <label className="text-[10px] font-bold text-slate-400 mb-4 block uppercase">Photo Records (Before / After)</label>
              <div className="grid grid-cols-4 gap-2">
                {[1,2,3,4].map(i => <div key={i} className="aspect-square bg-slate-50 rounded-xl flex items-center justify-center text-[10px] text-slate-300 border border-dashed border-slate-200">B-{i}</div>)}
                {[1,2,3,4].map(i => <div key={i} className="aspect-square bg-blue-50/30 rounded-xl flex items-center justify-center text-[10px] text-blue-300 border border-dashed border-blue-100">A-{i}</div>)}
              </div>
            </div>
          </div>
        </section>

        {/* 施術履歴（全項目復旧版） */}
        <section className="pb-20 space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-[0.3em] uppercase">05. Clinical Archive</h2>
          <div className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 text-[10px] font-bold text-slate-500">日時/名前</th>
                    <th className="p-2 text-[10px] font-bold text-blue-600">肩上</th>
                    <th className="p-2 text-[10px] font-bold text-blue-500">内旋L</th>
                    <th className="p-2 text-[10px] font-bold text-blue-500">内旋R</th>
                    <th className="p-2 text-[10px] font-bold text-green-600">ｳｴｽﾄ</th>
                    <th className="p-2 text-[10px] font-bold text-purple-600">AS</th>
                    <th className="p-2 text-[10px] font-bold text-slate-500">大転子</th>
                    <th className="p-2 text-[10px] font-bold text-slate-500">肘比</th>
                    <th className="p-2 text-[10px] font-bold text-slate-500">肩/耳</th>
                    <th className="p-2 text-[10px] font-bold text-pink-600">顔</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((rec) => (
                    <tr key={rec.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                      <td className="p-4">
                        <div className="text-[9px] text-slate-400">{new Date(rec.date).toLocaleDateString()}</div>
                        <div className="font-bold text-xs">{rec.patient?.name}</div>
                      </td>
                      <td className="p-2 font-mono text-xs text-blue-600 font-bold">{rec.scoreShoulderUp?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-blue-500">{rec.scoreShoulderInL?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-blue-500">{rec.scoreShoulderInR?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-green-600 font-bold">{rec.scoreWaistHip?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-purple-600 font-bold">{rec.scoreAS?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-slate-500">{rec.scoreGreaterTro?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-slate-500">{rec.scoreElbowRatio?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-[10px] text-slate-400">{rec.scoreShoulder?.toFixed(1)}/{rec.scoreEar?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-pink-600 font-bold">{rec.scoreFace?.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="p-4 text-[9px] text-slate-400 text-center italic tracking-tight">※ 表を左右にスライドして全項目を確認できます</p>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-8 shadow-2xl rounded-t-[3rem] z-50">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-1">RESET Deviation</p>
            <p className="text-4xl font-black text-blue-400 tracking-tighter">{calculateDeviation().toFixed(1)}</p>
          </div>
          <button 
            onClick={async () => {
              const res = await saveRecord({ ...basicInfo, examData, counselingMemo: memos.counseling, treatmentMemo: memos.treatment, drawingData, count: basicInfo.count });
              if (res.success) {
                alert("金庫に保存し、履歴を更新しました。");
                const newData = await getRecords(); setHistory(newData);
              }
            }}
            className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-2xl font-bold shadow-lg transition-all active:scale-95"
          >
            記録を保存
          </button>
        </div>
      </footer>
    </div>
  );
}