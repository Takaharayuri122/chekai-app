'use client';

import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';

export function ClientToaster() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          borderRadius: '0.5rem',
          padding: '1rem',
        },
      }}
    />
  );
}
