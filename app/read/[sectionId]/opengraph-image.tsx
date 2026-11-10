import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { prettyRange } from '@/lib/format';
import { getManifest, getSection } from '@/lib/data';

/** Link previews (PLAN P2.4): one static image per section, rendered at build time. */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'A section of Scripture as Story';
export const dynamic = 'force-static';

export function generateStaticParams() {
  return getManifest().sections.map((s) => ({ sectionId: s.id }));
}

// A static Cormorant Garamond made by `pnpm fonts` (the renderer cannot read WOFF2).
const font = fs.readFileSync(path.join(process.cwd(), 'content/og/cormorant-garamond-500.ttf'));

const GOLD = '#C9A24A';
const VELLUM = '#F4ECDC';
const CLOUD = '#B9AB97';

export default async function Image({ params }: { params: Promise<{ sectionId: string }> }) {
  const { sectionId } = await params;
  const s = getSection(sectionId);
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        padding: 36,
        background: 'radial-gradient(ellipse at 50% 40%, #4a3622 0%, #2a1f16 55%, #14100C 100%)',
        fontFamily: 'Cormorant',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          border: `2px solid ${GOLD}`,
          padding: '0 80px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 8, color: GOLD, textTransform: 'uppercase' }}>
          {s.bookName}
        </div>
        <div
          style={{
            fontSize: s.title.length > 34 ? 72 : 88,
            lineHeight: 1.05,
            color: VELLUM,
            marginTop: 24,
          }}
        >
          {s.title}
        </div>
        <div style={{ width: 240, height: 2, background: GOLD, margin: '32px 0' }} />
        <div style={{ fontSize: 36, color: CLOUD }}>
          {`${s.bookName} ${prettyRange(s.range)} · ${s.minutes} min`}
        </div>
        <div
          style={{ position: 'absolute', bottom: 28, fontSize: 28, letterSpacing: 6, color: GOLD }}
        >
          SCRIPTURE AS STORY
        </div>
      </div>
    </div>,
    { ...size, fonts: [{ name: 'Cormorant', data: font, weight: 500, style: 'normal' }] },
  );
}
