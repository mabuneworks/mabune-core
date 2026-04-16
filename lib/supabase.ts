// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

let client = null;
let configError = '';

if (!hasSupabaseEnv) {
  configError =
    'Supabase環境変数が未設定です。.env に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。';
} else {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    configError =
      error instanceof Error
        ? `Supabase初期化に失敗しました: ${error.message}`
        : 'Supabase初期化に失敗しました。環境変数を確認してください。';
  }
}

export const supabase = client;
export const supabaseConfigError = configError;