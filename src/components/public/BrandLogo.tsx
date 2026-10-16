import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'light' | 'dark';
}

const SIZES = {
  sm: {
    icon: 34,
    line1: 'text-[15px]',
    line2: 'text-[9.5px]',
  },
  md: {
    icon: 44,
    line1: 'text-lg sm:text-xl',
    line2: 'text-xs sm:text-[12.5px]',
  },
  lg: {
    icon: 56,
    line1: 'text-2xl sm:text-3xl',
    line2: 'text-sm sm:text-base',
  },
  xl: {
    icon: 68,
    line1: 'text-3xl sm:text-4xl',
    line2: 'text-base sm:text-lg',
  },
};

/**
 * شعار أمانكو بلس للشحن والتوريد (AMANCO PLUS) - SVG احترافي بتصميم هرمي متوازن
 * - السطر الأول: أمانكو بلس (العربي بارز وكبير)
 * - السطر الثاني: AMANCO PLUS • للشحن والتوريد (متوازن تماماً بعرض السطر الأول)
 */
export default function BrandLogo({
  className = '',
  size = 'md',
  showText = true,
  variant = 'light',
}: BrandLogoProps) {
  const currentSize = SIZES[size];
  const isDark = variant === 'dark';
  const id = React.useId();
  const shieldGradId = `shieldGrad-${id.replace(/:/g, '')}`;
  const arrowGradId = `arrowGrad-${id.replace(/:/g, '')}`;

  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 shrink-0 ${className}`}>
      {/* أيقونة الدرع الهندسية الثابتة */}
      <svg
        width={currentSize.icon}
        height={currentSize.icon}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="شعار أمانكو بلس للشحن والتوريد | AMANCO PLUS"
        className="shrink-0"
      >
        {/* الدرع - رمز الأمان اللوجستي */}
        <path
          d="M32 4L8 16V30C8 44.36 18.28 57.52 32 60C45.72 57.52 56 44.36 56 30V16L32 4Z"
          fill="#0f172a"
          stroke={isDark ? '#475569' : '#1e293b'}
          strokeWidth="1.5"
        />

        {/* تدرج داخل الدرع */}
        <defs>
          <linearGradient id={shieldGradId} x1="16" y1="12" x2="48" y2="52">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id={arrowGradId} x1="18" y1="28" x2="46" y2="36">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fdba74" />
          </linearGradient>
        </defs>

        <path
          d="M32 7L11 17.5V30C11 42.8 20.2 54.6 32 57C43.8 54.6 53 42.8 53 30V17.5L32 7Z"
          fill={`url(#${shieldGradId})`}
        />

        {/* صندوق الطرد والتوريد */}
        <rect
          x="21"
          y="22"
          width="16"
          height="14"
          rx="2"
          fill={`url(#${arrowGradId})`}
        />
        <line
          x1="29"
          y1="22"
          x2="29"
          y2="36"
          stroke="#0f172a"
          strokeWidth="1.2"
        />
        <line
          x1="21"
          y1="29"
          x2="37"
          y2="29"
          stroke="#0f172a"
          strokeWidth="1.2"
        />

        {/* سهم السرعة والانتشار */}
        <path
          d="M38 32L50 26L46 31H50L38 38L42 33H38V32Z"
          fill="#f97316"
          stroke="#fdba74"
          strokeWidth="0.5"
          strokeLinejoin="round"
        />

        {/* علامة الصح داخل الدرع (ضمان التسليم والتوريد) */}
        <path
          d="M25 43L29 47L39 37"
          stroke="#059669"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>

      {/* الهوية النصية الرسمية المتوازنة في سطرين (الخيار الأول المعتمد) */}
      {showText && (
        <div className="flex flex-col items-start justify-center text-right select-none min-w-0 shrink-0">
          {/* السطر الأول: أمانكو بلس بحجم كبير وبارز */}
          <span
            className={`${currentSize.line1} font-black tracking-tight whitespace-nowrap leading-none ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            أمانكو <span className="text-[#f97316]">بلس</span>
          </span>

          {/* السطر الثاني: AMANCO PLUS • للشحن والتوريد في سطر ممتد متناسق تماماً */}
          <div
            className={`${currentSize.line2} font-bold whitespace-nowrap mt-1 leading-none flex items-center gap-1.5 ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            <span
              className={`font-sans font-extrabold uppercase tracking-wider text-[0.88em] ${
                isDark ? 'text-slate-200' : 'text-slate-800'
              }`}
            >
              AMANCO <span className="text-[#f97316]">PLUS</span>
            </span>
            <span className={`text-[0.7em] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>•</span>
            <span className="font-bold">للشحن والتوريد</span>
          </div>
        </div>
      )}
    </div>
  );
}
