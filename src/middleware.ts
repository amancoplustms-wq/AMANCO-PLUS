import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware لحماية مسارات /admin/*
 * - يقوم بتحديث جلسة Supabase Auth عبر الكوكيز.
 * - يحول المستخدمين غير المسجلين إلى /login.
 */
export async function middleware(request: NextRequest) {
  const allCookies = request.cookies.getAll();
  const hasAuthToken = allCookies.some(
    (c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'),
  );

  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch';

  // 1. إذا لم يكن هناك أي كوكي جلسة لمسار /admin، حوله مباشرة لـ /login دون استعلام خارجي بطيء
  if (!hasAuthToken && request.nextUrl.pathname.startsWith('/admin')) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // 2. إذا كان الطلب Prefetch والكوكي موجودة، اسمح بالطلب فوراً بـ 0ms تأخير
  if (isPrefetch && hasAuthToken && request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // تحديث الجلسة (ضروري لتجديد التوكن)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // حماية مسارات /admin — تحويل غير المسجلين إلى /login
  if (!user && request.nextUrl.pathname.startsWith('/admin')) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // إذا كان المستخدم مسجلاً وطلب /login، حوّله إلى /admin
  if (user && request.nextUrl.pathname === '/login') {
    const adminUrl = request.nextUrl.clone();
    adminUrl.pathname = '/admin';
    return NextResponse.redirect(adminUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
