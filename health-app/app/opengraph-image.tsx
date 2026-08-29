import { ImageResponse } from 'next/og'

// The social preview card for every shared link. Static — one image for the
// whole site. Satori (what ImageResponse runs) doesn't read our CSS tokens or
// Tailwind, so the Ember palette is inlined here as literal hex. No custom
// font: Satori needs a font buffer and the growth doctrine bans extra fonts
// on metered connections; the system sans is fine for an OG card.
export const runtime = 'edge'
export const alt = 'GetInShape — lose weight the Indian way'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CANVAS = '#F7F6F3'
const INK = '#17150F'
const INK_2 = '#5B564C'
const BRAND = '#F1662E'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '96px',
          background: CANVAS,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '18px',
              background: BRAND,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
            }}
          >
            🔥
          </div>
          <div style={{ fontSize: '34px', fontWeight: 700, color: INK }}>GetInShape</div>
        </div>

        <div
          style={{
            marginTop: '48px',
            fontSize: '76px',
            fontWeight: 800,
            color: INK,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          Lose weight the Indian way.
        </div>

        <div style={{ marginTop: '28px', fontSize: '34px', color: INK_2, lineHeight: 1.35 }}>
          Track food by photo, chat or barcode. Calories, macros, weight — built for Indian food.
        </div>

        <div
          style={{
            marginTop: '56px',
            fontSize: '26px',
            fontWeight: 600,
            color: BRAND,
          }}
        >
          Free forever · No credit card
        </div>
      </div>
    ),
    size,
  )
}
