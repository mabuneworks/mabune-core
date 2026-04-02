// @ts-nocheck
"use client";
import React, { useState, useEffect } from 'react';
import { saveRecord, getRecords } from './actions';
// === 設定: データ構造 ===

const SCORE_OPTIONS = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
const SIDE_OPTIONS = ["左", "右"];
const POS_VERTICAL_OPTIONS = ["上", "中", "下"];
const FACE_ALIGNMENTS = ["捻れ", "傾き", "スライド"];

// === 状態管理の初期値 ===

const initialScores = {
  "肩上": { side: "", score: 3.0 },
  "肩捻じれ": { side: "" }, 
  "肩内旋左": 3.0,
  "肩内旋右": 3.0,
  "ウエスト・お尻": 3.0, 
  "AS": { side: "", score: 3.0 },
  "大転子": 3.0,
  "肘比率": 3.0,
  "肩": 3.0,
  "耳": 3.0,
  "顔": { side: "", alignment: "", score: 3.0 },
};

const initialExtraExams = {
  "首": { side: "", pos: "" },
  "腰": { side: "", pos: "" },
  "膝屈曲": { side: "", diffCm: 0 },
  "大腿骨内旋": { side: "", diffCm: 0 },
};

const MOCK_HISTORY = [
  { date: "1回目 (2025-01-10)", score: "82.5", items: { "顔": 4.5, "AS": 4.0, "ウエスト・お尻": 3.5 } },
  { date: "5回目 (2025-02-15)", score: "71.0", items: { "顔": 3.5, "AS": 3.5, "ウエスト・お尻": 3.0 } },
  { date: "10回目 (今日)", score: "???", items: { "顔": 3.0, "AS": 3.0, "ウエスト・お尻": 3.0 } },
];

