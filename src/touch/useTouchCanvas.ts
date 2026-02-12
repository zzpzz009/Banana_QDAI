import { useRef } from 'react';
import type { RefObject } from 'react';
import type React from 'react';
import type { Point, WheelAction, Tool } from '../../types';
import {
  createInitialTouchState,
  applyPointerDown,
  applyPointerMove,
  applyPointerUp,
  applyPointerCancel,
  type TouchState,
  type PointerLikeEvent,
  type PointerSnapshot
} from './touchState';
import { computePinchPan, type PinchPanConfig, type PinchPanContext } from './touchGestureEngine';
import { shouldEnableTouch } from './touchEnvironment';
import { debugTouch } from './touchDebug';

export interface SingleTouchInfo {
  clientX: number;
  clientY: number;
  canvasPoint: Point;
  shiftKey: boolean;
  isPrimary: boolean;
  detail: number;
  target: EventTarget | null;
}

export interface TouchCanvasOptions {
  svgRef: RefObject<SVGSVGElement>;
  zoom: number;
  panOffset: Point;
  wheelAction: WheelAction;
  activeTool: Tool;
  isEditing: boolean;
  isCropping: boolean;
  onPanZoomChange: (transform: { zoom: number; panOffset: Point }) => void;
  onSingleTouchStart?: (info: SingleTouchInfo) => void;
  onSingleTouchMove?: (info: SingleTouchInfo) => void;
  onSingleTouchEnd?: (info: SingleTouchInfo) => void;
}

export interface TouchCanvasHandlers {
  onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerCancel: (event: React.PointerEvent<SVGSVGElement>) => void;
}

function isTouchLike(pointerType: string): boolean {
  const t = pointerType.toLowerCase();
  return t === 'touch' || t === 'pen';
}

function getCanvasPointFromEvent(
  svg: SVGSVGElement,
  panOffset: Point,
  zoom: number,
  clientX: number,
  clientY: number
): Point {
  const rect = svg.getBoundingClientRect();
  const xOnSvg = clientX - rect.left;
  const yOnSvg = clientY - rect.top;
  return {
    x: (xOnSvg - panOffset.x) / zoom,
    y: (yOnSvg - panOffset.y) / zoom
  };
}

function toPointerLikeEvent(event: React.PointerEvent<SVGSVGElement>): PointerLikeEvent {
  return {
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    clientX: event.clientX,
    clientY: event.clientY
  };
}

