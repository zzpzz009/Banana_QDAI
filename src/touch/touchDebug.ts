export type TouchDebugEventType = 'pointer' | 'gesture' | 'state' | 'info' | 'error';

export interface TouchDebugEvent {
  type: TouchDebugEventType;
  phase?: string;
  message?: string;
  data?: unknown;
}

export type TouchDebugSink = (event: TouchDebugEvent) => void;

let currentSink: TouchDebugSink | null = null;
let defaultSinkEvaluated = false;

function readDebugFlagFromWindow(win: Window): boolean {
  const anyWin = win as unknown as { __BANANAPOD_TOUCH_DEBUG__?: unknown };
  const raw = anyWin.__BANANAPOD_TOUCH_DEBUG__;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const v = raw.toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes') return true;
  }
  try {
    const storage = win.localStorage;
    const val = storage.getItem('bananapod_touch_debug');
    if (!val) return false;
    const v = val.toLowerCase();
    if (v === '1' || v === 'true' || v === 'yes') return true;
  } catch {
    return false;
  }
  return false;
}

function getDefaultSink(): TouchDebugSink | null {
  if (defaultSinkEvaluated) return currentSink;
  defaultSinkEvaluated = true;
  if (typeof window === 'undefined') return null;
  if (!readDebugFlagFromWindow(window)) return null;
  const sink: TouchDebugSink = event => {
    if (typeof console === 'undefined' || typeof console.log !== 'function') return;
    console.log('[touch]', event);
  };
  currentSink = sink;
  return sink;
}

export function setTouchDebugSink(sink: TouchDebugSink | null): void {
  currentSink = sink;
  defaultSinkEvaluated = true;
}

export function debugTouch(event: TouchDebugEvent): void {
  const sink = currentSink ?? getDefaultSink();
  if (!sink) return;
  sink(event);
}
