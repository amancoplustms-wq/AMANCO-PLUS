/**
 * أدوات استخراج اسم الأدمن والتحية الزمنية الذكية
 * هوية أمانكو بلس للشحن والتوريد
 */

export const STORAGE_KEY_SIDEBAR_COLLAPSED = 'amanco_sidebar_collapsed';
export const STORAGE_KEY_USER_NAME = 'amanco_user_name';
export const STORAGE_KEY_USER_EMAIL = 'amanco_user_email';
export const STORAGE_KEY_USER_ROLE = 'amanco_user_role';

/**
 * استخراج اسم المستخدم بذكاء بالترتيب التالي:
 * 1. من user_metadata (full_name أو name) في Supabase
 * 2. أو من البريد الإلكتروني عبر قاموس ذكي:
 *    - mohamed / basit / baset -> أ. محمد عبد الباسط
 *    - admin / manager / root -> إدارة أمانكو بلس
 *    - amanco -> فريق إدارة أمانكو بلس
 *    - أو تنظيف الجزء قبل @
 * 3. القيمة الاحتياطية: المدير العام
 */
export function resolveAdminUserName(
  email?: string | null,
  metadataName?: string | null
): string {
  if (metadataName && typeof metadataName === 'string' && metadataName.trim().length > 0) {
    return metadataName.trim();
  }

  if (email && typeof email === 'string') {
    const lower = email.toLowerCase().trim();
    if (lower.includes('mohamed') || lower.includes('basit') || lower.includes('baset')) {
      return 'أ. محمد عبد الباسط';
    }
    if (lower.includes('admin') || lower.includes('manager') || lower.includes('root')) {
      return 'إدارة أمانكو بلس';
    }
    if (lower.includes('amanco')) {
      return 'فريق إدارة أمانكو بلس';
    }

    const prefix = lower.split('@')[0];
    if (prefix) {
      const cleaned = prefix
        .replace(/[0-9._-]+/g, ' ')
        .trim();
      if (cleaned.length > 1) {
        return cleaned
          .split(' ')
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      }
    }
  }

  return 'المدير العام';
}

/**
 * استخراج التحية الزمنية الذكية حسب توقيت اليوم
 * - قبل 12 ظهراً: صباح الخير
 * - بعد 12 ظهراً: مساء الخير
 */
export function getTimeBasedGreeting(date: Date = new Date()): {
  greeting: string;
  isMorning: boolean;
} {
  const hour = date.getHours();
  const isMorning = hour >= 4 && hour < 12;
  return {
    greeting: isMorning ? 'صباح الخير' : 'مساء الخير',
    isMorning,
  };
}