function getTouchSnapshots(state: TouchState): PointerSnapshot[] {
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

function getScreenDistance(snapshots: PointerSnapshot[]): number {
  if (snapshots.length < 2) return 0;
  const a = snapshots[0];
  const b = snapshots[1];
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

const pinchConfig: PinchPanConfig = {
  minZoom: 0.1,
  maxZoom: 10
};

export function useTouchCanvas(options: TouchCanvasOptions): TouchCanvasHandlers {
  const stateRef = useRef<TouchState>(createInitialTouchState());
  const pinchContextRef = useRef<PinchPanContext | null>(null);
  const touchEnabledRef = useRef<boolean | null>(null);

  if (touchEnabledRef.current === null) {
    touchEnabledRef.current = shouldEnableTouch();
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (!touchEnabledRef.current) return;
    if (!isTouchLike(event.pointerType)) return;
    const svg = options.svgRef.current;
    if (!svg) return;

    const canvasPoint = getCanvasPointFromEvent(
      svg,
      options.panOffset,
      options.zoom,
      event.clientX,
      event.clientY
    );

    const prevState = stateRef.current;
    const { nextState } = applyPointerDown(prevState, toPointerLikeEvent(event), canvasPoint);
    stateRef.current = nextState;

    debugTouch({
      type: 'pointer',
      phase: 'down',
      data: {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        gestureMode: nextState.gestureMode
      }
    });

    if (nextState.gestureMode === 'singlePointer' && prevState.gestureMode !== 'singlePointer') {
      if (options.onSingleTouchStart) {
        options.onSingleTouchStart({
          clientX: event.clientX,
          clientY: event.clientY,
          canvasPoint,
          shiftKey: event.shiftKey,
          isPrimary: event.isPrimary ?? true,
          detail: event.detail,
          target: event.target
        });
      }
    }

    if (nextState.gestureMode === 'pinchPan' && prevState.gestureMode !== 'pinchPan') {
      const snapshots = getTouchSnapshots(nextState);
      if (snapshots.length >= 2) {
        const center = getCanvasCenter(snapshots);
        const initialDistance = getScreenDistance(snapshots);
        if (initialDistance > 0) {
          pinchContextRef.current = {
            initialTransform: {
              zoom: options.zoom,
              panOffset: options.panOffset
            },
            initialCenter: center,
            initialDistance
          };

          debugTouch({
            type: 'gesture',
            phase: 'pinch-start',
            data: {
              center,
              initialDistance,
              zoom: options.zoom,
              panOffset: options.panOffset
            }
          });
        }
      }
    }

    if (nextState.gestureMode !== 'pinchPan') {
      pinchContextRef.current = null;
    }

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      void 0;
    }
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!touchEnabledRef.current) return;
    if (!isTouchLike(event.pointerType)) return;
    const svg = options.svgRef.current;
    if (!svg) return;

    const canvasPoint = getCanvasPointFromEvent(
      svg,
      options.panOffset,
      options.zoom,
      event.clientX,
      event.clientY
    );

    const prevState = stateRef.current;
    const { nextState } = applyPointerMove(prevState, toPointerLikeEvent(event), canvasPoint);
    stateRef.current = nextState;

    if (nextState.gestureMode === 'singlePointer' && options.onSingleTouchMove) {
      options.onSingleTouchMove({
        clientX: event.clientX,
        clientY: event.clientY,
        canvasPoint,
        shiftKey: event.shiftKey,
        isPrimary: event.isPrimary ?? true,
        detail: event.detail,
        target: event.target
      });
    }

    if (nextState.gestureMode === 'pinchPan' && pinchContextRef.current && !options.isEditing && !options.isCropping) {
      const result = computePinchPan({
        state: nextState,
        config: pinchConfig,
        context: pinchContextRef.current
      });
      if (result) {
        options.onPanZoomChange(result.transform);

        debugTouch({
          type: 'gesture',
          phase: 'pinch-move',
          data: {
            zoom: result.transform.zoom,
            panOffset: result.transform.panOffset
          }
        });
      }
    }

    if (nextState.gestureMode !== 'pinchPan') {
      pinchContextRef.current = null;
    }
  }

  function handlePointerEnd(
    event: React.PointerEvent<SVGSVGElement>,
    resolver: typeof applyPointerUp | typeof applyPointerCancel
  ) {
    if (!touchEnabledRef.current) return;
    if (!isTouchLike(event.pointerType)) return;

    const wasSinglePointer = stateRef.current.gestureMode === 'singlePointer';
    let canvasPoint: Point | null = null;
    const svg = options.svgRef.current;
    if (svg) {
      canvasPoint = getCanvasPointFromEvent(
        svg,
        options.panOffset,
        options.zoom,
        event.clientX,
        event.clientY
      );
    }

    const prevState = stateRef.current;
    const { nextState } = resolver(prevState, toPointerLikeEvent(event));
    stateRef.current = nextState;

    if (wasSinglePointer && options.onSingleTouchEnd && canvasPoint) {
      options.onSingleTouchEnd({
        clientX: event.clientX,
        clientY: event.clientY,
        canvasPoint,
        shiftKey: event.shiftKey,
        isPrimary: event.isPrimary ?? true,
        detail: event.detail,
        target: event.target
      });
    }

    debugTouch({
      type: 'pointer',
      phase: resolver === applyPointerUp ? 'up' : 'cancel',
      data: {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        gestureMode: nextState.gestureMode
      }
    });

    if (nextState.gestureMode !== 'pinchPan') {
      pinchContextRef.current = null;
    }

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      void 0;
    }
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    handlePointerEnd(event, applyPointerUp);
  }

  function handlePointerCancel(event: React.PointerEvent<SVGSVGElement>) {
    handlePointerEnd(event, applyPointerCancel);
  }

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel
  };
}
