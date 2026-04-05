'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function PatientDashboard() {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // 入力フォームの状態
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  // 検査結果や画像などはこの chartData の中に入れます
  const [chartData, setChartData] = useState<any>({
    inspection: '', // 検査結果
    bodyNote: '',   // 体の状態
    images: []      // 画像URLのリスト
  });

  // データの読み込み
  const fetchPatients = async () => {
    const { data, error } = await supabase
      .from('patient')
      .select('*')
      .order('last_visit', { ascending: false });
    if (!error && data) setPatients(data);
  };

  useEffect(() => { fetchPatients(); }, []);

  // 保存処理
  const handleSave = async () => {
    const payload = { 
      name, 
      birth_date: birthDate, 
      chart_data: chartData, // ここに検査結果や画像情報がまとまって入ります
      last_visit: new Date().toISOString() 
    };

    if (selectedId) {
      await supabase.from('patient').update(payload).eq('id', selectedId);
    } else {
      await supabase.from('patient').insert([payload]);
    }
    
    setView('list');
    fetchPatients();
    resetForm();
  };

  const resetForm = () => {
    setSelectedId(null);
    setName('');
    setBirthDate('');
    setChartData({ inspection: '', bodyNote: '', images: [] });
  };

  if (view === 'list') {
    return (
      <div className="p-8 bg-slate-50 min-h-screen">
        <h1 className="text-2xl font-bold mb-6 text-slate-800">mabune Core 受付</h1>
        <button 
          onClick={() => { resetForm(); setView('edit'); }}
          className="mb-6 bg-blue-600 text-white px-6 py-2 rounded-full shadow-lg hover:bg-blue-700 transition"
        >
          ＋ 新規カルテ作成
        </button>
        <div className="grid gap-4">
          {patients.map(p => (
            <div 
              key={p.id} 
              onClick={() => {
                setSelectedId(p.id);
                setName(p.name);
                setBirthDate(p.birth_date || '');
                setChartData(p.chart_data || { inspection: '', bodyNote: '', images: [] });
                setView('edit');
              }}
              className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-blue-400 transition"
            >
              <div className="font-bold text-lg">{p.name} 様</div>
              <div className="text-sm text-slate-500">最終来院: {new Date(p.last_visit).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <button onClick={() => setView('list')} className="text-slate-500">← 戻る</button>
        <button onClick={handleSave} className="bg-green-600 text-white px-8 py-2 rounded-full font-bold">保存して終了</button>
      </div>

      <div className="max-w-2xl mx-auto space-y-8">
        <section>
          <h2 className="text-sm font-bold text-slate-400 mb-2">基本情報</h2>
          <input 
            type="text" placeholder="お名前" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full text-3xl font-bold border-b border-slate-200 focus:outline-none focus:border-blue-500"
          />
          <input 
            type="text" placeholder="生年月日 (例: 1980/01/01)" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
            className="w-full mt-4 p-2 bg-slate-50 rounded"
          />
        </section>

        {/* ここが「検査結果」の入力欄です */}
        <section>
          <h2 className="text-sm font-bold text-slate-400 mb-2">検査結果・メモ</h2>
          <textarea 
            value={chartData.inspection} 
            onChange={(e) => setChartData({...chartData, inspection: e.target.value})}
            placeholder="本日のカウンセリング内容や検査結果を入力してください..."
            className="w-full h-40 p-4 bg-slate-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </section>

        {/* ここが「画像」のエリアです（まずはメモとして実装） */}
        <section>
          <h2 className="text-sm font-bold text-slate-400 mb-2">画像・姿勢分析メモ</h2>
          <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400">
            ここに姿勢分析の画像をアップロードする機能を、次に追加します。<br/>
            現在は下のメモ欄をご利用ください。
          </div>
          <textarea 
            value={chartData.bodyNote} 
            onChange={(e) => setChartData({...chartData, bodyNote: e.target.value})}
            placeholder="姿勢の歪みや、ケアのポイント..."
            className="w-full mt-4 p-4 bg-slate-50 rounded-xl focus:outline-none"
          />
        </section>
      </div>
    </div>
  );
}