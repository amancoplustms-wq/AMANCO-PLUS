'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import BrandLogo from '@/components/public/BrandLogo';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('بيانات الدخول غير صحيحة. تأكد من البريد الإلكتروني وكلمة المرور.');
      setLoading(false);
      return;
    }

    router.push('/admin');
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-bl from-slate-900 via-slate-800 to-brand-navy p-4 relative overflow-hidden">
      {/* خلفية زخرفية */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand-blue/10 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[400px] h-[400px] rounded-full bg-brand-orange/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* كارد تسجيل الدخول */}
        <div className="bg-white/[0.06] backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-8 animate-fade-in-up">
          {/* الشعار */}
          <div className="flex justify-center mb-8">
            <BrandLogo size="lg" variant="dark" />
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-white text-center mb-1">
            لوحة إدارة أمانكو بلس للشحن والتوريد
          </h1>
          <div className="flex items-center justify-center gap-1.5 mb-3 text-xs font-bold text-slate-300">
            <span>لوحة التحكم المركزية</span>
            <span className="w-[1px] h-3 bg-slate-600" />
            <span className="font-sans font-extrabold uppercase text-slate-300 tracking-wider">
              AMANCO <span className="text-[#f97316]">PLUS</span> TMS
            </span>
          </div>
          <p className="text-slate-400 text-center text-sm mb-6">
            أدخل بيانات حسابك للوصول إلى لوحة التحكم
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* البريد الإلكتروني */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-slate-300 mb-2"
              >
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@amancoplus.com"
                  className="w-full bg-white/[0.07] border border-white/10 rounded-xl py-3 pr-10 pl-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/50 transition-all duration-200"
                  dir="ltr"
                />
              </div>
            </div>

            {/* كلمة المرور */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-300 mb-2"
              >
                كلمة المرور
              </label>
              <div className="relative">
                <Lock
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-white/[0.07] border border-white/10 rounded-xl py-3 pr-10 pl-10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/50 transition-all duration-200"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* رسالة الخطأ */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl p-3 text-center animate-fade-in-up">
                {error}
              </div>
            )}

            {/* زر تسجيل الدخول */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-l from-brand-orange to-orange-600 text-white font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-brand-orange/25 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>جاري تسجيل الدخول...</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>تسجيل الدخول</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* رابط العودة للموقع */}
        <p className="text-center mt-6 text-slate-500 text-sm">
          <a
            href="/"
            className="text-brand-orange hover:text-brand-orange-light transition-colors underline underline-offset-4"
          >
            ← العودة للموقع الرئيسي
          </a>
        </p>
      </div>
    </div>
  );
}
