import type { Point } from '../../types';
import type { PointerKind } from './touchEnvironment';

export type GestureMode = 'none' | 'pinchPan' | 'singlePointer';

export interface PointerSnapshot {
  id: number;
  pointerType: PointerKind;
  clientX: number;
  clientY: number;
  canvasPoint: Point;
}

export interface TouchState {
  activePointers: Map<number, PointerSnapshot>;
  gestureMode: GestureMode;
}

export interface PointerLikeEvent {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
}

export interface TouchStateChange {
  nextState: TouchState;
}

export function createInitialTouchState(): TouchState {
  return {
    activePointers: new Map<number, PointerSnapshot>(),
    gestureMode: 'none'
  };
}

function isTouchLikePointerType(pointerType: string): boolean {
  const t = pointerType.toLowerCase();
  return t === 'touch' || t === 'pen';
}

function toPointerKind(pointerType: string): PointerKind {
  const t = pointerType.toLowerCase();
  if (t === 'mouse') return 'mouse';
  if (t === 'touch') return 'touch';
  if (t === 'pen') return 'pen';
  return 'unknown';
}

function deriveGestureMode(count: number): GestureMode {
  if (count >= 2) return 'pinchPan';
  if (count === 1) return 'singlePointer';
  return 'none';
}

function cloneState(state: TouchState): TouchState {
  const nextActive = new Map<number, PointerSnapshot>();
  state.activePointers.forEach((value, key) => {
    nextActive.set(key, value);
  });
  return {
    activePointers: nextActive,
    gestureMode: state.gestureMode
  };
}

function buildSnapshot(event: PointerLikeEvent, canvasPoint: Point): PointerSnapshot {
  return {
    id: event.pointerId,
    pointerType: toPointerKind(event.pointerType),
    clientX: event.clientX,
    clientY: event.clientY,
    canvasPoint
  };
}

export function applyPointerDown(
  state: TouchState,
  event: PointerLikeEvent,
  canvasPoint: Point
): TouchStateChange {
  if (!isTouchLikePointerType(event.pointerType)) {
    return { nextState: state };
  }
  const next = cloneState(state);
  const snapshot = buildSnapshot(event, canvasPoint);
  next.activePointers.set(event.pointerId, snapshot);
  next.gestureMode = deriveGestureMode(next.activePointers.size);
  return { nextState: next };
}

export function applyPointerMove(
  state: TouchState,
  event: PointerLikeEvent,
  canvasPoint: Point
): TouchStateChange {
  if (!isTouchLikePointerType(event.pointerType)) {
    return { nextState: state };
  }
  if (!state.activePointers.has(event.pointerId)) {
    return { nextState: state };
  }
  const next = cloneState(state);
  const snapshot = buildSnapshot(event, canvasPoint);
  next.activePointers.set(event.pointerId, snapshot);
  next.gestureMode = deriveGestureMode(next.activePointers.size);
  return { nextState: next };
}

function removePointer(state: TouchState, event: PointerLikeEvent): TouchStateChange {
  if (!isTouchLikePointerType(event.pointerType)) {
    return { nextState: state };
  }
  if (!state.activePointers.has(event.pointerId)) {
    return { nextState: state };
  }
  const next = cloneState(state);
  next.activePointers.delete(event.pointerId);
  next.gestureMode = deriveGestureMode(next.activePointers.size);
  return { nextState: next };
}

export function applyPointerUp(
  state: TouchState,
  event: PointerLikeEvent
): TouchStateChange {
  return removePointer(state, event);
}

export function applyPointerCancel(
  state: TouchState,
  event: PointerLikeEvent
): TouchStateChange {
  return removePointer(state, event);
}

