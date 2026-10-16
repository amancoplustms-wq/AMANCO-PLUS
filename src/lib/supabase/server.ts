import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * ينشئ عميل Supabase للاستخدام في جانب السيرفر (Server Components, Route Handlers, Server Actions).
 * يقرأ ويكتب الكوكيز عبر Next.js cookies() API.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // يتم تجاهل الخطأ عند الاستدعاء من Server Component
            // لأن setAll يعمل فقط من Server Action أو Route Handler
          }
        },
      },
    },
  );
}
