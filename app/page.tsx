// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { saveRecord, getRecords } from './actions';

// === ボディマップ用キャンバス（新・骨格人体図背景付き） ===
const BodyMapCanvas = ({ onSave }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#ff0000'; 
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
  }, []);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
    const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX || e.touches?.[0]?.clientX) - rect.left) * (canvas.width / rect.width);
    const y = ((e.clientY || e.touches?.[0]?.clientY) - rect.top) * (canvas.height / rect.height);
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
      <div className="absolute inset-0 pointer-events-none p-2 flex justify-center items-center">
        <img 
          src="https://r.jina.ai/i/6f937d53086940be8766107380436892" 
          className="w-full h-full object-contain opacity-90" 
          alt="Anatomical Chart" 
        />
      </div>
      <canvas
        ref={canvasRef}
        width={1200}
        height={675}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="w-full h-full cursor-crosshair touch-none relative z-10"
      />
      <button onClick={clear} className="absolute top-4 right-4 bg-white/90 backdrop-blur shadow-sm text-slate-500 px-4 py-2 rounded-full text-xs font-bold z-20 hover:bg-red-50 hover:text-red-500 transition-colors">リセット</button>
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

  // 偏差値計算ロジック
  const calcDev = (dataMap) => {
    let total = 0;
    const scores = [
      dataMap.scoreShoulderUp ?? 3.0,
      dataMap.scoreShoulderInL ?? 3.0,
      dataMap.scoreShoulderInR ?? 3.0,
      dataMap.scoreWaistHip ?? 3.0,
      dataMap.scoreAS ?? 3.0,
      dataMap.scoreGreaterTro ?? 3.0,
      dataMap.scoreElbowRatio ?? 3.0,
      dataMap.scoreShoulder ?? 3.0,
      dataMap.scoreEar ?? 3.0,
      dataMap.scoreFace ?? 3.0
    ];
    scores.forEach(s => total += s);
    return (45 - (total * 2)) * 2 + 50;
  };

  const calculateCurrentDeviation = () => {
    const dataMap = {
      scoreShoulderUp: examData["肩上"].score,
      scoreShoulderInL: examData["肩内旋左"],
      scoreShoulderInR: examData["肩内旋右"],
      scoreWaistHip: examData["ウエスト・お尻"],
      scoreAS: examData["AS"].score,
      scoreGreaterTro: examData["大転子"],
      scoreElbowRatio: examData["肘比率"],
      scoreShoulder: examData["肩"],
      scoreEar: examData["耳"],
      scoreFace: examData["顔"].score
    };
    return calcDev(dataMap);
  };

  const updateExamItem = (itemKey, data) => setExamData(prev => ({ ...prev, [itemKey]: data }));

  return (
    <div className="min-h-screen bg-slate-50 pb-40 font-sans text-slate-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 p-4 sticky top-0 z-40">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tighter">mabune Core</h1>
            <p className="text-[10px] text-blue-600 font-bold tracking-[0.2em] uppercase">RE:SET Chart System</p>
          </div>
          <input type="text" placeholder="お名前" className="border-b-2 border-blue-500 outline-none px-2 text-right w-32 text-lg font-bold bg-transparent" value={basicInfo.name} onChange={(e) => setBasicInfo({...basicInfo, name: e.target.value})} />
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-12">
        {/* 問診セクション */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xs font-black text-slate-400 tracking-[0.3em] uppercase italic">01. Intake Form</h2>
          <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="年齢" className="p-3 bg-slate-50 rounded-xl text-sm" value={basicInfo.age} onChange={e => setBasicInfo({...basicInfo, age: e.target.value})} />
              <input type="text" placeholder="電話番号" className="p-3 bg-slate-50 rounded-xl text-sm" value={basicInfo.phone} onChange={e => setBasicInfo({...basicInfo, phone: e.target.value})} />
            </div>
            <textarea placeholder="既往歴・手術歴・禁止事項" className="w-full p-3 bg-slate-50 rounded-xl text-sm h-24" value={basicInfo.history} onChange={e => setBasicInfo({...basicInfo, history: e.target.value})} />
            <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[1.5rem] border border-blue-100 shadow-inner text-center">
              <label className="text-[10px] font-bold text-blue-500 uppercase block mb-2 tracking-widest text-left">My Vision: 本来のあなた、ありたい姿</label>
              <textarea className="w-full bg-transparent outline-none text-sm text-blue-900 placeholder:text-blue-300 h-24 italic" value={basicInfo.idealState} onChange={e => setBasicInfo({...basicInfo, idealState: e.target.value})} />
            </div>
          </div>
        </section>

        {/* ボディマップ */}
        <section className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-[0.3em] uppercase italic">02. Body Map</h2>
          <BodyMapCanvas onSave={setDrawingData} />
        </section>

        {/* スコア入力 */}
        <section className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-[0.3em] uppercase italic">03. Measurement</h2>
          <div className="grid gap-3">
            {Object.keys(examData).map(key => (
              <div key={key} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                <span className="font-bold text-slate-700 text-xs mb-2">{key}</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map((num) => {
                    const current = typeof examData[key] === 'number' ? examData[key] : examData[key].score;
                    return (
                      <button key={num} onClick={() => updateExamItem(key, typeof examData[key] === 'number' ? num : { ...examData[key], score: num })} className={`py-2 rounded-lg font-bold text-[10px] transition-all ${current === num ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{num.toFixed(1)}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ノート */}
        <section className="space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-[0.3em] uppercase italic">04. Session Notes</h2>
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
            <div>
              <label className="text-[10px] font-bold text-slate-400 mb-2 block uppercase tracking-widest">セルフケア指導等</label>
              <textarea className="w-full p-4 bg-slate-50 rounded-2xl text-sm h-32 focus:ring-2 focus:ring-blue-100 outline-none" value={memos.counseling} onChange={e => setMemos({...memos, counseling: e.target.value})} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 mb-2 block uppercase tracking-widest">施術内容メモ</label>
              <textarea className="w-full p-4 bg-slate-50 rounded-2xl text-sm h-32 focus:ring-2 focus:ring-blue-100 outline-none" value={memos.treatment} onChange={e => setMemos({...memos, treatment: e.target.value})} />
            </div>
          </div>
        </section>

        {/* 履歴（項目分離 & 偏差値追加版） */}
        <section className="pb-20 space-y-4">
          <h2 className="text-xs font-black text-slate-400 tracking-[0.3em] uppercase italic">05. Clinical Archive</h2>
          <div className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-5 text-[10px] font-bold text-slate-500 uppercase">Date/Name</th>
                    <th className="p-2 text-[10px] font-black text-blue-700 uppercase">Deviation</th>
                    <th className="p-2 text-[10px] font-bold text-blue-600">肩上</th>
                    <th className="p-2 text-[10px] font-bold text-blue-500">内旋L</th>
                    <th className="p-2 text-[10px] font-bold text-blue-500">内旋R</th>
                    <th className="p-2 text-[10px] font-bold text-green-600">ｳｴｽﾄ</th>
                    <th className="p-2 text-[10px] font-bold text-purple-600">AS</th>
                    <th className="p-2 text-[10px] font-bold text-slate-500">大転子</th>
                    <th className="p-2 text-[10px] font-bold text-slate-500">肘比</th>
                    <th className="p-2 text-[10px] font-bold text-slate-500">肩</th>
                    <th className="p-2 text-[10px] font-bold text-slate-500">耳</th>
                    <th className="p-2 text-[10px] font-bold text-pink-600">顔</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((rec) => (
                    <tr key={rec.id} className="border-t border-slate-50 hover:bg-blue-50/20 transition-colors">
                      <td className="p-5">
                        <div className="text-[9px] text-slate-400 font-mono">{new Date(rec.date).toLocaleDateString()}</div>
                        <div className="font-bold text-xs text-slate-800">{rec.patient?.name}</div>
                      </td>
                      {/* その時点の偏差値を計算して表示 */}
                      <td className="p-2 font-black text-sm text-blue-700">{calcDev(rec).toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-blue-600 font-bold">{rec.scoreShoulderUp?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-blue-500">{rec.scoreShoulderInL?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-blue-500">{rec.scoreShoulderInR?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-green-600 font-bold">{rec.scoreWaistHip?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-purple-600 font-bold">{rec.scoreAS?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-slate-500">{rec.scoreGreaterTro?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-slate-500">{rec.scoreElbowRatio?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-slate-500">{rec.scoreShoulder?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-slate-500">{rec.scoreEar?.toFixed(1)}</td>
                      <td className="p-2 font-mono text-xs text-pink-600 font-bold">{rec.scoreFace?.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-8 shadow-2xl rounded-t-[3rem] z-50">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase mb-1">RE:SET Deviation</p>
            <p className="text-5xl font-black text-blue-400 tracking-tighter">{calculateCurrentDeviation().toFixed(1)}</p>
          </div>
          <button 
            onClick={async () => {
              const res = await saveRecord({ 
                ...basicInfo, examData, counselingMemo: memos.counseling, 
                treatmentMemo: memos.treatment, drawingData, count: basicInfo.count 
              });
              if (res.success) {
                alert("美しい変化を金庫に記録しました。");
                const newData = await getRecords(); setHistory(newData);
              }
            }}
            className="bg-blue-600 hover:bg-blue-500 px-10 py-5 rounded-2xl font-bold shadow-lg transition-all active:scale-95"
          >
            カルテを保存
          </button>
        </div>
      </footer>
    </div>
  );
}