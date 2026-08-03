'use client';

import { useEffect } from 'react';

import { warmStorage } from '@/lib/storage-ready';

export function StorageWarmup() {
  useEffect(() => {
    warmStorage();
  }, []);

  return null;
}
