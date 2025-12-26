import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Point, WheelAction } from '@/types';

export interface UseCanvasViewportOptions {
  svgRef: RefObject<SVGSVGElement>;
  zoom: number;
  panOffset: Point;
  wheelAction: WheelAction;
  isWheelDisabled: boolean;
  onViewportChange: (updater: (prev: { zoom: number; panOffset: Point }) => { zoom: number; panOffset: Point }) => void;
}

export interface UseCanvasViewportResult {
  getCanvasPoint: (screenX: number, screenY: number) => Point;
}

export function useCanvasViewport(options: UseCanvasViewportOptions): UseCanvasViewportResult {
  const { svgRef, zoom, panOffset, wheelAction, isWheelDisabled, onViewportChange } = options;
  const wheelRafRef = useRef<number | null>(null);
  const wheelLastEventRef = useRef<{ clientX: number; clientY: number; deltaX: number; deltaY: number; ctrlKey: boolean } | null>(null);

  const getCanvasPoint = useCallback((screenX: number, screenY: number): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svgBounds = svgRef.current.getBoundingClientRect();
    const xOnSvg = screenX - svgBounds.left;
    const yOnSvg = screenY - svgBounds.top;
    return {
      x: (xOnSvg - panOffset.x) / zoom,
      y: (yOnSvg - panOffset.y) / zoom,
    };
  }, [svgRef, panOffset, zoom]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const listener = (e: WheelEvent) => {
      if (isWheelDisabled) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      const { clientX, clientY, deltaX, deltaY, ctrlKey } = e;
      wheelLastEventRef.current = { clientX, clientY, deltaX, deltaY, ctrlKey };
      if (wheelRafRef.current == null) {
        wheelRafRef.current = requestAnimationFrame(() => {
          wheelRafRef.current = null;
          const last = wheelLastEventRef.current;
          if (!last) return;
          onViewportChange(prev => {
            if (last.ctrlKey || wheelAction === 'zoom') {
              const zoomFactor = 1.05;
              const oldZoom = prev.zoom;
              const newZoom = last.deltaY < 0 ? oldZoom * zoomFactor : oldZoom / zoomFactor;
              const clampedZoom = Math.max(0.1, Math.min(newZoom, 10));
              const mousePoint = { x: last.clientX, y: last.clientY };
              const newPanX = mousePoint.x - (mousePoint.x - prev.panOffset.x) * (clampedZoom / oldZoom);
              const newPanY = mousePoint.y - (mousePoint.y - prev.panOffset.y) * (clampedZoom / oldZoom);
              return { zoom: clampedZoom, panOffset: { x: newPanX, y: newPanY } };
            }
            return {
              zoom: prev.zoom,
              panOffset: { x: prev.panOffset.x - last.deltaX, y: prev.panOffset.y - last.deltaY },
            };
          });
        });
      }
    };
    el.addEventListener('wheel', listener, { passive: false });
    return () => {
      el.removeEventListener('wheel', listener as EventListener);
    };
  }, [svgRef, isWheelDisabled, wheelAction, onViewportChange]);

  return { getCanvasPoint };
}

