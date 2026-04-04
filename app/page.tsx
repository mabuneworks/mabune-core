'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// 初期状態
const initialState = { name: '', birth_date: '', notes: '', chart_image: null };

export default function Home() {
  const [view, setView] = useState<'dashboard' | 'edit'>('dashboard');
  const [patients, setPatients] = useState<any[]>([]);
  const [formData, setFormData] = useState(initialState);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 1. 患者一覧の取得
  useEffect(() => {
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('last_visit', { ascending: false });
    if (!error && data) setPatients(data);
  };

  // 2. 新規作成
  const handleNew = () => {
    setFormData(initialState);
    setSelectedId(null);
    setView('edit');
  };

  // 3. 保存
  const handleSave = async () => {
    const payload = {
      name: formData.name,
      birth_date: formData.birth_date,
      chart_data: formData,
      last_visit: new Date().toISOString(),
    };

    let error;
    if (selectedId) {
      const { error: err } = await supabase.from('patients').update(payload).eq('id', selectedId);
      error = err;
    } else {
      const { error: err } = await supabase.from('patients').insert([payload]);
      error = err;
    }

    if (!error) {
      alert('保存しました');
      fetchPatients();
      setView('dashboard');
    } else {
      alert('保存に失敗しました');
    }
  };

  // --- 受付画面（Dashboard） ---
  if (view === 'dashboard') {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">mabune Core 受付</h1>
        <button 
          onClick={handleNew}
          className="w-full bg-blue-600 text-white p-4 rounded-lg mb-8 font-bold shadow-lg"
        >
          ＋ 新規カルテ作成
        </button>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">保存済みのカルテ</h2>
          {patients.length === 0 && <p className="text-gray-500">データがありません</p>}
          {patients.map((p) => (
            <div 
              key={p.id}
              onClick={() => {
                setFormData(p.chart_data);
                setSelectedId(p.id);
                setView('edit');
              }}
              className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer flex justify-between items-center shadow-sm bg-white"
            >
              <div>
                <div className="font-bold text-lg text-gray-800">{p.name} 様</div>
                <div className="text-sm text-gray-500">最終来院: {new Date(p.last_visit).toLocaleDateString()}</div>
              </div>
              <span className="text-blue-500">開く ＞</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- 編集画面（Chart Edit） ---
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between mb-4">
        <button onClick={() => setView('dashboard')} className="text-gray-600">＜ 戻る</button>
        <h1 className="font-bold">カルテ入力: {formData.name || '新規'}</h1>
        <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-1 rounded-full">保存</button>
      </div>

      <div className="space-y-4">
        <input
          type="text"
          placeholder="氏名"
          className="w-full p-2 border rounded"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
        />
        {/* ここに以前作成した人体図Canvasコンポーネント等を配置 */}
        <textarea
          placeholder="メモ"
          className="w-full p-2 border rounded h-32"
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
        />
      </div>
    </div>
  );
}