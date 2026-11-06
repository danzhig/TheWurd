'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { CHANGE_EVENT, readSettings } from '@/lib/store';
import { applyDisplaySettings } from '@/lib/theme';

/** Keeps <html> theme attributes in step with settings, route changes and the system theme. */
export function ThemeController() {
  const pathname = usePathname();
  useEffect(() => {
    const apply = () => applyDisplaySettings(readSettings());
    apply();
    const media = window.matchMedia('(prefers-color-scheme: light)');
    window.addEventListener(CHANGE_EVENT, apply);
    window.addEventListener('storage', apply);
    media.addEventListener('change', apply);
    return () => {
      window.removeEventListener(CHANGE_EVENT, apply);
      window.removeEventListener('storage', apply);
      media.removeEventListener('change', apply);
    };
  }, [pathname]);
  return null;
}
