export type PointerKind = 'mouse' | 'touch' | 'pen' | 'unknown';

export interface PointerEnvironmentInfo {
  hasPointerEvent: boolean;
  primaryPointerKind: PointerKind;
  isCoarsePointer: boolean;
  isTouchLikeDevice: boolean;
}

export interface EnvSource {
  window?: Window;
  navigator?: Navigator;
  matchMedia?: (query: string) => MediaQueryList;
  userAgent?: string;
}

function getGlobalWindow(): Window | undefined {
  if (typeof window !== 'undefined') return window;
  return undefined;
}

function getGlobalNavigator(): Navigator | undefined {
  if (typeof navigator !== 'undefined') return navigator;
  return undefined;
}

function getMatchMedia(source: EnvSource): ((query: string) => MediaQueryList) | undefined {
  if (source.matchMedia) return source.matchMedia;
  if (source.window && source.window.matchMedia) return source.window.matchMedia.bind(source.window);
  const globalWin = getGlobalWindow();
  if (globalWin && globalWin.matchMedia) return globalWin.matchMedia.bind(globalWin);
  return undefined;
}

function getUserAgent(source: EnvSource): string {
  if (typeof source.userAgent === 'string') return source.userAgent;
  if (source.navigator && typeof source.navigator.userAgent === 'string') {
    return source.navigator.userAgent;
  }
  const globalNav = getGlobalNavigator();
  if (globalNav && typeof globalNav.userAgent === 'string') {
    return globalNav.userAgent;
  }
  return '';
}

function detectHasPointerEvent(source: EnvSource): boolean {
  const win = source.window ?? getGlobalWindow();
  return typeof win !== 'undefined' && 'PointerEvent' in win;
}

function detectMaxTouchPoints(source: EnvSource): number {
  const nav = source.navigator ?? getGlobalNavigator();
  if (!nav) return 0;
  const anyNav = nav as Navigator & { maxTouchPoints?: number };
  return typeof anyNav.maxTouchPoints === 'number' ? anyNav.maxTouchPoints : 0;
}

function detectIsCoarsePointer(source: EnvSource): boolean {
  const mm = getMatchMedia(source);
  if (!mm) return false;
  try {
    return mm('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

function detectIsTouchLikeDevice(source: EnvSource): boolean {
  const maxTouchPoints = detectMaxTouchPoints(source);
  if (maxTouchPoints > 0) return true;

  const ua = getUserAgent(source).toLowerCase();
  if (!ua) return false;

  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return true;
  if (ua.includes('android') && ua.includes('mobile')) return true;

  return false;
}

function detectPrimaryPointerKind(source: EnvSource, hasPointerEvent: boolean, isCoarsePointer: boolean, isTouchLikeDevice: boolean): PointerKind {
  if (!hasPointerEvent) {
    if (isTouchLikeDevice) return 'touch';
    return 'mouse';
  }

  if (isTouchLikeDevice || isCoarsePointer) return 'touch';

  return 'mouse';
}

export function detectPointerEnvironment(source?: EnvSource): PointerEnvironmentInfo {
  const baseSource: EnvSource = source ?? {};

  const hasPointerEvent = detectHasPointerEvent(baseSource);
  const isCoarsePointer = detectIsCoarsePointer(baseSource);
  const isTouchLikeDevice = detectIsTouchLikeDevice(baseSource);
  const primaryPointerKind = detectPrimaryPointerKind(baseSource, hasPointerEvent, isCoarsePointer, isTouchLikeDevice);

  return {
    hasPointerEvent,
    primaryPointerKind,
    isCoarsePointer,
    isTouchLikeDevice
  };
}

export function shouldEnableTouch(source?: EnvSource): boolean {
  const info = detectPointerEnvironment(source);
  if (!info.hasPointerEvent) return false;
  if (!info.isTouchLikeDevice && !info.isCoarsePointer) return false;
  if (info.primaryPointerKind === 'mouse') return false;
  return true;
}

