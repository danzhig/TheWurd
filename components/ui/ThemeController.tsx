'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { CHANGE_EVENT, readSettings } from '@/lib/store';
import { applyDisplaySettings } from '@/lib/theme';

/** Keeps <html> theme attributes in step with settings, route changes and the system theme. */
export function ThemeController() {
  const pathname = usePathname();
  // Decorative textures (clouds, grain) load after the page has painted, invisibly, and fade in
  // once decoded, so they never compete with the text on a slow connection.
  useEffect(() => {
    const decode = (src: string) => {
      const img = new Image();
      img.src = src;
      return img.decode().catch(() => {});
    };
    const on = () =>
      requestAnimationFrame(() => {
        const root = document.documentElement;
        root.dataset.textures = '';
        const files = ['clouds-far.avif', 'clouds-mid.avif', 'clouds-near.avif', 'grain.webp'];
        void Promise.all(files.map((f) => decode(`/textures/${f}`))).then(() => {
          root.dataset.textures = 'on';
        });
      });
    if (document.readyState === 'complete') on();
    else window.addEventListener('load', on, { once: true });
    return () => window.removeEventListener('load', on);
  }, []);
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
