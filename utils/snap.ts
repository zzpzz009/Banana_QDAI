import type { Element, Point } from '@/types';
import { getElementBounds } from '@/utils/canvas';
import type { Rect } from '@/utils/selection';

export type Guide = {
  type: 'v' | 'h';
  position: number;
  start: number;
  end: number;
};

export const SNAP_THRESHOLD = 5;

export interface DragSnapInput {
  elements: Element[];
  dragStartElementPositions: Map<string, { x: number; y: number } | Point[]>;
  dx: number;
  dy: number;
  zoom: number;
}

export interface DragSnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

export const computeDragSnapping = (input: DragSnapInput): DragSnapResult => {
  const { elements, dragStartElementPositions, dx, dy, zoom } = input;

  const movingElementIds = Array.from(dragStartElementPositions.keys());
  const movingElements = elements.filter(el => movingElementIds.includes(el.id));
  const otherElements = elements.filter(el => !movingElementIds.includes(el.id));
  const snapThresholdCanvas = SNAP_THRESHOLD / zoom;

  let finalDx = dx;
  let finalDy = dy;
  const activeGuides: Guide[] = [];

  const getSnapPoints = (bounds: Rect) => ({
    v: [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width],
    h: [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height],
  });

  const staticSnapPoints = {
    v: new Set<number>(),
    h: new Set<number>(),
  };

  otherElements.forEach(el => {
    const bounds = getElementBounds(el);
    const points = getSnapPoints(bounds);
    points.v.forEach(p => staticSnapPoints.v.add(p));
    points.h.forEach(p => staticSnapPoints.h.add(p));
  });

  let bestSnapX: { dist: number; val: number; guide: Guide | null } = {
    dist: Infinity,
    val: finalDx,
    guide: null,
  };
  let bestSnapY: { dist: number; val: number; guide: Guide | null } = {
    dist: Infinity,
    val: finalDy,
    guide: null,
  };

  movingElements.forEach(movingEl => {
    const startPos = dragStartElementPositions.get(movingEl.id);
    if (!startPos) return;

    let movingBounds: Rect;
    if (
      movingEl.type !== 'path' &&
      movingEl.type !== 'arrow' &&
      movingEl.type !== 'line'
    ) {
      const base = startPos as { x: number; y: number };
      movingBounds = getElementBounds(
        { ...movingEl, x: base.x, y: base.y } as Element,
        elements,
      );
    } else if (movingEl.type === 'arrow' || movingEl.type === 'line') {
      const base = startPos as [Point, Point];
      movingBounds = getElementBounds(
        { ...movingEl, points: base } as Element,
        elements,
      );
    } else {
      const base = startPos as Point[];
      movingBounds = getElementBounds(
        { ...movingEl, points: base } as Element,
        elements,
      );
    }

    const movingSnapPoints = getSnapPoints(movingBounds);

    movingSnapPoints.v.forEach(p => {
      staticSnapPoints.v.forEach(staticP => {
        const dist = Math.abs(p + finalDx - staticP);
        if (dist < snapThresholdCanvas && dist < bestSnapX.dist) {
          bestSnapX = {
            dist,
            val: staticP - p,
            guide: {
              type: 'v',
              position: staticP,
              start: movingBounds.y,
              end: movingBounds.y + movingBounds.height,
            },
          };
        }
      });
    });

    movingSnapPoints.h.forEach(p => {
      staticSnapPoints.h.forEach(staticP => {
        const dist = Math.abs(p + finalDy - staticP);
        if (dist < snapThresholdCanvas && dist < bestSnapY.dist) {
          bestSnapY = {
            dist,
            val: staticP - p,
            guide: {
              type: 'h',
              position: staticP,
              start: movingBounds.x,
              end: movingBounds.x + movingBounds.width,
            },
          };
        }
      });
    });
  });

  if (bestSnapX.guide) {
    finalDx = bestSnapX.val;
    activeGuides.push(bestSnapX.guide);
  }

  if (bestSnapY.guide) {
    finalDy = bestSnapY.val;
    activeGuides.push(bestSnapY.guide);
  }

  return { dx: finalDx, dy: finalDy, guides: activeGuides };
};

