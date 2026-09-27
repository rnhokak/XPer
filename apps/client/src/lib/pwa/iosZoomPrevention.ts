/**
 * Prevents all forms of zoom on iOS mobile devices (Safari / WebKit PWA):
 * 1. Multi-touch pinch-to-zoom (gesturestart, gesturechange, gestureend, touchmove)
 * 2. Double-tap to zoom
 */
export function setupIOSZoomPrevention(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 1. Prevent Safari gesture-based pinch zoom
  const preventGesture = (e: Event) => {
    e.preventDefault();
  };

  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('gestureend', preventGesture, { passive: false });

  // 2. Prevent multi-touch pinch on touchmove
  document.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  // 3. Prevent rapid double-tap zoom on non-input elements
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        const target = e.target as HTMLElement | null;
        if (target && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
          e.preventDefault();
        }
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );
}
