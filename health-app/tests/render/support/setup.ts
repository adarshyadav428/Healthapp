import { afterEach, vi } from 'vitest'

/**
 * Loaded for EVERY test file — the node-environment specs as well as the jsdom
 * render tests.
 *
 * THE ONE RULE HERE: every DOM-touching branch must be guarded on
 * `typeof window`. An unguarded `window`/`document` reference in this file
 * throws under `environment: 'node'` and breaks the entire suite, not just the
 * file being edited. That failure looks nothing like its cause.
 */

if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest')

  const { cleanup } = await import('@testing-library/react')
  afterEach(cleanup)

  // Radix (components/ui/sheet.tsx, dialog.tsx) measures and captures pointers
  // on mount. jsdom has none of these. Minimal stubs — enough not to throw,
  // deliberately not real implementations.
  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    // @ts-expect-error test polyfill
    window.ResizeObserver = ResizeObserverStub
  }

  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  }

  if (!('PointerEvent' in window)) {
    // @ts-expect-error jsdom ships no PointerEvent
    window.PointerEvent = window.MouseEvent
  }
  for (const m of ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture'] as const) {
    if (!(m in Element.prototype)) {
      // @ts-expect-error test polyfill
      Element.prototype[m] = () => {}
    }
  }
}

// Safe in both environments — touches neither window nor document.
afterEach(() => {
  vi.clearAllMocks()
})
