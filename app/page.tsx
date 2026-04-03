// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { saveRecord, getRecords } from './actions';

// === ボディマップ用キャンバスコンポーネント ===
const BodyMapCanvas = ({ onSave }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  const startDrawing = (e) => {
    const { offsetX, offsetY } = e.nativeEvent;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = e.nativeEvent;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(offsetX, offsetY);
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
    <div className="relative border-2 border-slate-200 rounded-2xl bg-white overflow-hidden shadow-inner">
      <div className="absolute inset-0 pointer-events-none opacity-20 flex justify-around items-center p-4">
        {/* シンプルな人体図の代わりとしてのテキスト配置（実際はここに画像を置けます） */}
        <div className="text-4xl font-bold">正面</div>
        <div className="text-4xl font-bold">側面</div>
        <div className="text-4xl font-bold">背面</div>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={300}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={(e) => {
          const touch = e.touches[0];
          const rect = canvasRef.current.getBoundingClientRect();
          startDrawing({ nativeEvent: { offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top } });
        }}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          const rect = canvasRef.current.getBoundingClientRect();
          draw({ nativeEvent: { offsetX: touch.clientX - rect.left, offsetY: touch.clientY - rect.top } });
        }}
        onTouchEnd={stopDrawing}
        className="w-full h-auto cursor-crosshair touch-none"
      />
      <button onClick={clear} className="absolute bottom-2 right-2 bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold">消去</button>
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
  const [extraExamData, setExtraExamData] = useState({
    "首": { side: "", pos: "" }, "腰": { side: "", pos: "" },
    "膝屈曲": { side: "", diffCm: 0 }, "大腿骨内旋": { side: "", diffCm: 0 },
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

  const updateExamItem = (itemKey: any, data: any) => {
    setExamData(prev => ({ ...prev, [itemKey]: data }));
  };

  const ScoreButtons = ({ currentScore, onSelect }: any) => (
    <div className="grid grid-cols-4 gap-2 mt-2">
      {[2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map((num) => (
        <button key={num} onClick={() => onSelect(num)} className={`py-2 rounded-lg font-bold text-xs ${currentScore === num ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{num.toFixed(1)}</button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-40 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800">mabune Core</h1>
            <p className="text-[10px] text-blue-600 font-bold tracking-widest">RE:SET CHART</p>
          </div>
          <input type="text" placeholder="お名前" className="border-b-2 border-blue-500 outline-none px-2 text-right w-32 text-lg font-bold" value={basicInfo.name} onChange={(e) => setBasicInfo({...basicInfo, name: e.target.value})} />
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-10">
        {/* 1. 問診セクション */}
        <section className="space-y-4">
          <h2 className="text-sm font-black text-slate-400 tracking-[0.3em] uppercase">01. Intake Form</h2>
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="年齢" className="p-3 bg-slate-50 rounded-xl text-sm" value={basicInfo.age} onChange={e => setBasicInfo({...basicInfo, age: e.target.value})} />
              <input type="text" placeholder="電話番号" className="p-3 bg-slate-50 rounded-xl text-sm" value={basicInfo.phone} onChange={e => setBasicInfo({...basicInfo, phone: e.target.value})} />
            </div>
            <input type="text" placeholder="ご住所" className="w-full p-3 bg-slate-50 rounded-xl text-sm" value={basicInfo.address} onChange={e => setBasicInfo({...basicInfo, address: e.target.value})} />
            <textarea placeholder="既往歴・手術歴" className="w-full p-3 bg-slate-50 rounded-xl text-sm h-20" value={basicInfo.history} onChange={e => setBasicInfo({...basicInfo, history: e.target.value})} />
            <textarea placeholder="可動域制限・触れられたくない場所" className="w-full p-3 bg-slate-50 rounded-xl text-sm h-20" value={basicInfo.noTouch} onChange={e => setBasicInfo({...basicInfo, noTouch: e.target.value})} />
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <label className="text-[10px] font-bold text-blue-500 uppercase block mb-2">My Philosophy</label>
              <textarea placeholder="本来のあなた、ありたい姿は何ですか？" className="w-full bg-transparent outline-none text-sm text-blue-900 placeholder:text-blue-300 h-24" value={basicInfo.idealState} onChange={e => setBasicInfo({...basicInfo, idealState: e.target.value})} />
            </div>
          </div>
        </section>

        {/* 2. ボディマップ（ペン入力） */}
        <section className="space-y-4">
          <h2 className="text-sm font-black text-slate-400 tracking-[0.3em] uppercase">02. Body Map</h2>
          <BodyMapCanvas onSave={setDrawingData} />
          <p className="text-[10px] text-slate-400 text-center">※人体図の上をペンや指でなぞって状態をメモしてください</p>
        </section>

        {/* 3. 診察スコア */}
        <section className="space-y-4">
          <h2 className="text-sm font-black text-slate-400 tracking-[0.3em] uppercase">03. Physical Exam</h2>
          <div className="space-y-3">
            {Object.keys(examData).map(key => (
              <div key={key} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                <span className="font-bold text-slate-700 text-sm">{key}</span>
                <div className="w-48">
                  {typeof examData[key] === 'number' ? (
                    <ScoreButtons currentScore={examData[key]} onSelect={(val) => updateExamItem(key, val)} />
                  ) : (
                    <ScoreButtons currentScore={examData[key].score} onSelect={(val) => updateExamItem(key, { ...examData[key], score: val })} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. メモ・画像スペース */}
        <section className="space-y-4">
          <h2 className="text-sm font-black text-slate-400 tracking-[0.3em] uppercase">04. Session Notes</h2>
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
            <div>
              <label className="text-xs font-bold text-slate-400 mb-2 block">カウンセリング内容</label>
              <textarea className="w-full p-4 bg-slate-50 rounded-2xl text-sm h-32" value={memos.counseling} onChange={e => setMemos({...memos, counseling: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 mb-2 block">施術内容</label>
              <textarea className="w-full p-4 bg-slate-50 rounded-2xl text-sm h-32" value={memos.treatment} onChange={e => setMemos({...memos, treatment: e.target.value})} />
            </div>
            
            {/* 写真枠の見本 */}
            <div className="pt-4 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-400 mb-4 block">Visual Records (Before / After)</label>
              <div className="grid grid-cols-4 gap-2">
                {[1,2,3,4].map(i => <div key={i} className="aspect-square bg-slate-100 rounded-lg flex items-center justify-center text-[10px] text-slate-300 border-2 border-dashed border-slate-200">B-{i}</div>)}
                {[1,2,3,4].map(i => <div key={i} className="aspect-square bg-blue-50 rounded-lg flex items-center justify-center text-[10px] text-blue-200 border-2 border-dashed border-blue-100">A-{i}</div>)}
              </div>
            </div>
          </div>
        </section>

        {/* 5. 施術履歴 */}
        <section className="pb-20">
          <h2 className="text-sm font-black text-slate-400 tracking-[0.3em] uppercase mb-4">05. Archive</h2>
          <div className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-4">日時</th>
                  <th className="p-4">回数</th>
                  <th className="p-4">状態</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 5).map(rec => (
                  <tr key={rec.id} className="border-t border-slate-50">
                    <td className="p-4 font-bold">{new Date(rec.date).toLocaleDateString()}</td>
                    <td className="p-4">{rec.visitCount}回</td>
                    <td className="p-4 text-blue-500 font-mono">Face:{rec.scoreFace?.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-8 shadow-2xl rounded-t-[3rem] z-40">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <button 
            onClick={async () => {
              const res = await saveRecord({
                ...basicInfo,
                examData,
                extraExamData,
                counselingMemo: memos.counseling,
                treatmentMemo: memos.treatment,
                drawingData
              });
              if (res.success) {
                alert("大切なカルテを保存しました");
                const newData = await getRecords();
                setHistory(newData);
              }
            }}
            className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold shadow-lg transition-all active:scale-95"
          >
            本日の記録を保存する
          </button>
        </div>
      </footer>
    </div>
  );
}