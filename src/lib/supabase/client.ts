import { createBrowserClient } from '@supabase/ssr';

/**
 * ينشئ عميل Supabase للاستخدام في المتصفح (Client Components).
 * يقرأ المتغيرات البيئية العامة NEXT_PUBLIC_*.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
