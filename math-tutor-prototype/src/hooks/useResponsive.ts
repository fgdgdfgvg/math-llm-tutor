import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

interface ResponsiveState {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  hasTouch: boolean;
  isStandalone: boolean;
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const h = typeof window !== 'undefined' ? window.innerHeight : 768;
    return computeState(w, h);
  });

  useEffect(() => {
    let resizeTimer: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setState(computeState(window.innerWidth, window.innerHeight));
      }, 150);
    };

    const handleOrientation = () => {
      setState(computeState(window.innerWidth, window.innerHeight));
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientation);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientation);
      clearTimeout(resizeTimer);
    };
  }, []);

  return state;
}

function computeState(w: number, h: number): ResponsiveState {
  const breakpoint: Breakpoint =
    w <= 768 ? 'mobile' : w <= 1024 ? 'tablet' : 'desktop';

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    width: w,
    height: h,
    orientation: w > h ? 'landscape' : 'portrait',
    hasTouch:
      typeof navigator !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0),
    isStandalone:
      typeof navigator !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true),
  };
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
} as const;

export const mobileStyles = {
  safeAreaTop: 'env(safe-area-inset-top, 0px)',
  safeAreaBottom: 'env(safe-area-inset-bottom, 0px)',
  safeAreaLeft: 'env(safe-area-inset-left, 0px)',
  safeAreaRight: 'env(safe-area-inset-right, 0px)',
} as const;
