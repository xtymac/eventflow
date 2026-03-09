import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Module-level store for scroll positions.
 * Survives component unmounts but resets on full page reload.
 */
const scrollPositions = new Map<string, number>();

/**
 * Saves scroll position on every scroll event and restores it on back/forward
 * (POP) navigation.
 *
 * By default, restores scroll position automatically via requestAnimationFrame.
 * Pass `{ manualRestore: true }` for pages with lazy-loaded rows that need to
 * pre-render enough content before restoration — the returned value can then be
 * used to initialize the visible row count.
 */
export function useScrollRestore(
  scrollRef: React.RefObject<HTMLElement | null>,
  options?: { manualRestore?: boolean },
): number | null {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const savedTop =
    navType === 'POP' ? (scrollPositions.get(pathname) ?? null) : null;

  // Save position on every scroll event so it is always up-to-date
  // when the user navigates away (more reliable than saving only on unmount).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const save = () => {
      scrollPositions.set(pathname, el.scrollTop);
    };
    el.addEventListener('scroll', save, { passive: true });
    return () => el.removeEventListener('scroll', save);
  }, [scrollRef, pathname]);

  // Auto-restore scroll position unless the caller opts for manual control
  useEffect(() => {
    if (options?.manualRestore || savedTop == null) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: savedTop });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return savedTop;
}
