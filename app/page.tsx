'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// タブの種類を定義
type TabType = 'basic' | 'counseling' | 'inspection' | 'treatment';

export default function MabuneFullChart() {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // 基本情報
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  
  // 拡張データ（すべて chart_data に保存）
  const [chartData, setChartData] = useState({
    address: '',
    phone: '',
    mainComplaint: '', // 主訴
    history: '',        // 既往歴
    inspection: {       // 検査・姿勢分析
      head: '',
      shoulder: '',
      pelvis: '',
      foot: '',
      notes: ''
    },
    treatmentRecord: '', // 本日の施術
    advice: ''           // アフターケア
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
      chart_data: chartData, 
      last_visit: new Date().toISOString() 
    };

    if (selectedId) {
      await supabase.from('patient').update(payload).eq('id', selectedId);
    } else {
      await supabase.from('patient').insert([payload]);
    }
    
    setView('list');
    fetchPatients();
  };

  const openChart = (p: any) => {
    setSelectedId(p.id);
    setName(p.name);
    setBirthDate(p.birth_date || '');
    setChartData(p.chart_data || {
      address: '', phone: '', mainComplaint: '', history: '',
      inspection: { head: '', shoulder: '', pelvis: '', foot: '', notes: '' },
      treatmentRecord: '', advice: ''
    });
    setView('edit');
    setActiveTab('basic');
  };

  if (view === 'list') {
    return (
      <div className="p-6 bg-slate-50 min-h-screen font-sans">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-serif font-bold text-slate-700">mabune Core <span className="text-sm font-normal text-slate-400">Reception</span></h1>
          <button 
            onClick={() => { setSelectedId(null); setView('edit'); }}
            className="bg-blue-600 text-white px-6 py-2 rounded-full shadow-md hover:bg-blue-700 transition"
          >
            ＋ 新規カルテ作成
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map(p => (
            <div key={p.id} onClick={() => openChart(p)} className="p-5 bg-white rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md hover:border-blue-200 transition">
              <div className="text-slate-400 text-xs mb-1">ID: {p.id.slice(0,8)}</div>
              <div className="text-xl font-bold text-slate-800 mb-2">{p.name} 様</div>
              <div className="text-sm text-slate-500">最終来院: {new Date(p.last_visit).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen flex flex-col">
      {/* 編集画面ヘッダー */}
      <header className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => setView('list')} className="text-slate-400 hover:text-slate-600">✕ 閉じる</button>
          <h2 className="text-xl font-bold">{name || '新規カルテ'}</h2>
        </div>
        <button onClick={handleSave} className="bg-green-600 text-white px-8 py-2 rounded-full font-bold shadow-lg">保存する</button>
      </header>

      {/* タブメニュー */}
      <nav className="flex px-6 border-b bg-white overflow-x-auto">
        {[
          { id: 'basic', label: '基本情報' },
          { id: 'counseling', label: 'カウンセリング' },
          { id: 'inspection', label: '姿勢・検査' },
          { id: 'treatment', label: '施術・アドバイス' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-6 py-4 text-sm font-bold whitespace-nowrap border-b-2 transition ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="p-6 max-w-4xl mx-auto w-full flex-grow">
        {activeTab === 'basic' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">お名前</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full text-2xl font-bold p-2 border-b focus:outline-none focus:border-blue-500" placeholder="氏名を入力" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">生年月日</label>
                <input type="text" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full p-3 bg-slate-50 rounded-lg" placeholder="1980/01/01" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">電話番号</label>
                <input type="text" value={chartData.phone} onChange={(e) => setChartData({...chartData, phone: e.target.value})} className="w-full p-3 bg-slate-50 rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">住所</label>
              <input type="text" value={chartData.address} onChange={(e) => setChartData({...chartData, address: e.target.value})} className="w-full p-3 bg-slate-50 rounded-lg" />
            </div>
          </div>
        )}

        {activeTab === 'counseling' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h3 className="font-bold text-slate-700 mb-2">本日のお悩み（主訴）</h3>
              <textarea value={chartData.mainComplaint} onChange={(e) => setChartData({...chartData, mainComplaint: e.target.value})} className="w-full h-32 p-4 bg-slate-50 rounded-xl focus:outline-none" placeholder="どこが、いつから、どのように痛みますか？" />
            </div>
            <div>
              <h3 className="font-bold text-slate-700 mb-2">既往歴・健康状態</h3>
              <textarea value={chartData.history} onChange={(e) => setChartData({...chartData, history: e.target.value})} className="w-full h-32 p-4 bg-slate-50 rounded-xl focus:outline-none" />
            </div>
          </div>
        )}

        {activeTab === 'inspection' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {['head', 'shoulder', 'pelvis', 'foot'].map((part) => (
                  <div key={part}>
                    <label className="block text-xs font-bold text-slate-400 uppercase">{part}</label>
                    <input 
                      type="text" 
                      value={(chartData.inspection as any)[part]} 
                      onChange={(e) => setChartData({...chartData, inspection: {...chartData.inspection, [part]: e.target.value}})} 
                      className="w-full p-2 border-b focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 rounded-2xl p-6 flex flex-col justify-center items-center border-2 border-dashed border-slate-200">
                <span className="text-slate-400 text-sm">ここに姿勢写真を<br/>表示・解析する予定です</span>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-slate-700 mb-2">身体所見・分析メモ</h3>
              <textarea value={chartData.inspection.notes} onChange={(e) => setChartData({...chartData, inspection: {...chartData.inspection, notes: e.target.value}})} className="w-full h-32 p-4 bg-slate-50 rounded-xl focus:outline-none" />
            </div>
          </div>
        )}

        {activeTab === 'treatment' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h3 className="font-bold text-slate-700 mb-2">本日のケア・施術内容</h3>
              <textarea value={chartData.treatmentRecord} onChange={(e) => setChartData({...chartData, treatmentRecord: e.target.value})} className="w-full h-48 p-4 bg-slate-50 rounded-xl focus:outline-none" />
            </div>
            <div>
              <h3 className="font-bold text-slate-700 mb-2">セルフケア・次回へのアドバイス</h3>
              <textarea value={chartData.advice} onChange={(e) => setChartData({...chartData, advice: e.target.value})} className="w-full h-32 p-4 bg-green-50 rounded-xl focus:outline-none" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}