import type { Element, Point } from '@/types';
import { getElementBounds } from '@/utils/canvas';

export type Rect = { x: number; y: number; width: number; height: number };

export const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      (yi > point.y) !== (yj > point.y) &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) isInside = !isInside;
  }
  return isInside;
};

export const getSelectionBounds = (
  selectionIds: string[],
  elements: Element[],
): Rect => {
  const selectedElements = elements.filter(el => selectionIds.includes(el.id));
  if (selectedElements.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  selectedElements.forEach(el => {
    const bounds = getElementBounds(el, elements);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  });

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

