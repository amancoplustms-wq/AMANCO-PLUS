import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';

export const metadata = {
  title: 'لوحة التحكم | أمانكو بلس للشحن والتوريد | AMANCO PLUS',
  description: 'لوحة التحكم المركزية لإدارة عمليات وشحنات أمانكو بلس للشحن والتوريد',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const initialUserName = (user.user_metadata?.full_name || user.user_metadata?.name || '') as string;

  return (
    <AdminShell userEmail={user.email || ''} initialUserName={initialUserName}>
      {children}
    </AdminShell>
  );
}
