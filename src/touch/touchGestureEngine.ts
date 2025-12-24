import type { Point } from '../../types';
import type { TouchState, PointerSnapshot } from './touchState';

export interface CanvasTransform {
  zoom: number;
  panOffset: Point;
}

export interface PinchPanConfig {
  minZoom: number;
  maxZoom: number;
}

export interface PinchPanContext {
  initialTransform: CanvasTransform;
  initialCenter: Point;
  initialDistance: number;
}

export interface PinchPanComputationInput {
  state: TouchState;
  config: PinchPanConfig;
  context: PinchPanContext;
}

export interface PinchPanComputationResult {
  transform: CanvasTransform;
}

function clampZoom(value: number, minZoom: number, maxZoom: number): number {
  if (value < minZoom) return minZoom;
  if (value > maxZoom) return maxZoom;
  return value;
}

function getActiveSnapshots(state: TouchState): PointerSnapshot[] {
  const list: PointerSnapshot[] = [];
  state.activePointers.forEach(snapshot => {
    if (snapshot.pointerType === 'touch' || snapshot.pointerType === 'pen') {
      list.push(snapshot);
    }
  });
  return list;
}

function getCanvasCenter(snapshots: PointerSnapshot[]): Point {
  let sumX = 0;
  let sumY = 0;
  for (const s of snapshots) {
    sumX += s.canvasPoint.x;
    sumY += s.canvasPoint.y;
  }
  const count = snapshots.length || 1;
  return {
    x: sumX / count,
    y: sumY / count
  };
}

function getScreenCenter(snapshots: PointerSnapshot[]): Point {
  let sumX = 0;
  let sumY = 0;
  for (const s of snapshots) {
    sumX += s.clientX;
    sumY += s.clientY;
  }
  const count = snapshots.length || 1;
  return {
    x: sumX / count,
    y: sumY / count
  };
}

function getScreenDistance(snapshots: PointerSnapshot[]): number {
  if (snapshots.length < 2) return 0;
  const a = snapshots[0];
  const b = snapshots[1];
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

export function computePinchPan(
  input: PinchPanComputationInput
): PinchPanComputationResult | null {
  const { state, config, context } = input;
  const snapshots = getActiveSnapshots(state);
  if (snapshots.length < 2) {
    return null;
  }
  if (context.initialDistance <= 0) {
    return null;
  }

  const currentDistance = getScreenDistance(snapshots);
  if (currentDistance <= 0) {
    return null;
  }

  const scale = currentDistance / context.initialDistance;
  const initialZoom = context.initialTransform.zoom;
  const rawZoom = initialZoom * scale;
  const zoom = clampZoom(rawZoom, config.minZoom, config.maxZoom);

  const canvasCenter = getCanvasCenter(snapshots);
  const screenCenter = getScreenCenter(snapshots);

  const panOffset: Point = {
    x: screenCenter.x - canvasCenter.x * zoom,
    y: screenCenter.y - canvasCenter.y * zoom
  };

  return {
    transform: {
      zoom,
      panOffset
    }
  };
}
