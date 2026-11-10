import type { Metadata, Viewport } from 'next';
import { ThemeController } from '@/components/ui/ThemeController';
import { THEME_SCRIPT } from '@/lib/theme';
import '@/styles/tokens.css';
import '@/styles/fonts.css';
import '@/styles/globals.css';
import '@/styles/typography.css';
import '@/styles/materials.css';
import '@/styles/book.css';

/** Absolute base for link previews: the production URL on Vercel, the preview URL on previews. */
const SITE =
  process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:4173';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'Scripture as Story',
  description: 'A guided narrative path through the Catholic Bible.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#14100C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Sets the theme before first paint so there is no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link
          rel="preload"
          href="/fonts/eb-garamond/eb-garamond-latin-normal.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <ThemeController />
        {children}
        {/* Live transitions between levels run here; it persists across route changes. */}
        <div id="transition-layer" aria-hidden="true" />
      </body>
    </html>
  );
}