const [basicInfo, setBasicInfo] = useState({ name: "", date: "", count: "1" });
  const [examData, setExamData] = useState(initialScores);
  const [extraExamData, setExtraExamData] = useState(initialExtraExams);
  const [history, setHistory] = useState<any[]>([]);

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
      const data = (examData as any)[item];
      if (typeof data === 'number') {
        total += data;
      } else if (data && typeof (data as any).score === 'number') {
        total += (data as any).score;
      }
    });
    return (45 - (total * 2)) * 2 + 50;
  };

  const updateExamItem = (itemKey: any, data: any) => {
    setExamData(prev => ({ ...prev, [itemKey]: data }));
  };

  const updateExtraExamItem = (itemKey: any, data: any) => {
    setExtraExamData(prev => ({ ...prev, [itemKey]: data }));
  };

  const ScoreButtons = ({ currentScore, onSelect }: any) => (
    <div className="grid grid-cols-4 gap-2 mt-4">
      {SCORE_OPTIONS.map((num) => (
        <button key={num} onClick={() => onSelect(num)} className={`py-3 rounded-xl font-bold text-sm transition-all ${currentScore === num ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-600 active:bg-slate-200'}`}>
          {num.toFixed(1)}
        </button>
      ))}
    </div>
  );

  const SideButtons = ({ currentSide, onSelect }: any) => (
    <div className="flex gap-2 mb-2">
      {SIDE_OPTIONS.map(side => (
        <button key={side} onClick={() => onSelect(side)} className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${currentSide === side ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{side}</button>
      ))}
    </div>
  );

  const PosVerticalButtons = ({ currentPos, onSelect }) => (
    <div className="flex gap-2 mt-2">
      {POS_VERTICAL_OPTIONS.map(pos => (
        <button key={pos} onClick={() => onSelect(pos)} className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all ${currentPos === pos ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>{pos}</button>
      ))}
    </div>
  );

  const FaceAlignmentButtons = ({ currentAlign, onSelect }) => (
    <div className="flex flex-wrap gap-2 mb-2">
      {FACE_ALIGNMENTS.map(align => (
        <button key={align} onClick={() => onSelect(align)} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${currentAlign === align ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>{align}</button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-32 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-md mx-auto flex justify-between items-end">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">mabune Core</h1>
            <p className="text-xs text-slate-500 italic">RE:SET Chart System</p>
          </div>
          <input type="text" placeholder="氏名" className="border-b border-slate-300 focus:border-blue-500 outline-none px-2 text-right w-32" value={basicInfo.name} onChange={(e) => setBasicInfo({...basicInfo, name: e.target.value})} />
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-8">
        <section className="grid grid-cols-2 gap-4 text-sm bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <div>
            <label className="text-slate-500 block mb-1">受診日</label>
            <input type="date" className="w-full p-2 rounded-lg border border-slate-200" value={basicInfo.date} onChange={e => setBasicInfo({...basicInfo, date: e.target.value})} />
          </div>
          <div>
            <label className="text-slate-500 block mb-1">回数</label>
            <input type="number" className="w-full p-2 rounded-lg border border-slate-200" placeholder="1" value={basicInfo.count} onChange={e => setBasicInfo({...basicInfo, count: e.target.value})} />
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-xs font-bold text-blue-600 tracking-widest uppercase mb-4">冨田式 診察フロー</h2>
          {[
            { key: "肩上", label: "肩上", type: "sideScore" },
            { key: "肩捻じれ", label: "肩捻じれ", type: "sideOnly" },
            { key: "肩内旋左", label: "肩内旋左", type: "scoreOnly" },
            { key: "肩内旋右", label: "肩内旋右", type: "scoreOnly" },
            { key: "ウエスト・お尻", label: "ウエスト・お尻", type: "scoreOnly" },
            { key: "AS", label: "AS", type: "sideScore" },
            { key: "大転子", label: "大転子", type: "scoreOnly" },
            { key: "肘比率", label: "肘比率", type: "scoreOnly" },
            { key: "肩", label: "肩", type: "scoreOnly" },
            { key: "耳", label: "耳", type: "scoreOnly" },
            { key: "顔", label: "顔", type: "face" },
          ].map((item) => {
            const data = examData[item.key];
            return (
              <div key={item.key} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                <label className="block text-base font-bold text-slate-800 mb-4">{item.label}</label>
                {item.type === "sideScore" && (
                  <>
                    <SideButtons currentSide={data.side} onSelect={(side) => updateExamItem(item.key, { ...data, side })} />
                    <ScoreButtons currentScore={data.score} onSelect={(score) => updateExamItem(item.key, { ...data, score })} />
                  </>
                )}
                {item.type === "sideOnly" && (
                  <SideButtons currentSide={data.side} onSelect={(side) => updateExamItem(item.key, { side })} />
                )}
                {item.type === "scoreOnly" && (
                  <ScoreButtons currentScore={data} onSelect={(score) => updateExamItem(item.key, score)} />
                )}
                {item.type === "face" && (
                  <div className="space-y-3">
                    <SideButtons currentSide={data.side} onSelect={(side) => updateExamItem(item.key, { ...data, side })} />
                    <FaceAlignmentButtons currentAlign={data.alignment} onSelect={(alignment) => updateExamItem(item.key, { ...data, alignment })} />
                    <ScoreButtons currentScore={data.score} onSelect={(score) => updateExamItem(item.key, { ...data, score })} />
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="space-y-6">
          <h2 className="text-xs font-bold text-slate-600 tracking-widest uppercase mb-4">追加検査項目</h2>
          {[
            { key: "首", label: "首", type: "sidePos" },
            { key: "腰", label: "腰", type: "sidePos" },
            { key: "膝屈曲", label: "膝屈曲", type: "sideInputCm" },
            { key: "大腿骨内旋", label: "大腿骨内旋", type: "sideInputCm" },
          ].map((item) => {
            const data = extraExamData[item.key];
            return (
              <div key={item.key} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                <label className="block text-base font-bold text-slate-800 mb-4">{item.label}</label>
                {item.type === "sidePos" && (
                  <>
                    <SideButtons currentSide={data.side} onSelect={(side) => updateExtraExamItem(item.key, { ...data, side })} />
                    <PosVerticalButtons currentPos={data.pos} onSelect={(pos) => updateExtraExamItem(item.key, { ...data, pos })} />
                  </>
                )}
                {item.type === "sideInputCm" && (
                  <>
                    <SideButtons currentSide={data.side} onSelect={(side) => updateExtraExamItem(item.key, { ...data, side })} />
                    <div className="mt-3 flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <label className="text-xs text-slate-500 font-bold">左右差</label>
                        <input type="number" step="0.1" className="w-24 p-2 rounded-lg border border-slate-200 text-right font-mono text-lg" value={data.diffCm} onChange={e => updateExtraExamItem(item.key, { ...data, diffCm: parseFloat(e.target.value) || 0 })} />
                        <span className="text-sm font-bold text-slate-700">cm</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </section>

        <section className="space-y-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <h2 className="text-sm font-bold text-blue-700 tracking-widest uppercase mb-2">Progress & Media (倉庫予定地)</h2>
          <div className="overflow-x-auto">
            <h3 className="text-base font-bold text-slate-900 mb-3">点数履歴 (見本)</h3>
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200 tracking-tight">
                  <th className="py-2 px-1">受診回数</th>
                  <th className="py-2 px-1">偏差値</th>
                  <th className="py-2 px-1">顔</th>
                  <th className="py-2 px-1">AS</th>
                  <th className="py-2 px-1">ウエスト</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_HISTORY.map(h => (
                  <tr key={h.date} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="py-2 px-1 font-medium">{h.date}</td>
                    <td className="py-2 px-1 font-black text-blue-600 text-sm">{h.score}</td>
                    <td className="py-2 px-1">{h.items["顔"] ? h.items["顔"].toFixed(1) : "-"}</td>
                    <td className="py-2 px-1">{h.items["AS"] ? h.items["AS"].toFixed(1) : "-"}</td>
                    <td className="py-2 px-1">{h.items["ウエスト・お尻"] ? h.items["ウエスト・お尻"].toFixed(1) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6">
            <h3 className="text-base font-bold text-slate-900 mb-4">写真経過 (見本: 顔のアップ)</h3>
            <div className="grid grid-cols-3 gap-3">
              {[MOCK_HISTORY[0], MOCK_HISTORY[1], MOCK_HISTORY[2]].map((h, index) => (
                <div key={h.date} className="text-center">
                  <div className="w-full aspect-[3/4] bg-slate-100 rounded-xl flex flex-col items-center justify-center border border-slate-200 p-2 shadow-inner">
                    <span className="text-slate-400 font-black text-5xl">{h.items["顔"] ? h.items["顔"].toFixed(1) : "?"}</span>
                    <span className="text-[10px] text-slate-500 mt-2 font-mono">Photo {index + 1}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 font-medium">{index === 2 ? "今回" : `${index + 1}回目`}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-6 shadow-2xl rounded-t-3xl z-20">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em]">RE:SET DEVIATION</p>
            <p className="text-5xl font-black text-blue-400 tracking-tighter">{calculateDeviation().toFixed(1)}</p>
          </div>
          <button 
  onClick={async () => {
    const result = await saveRecord({
      name: basicInfo.name,
      count: basicInfo.count,
      examData: examData,
      extraExamData: extraExamData
    });
    if (result.success) {
      alert("金庫に保存しました！");
    const newData = await getRecords(); 
      setHistory(newData);}
  }}
  className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg"
>
  カルテを保存
</button>
        </div>
      </footer>
    <div className="mt-12 bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-xl border border-white/50">
  <h2 className="text-2xl font-bold mb-6 text-slate-800 flex items-center gap-2">
    <span>📜</span> 施術履歴（最新10件）
  </h2>
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="py-3 px-4 text-slate-500 font-medium">日時</th>
          <th className="py-3 px-4 text-slate-500 font-medium">お名前</th>
          <th className="py-3 px-4 text-slate-500 font-medium">回数</th>
          <th className="py-3 px-4 text-slate-500 font-medium">肩上</th>
          <th className="py-3 px-4 text-slate-500 font-medium">肩捻じれ</th>
          <th className="py-3 px-4 text-slate-500 font-medium">AS</th>
          <th className="py-3 px-4 text-slate-500 font-medium">顔</th>
        </tr>
      </thead>
      <tbody>
        {history.map((rec) => (
          <tr key={rec.id} className="border-b border-slate-100">
            <td className="py-4 px-4 text-slate-600">{new Date(rec.date).toLocaleDateString()}</td>
           
            <td className="py-4 px-4 font-bold text-slate-800">{rec.patient.name}</td>
            <td className="py-4 px-4 text-slate-600">{rec.visitCount}回目</td>
            <td className="py-4 px-4 text-blue-600 font-mono">{rec.scoreShoulderUp?.toFixed(1)}</td>
             <td className="py-4 px-4 text-slate-600">{rec.scoreShoulderTwist}</td>
            <td className="py-4 px-4 text-purple-600 font-mono">{rec.scoreAS?.toFixed(1)}</td>
            <td className="py-4 px-4 text-pink-600 font-mono">{rec.scoreFace?.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
    
    </div>
  );
