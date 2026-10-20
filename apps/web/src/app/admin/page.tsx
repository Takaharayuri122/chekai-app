'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <AppLayout>
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <span className="inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent h-8 w-8 text-primary"></span>
      </div>
    </AppLayout>
  );
}
