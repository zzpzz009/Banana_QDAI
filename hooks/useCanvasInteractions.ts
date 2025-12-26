import { useRef, useCallback, useState } from 'react';
import type React from 'react';
import type { RefObject } from 'react';
import type {
  Point,
  Tool,
  Element,
  ImageElement,
  ShapeElement,
  TextElement,
  ArrowElement,
  LineElement,
  VideoElement,
  Board,
  WheelAction,
} from '@/types';
import type { Rect } from '@/utils/selection';
import { isPointInPolygon } from '@/utils/selection';
import { computeDragSnapping, type Guide } from '@/utils/snap';
import { useTouchCanvas, type SingleTouchInfo } from '../src/touch/useTouchCanvas';

type CroppingState = { elementId: string; originalElement: ImageElement; cropBox: Rect };

type CanvasPointerDownParams = {
  clientX: number;
  clientY: number;
  detail: number;
  shiftKey: boolean;
  target: EventTarget | null;
  isMiddleButton: boolean;
  preventDefault?: () => void;
};

type CanvasPointerMoveParams = {
  clientX: number;
  clientY: number;
  shiftKey: boolean;
};

export interface UseCanvasInteractionsOptions {
  svgRef: RefObject<SVGSVGElement>;
  zoom: number;
  panOffset: Point;
  wheelAction: WheelAction;
  activeTool: Tool;
  drawingOptions: { strokeColor: string; strokeWidth: number };
  elements: Element[];
  elementsRef: React.MutableRefObject<Element[]>;
  selectedElementIds: string[];
  croppingState: CroppingState | null;
  cropAspectRatio: string | null;
  editingElement: { id: string; text: string } | null;
  contextMenu: { x: number; y: number; elementId: string | null } | null;
  selectionBox: Rect | null;
  lassoPath: Point[] | null;
  alignmentGuides: Guide[];
  getCanvasPoint: (screenX: number, screenY: number) => Point;
  getElementBounds: (element: Element, allElements: Element[]) => Rect;
  getSelectableElement: (elementId: string, allElements: Element[]) => Element | null;
  generateId: () => string;
  updateActiveBoardSilent: (updater: (board: Board) => Board) => void;
  setActiveTool: (tool: Tool) => void;
  setElements: (updater: (prev: Element[]) => Element[], commit?: boolean) => void;
  setSelectedElementIds: (updater: ((prev: string[]) => string[]) | string[]) => void;
  setCroppingState: (updater: ((prev: CroppingState | null) => CroppingState | null) | CroppingState | null) => void;
  setContextMenu: (next: { x: number; y: number; elementId: string | null } | null) => void;
  setEditingElement: (next: { id: string; text: string } | null) => void;
  setSelectionBox: (next: Rect | null) => void;
  setLassoPath: (updater: ((prev: Point[] | null) => Point[] | null) | Point[] | null) => void;
  setAlignmentGuides: (next: Guide[]) => void;
  commitAction: (updater: (prev: Element[]) => Element[]) => void;
}

export interface UseCanvasInteractionsResult {
  isPanning: boolean;
  handleMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void;
  handleMouseUp: () => void;
  touchHandlers: {
    onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
    onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => void;
    onPointerUp: (event: React.PointerEvent<SVGSVGElement>) => void;
    onPointerCancel: (event: React.PointerEvent<SVGSVGElement>) => void;
  };
}

export function useCanvasInteractions(options: UseCanvasInteractionsOptions): UseCanvasInteractionsResult {
  const {
    svgRef,
    zoom,
    panOffset,
    wheelAction,
    activeTool,
    drawingOptions,
    elements,
    elementsRef,
    selectedElementIds,
    croppingState,
    cropAspectRatio,
    editingElement,
    contextMenu,
    selectionBox,
    lassoPath,
    getCanvasPoint,
    getElementBounds,
    getSelectableElement,
    generateId,
    updateActiveBoardSilent,
    setActiveTool,
    setElements,
    setSelectedElementIds,
    setCroppingState,
    setContextMenu,
    setEditingElement,
    setSelectionBox,
    setLassoPath,
    setAlignmentGuides,
    commitAction,
  } = options;

  const [isPanning, setIsPanning] = useState(false);
  const interactionMode = useRef<string | null>(null);
  const startPoint = useRef<Point>({ x: 0, y: 0 });
  const currentDrawingElementId = useRef<string | null>(null);
  const resizeStartInfo = useRef<{
    originalElement: ImageElement | ShapeElement | TextElement | VideoElement;
    startCanvasPoint: Point;
    handle: string;
    shiftKey: boolean;
  } | null>(null);
  const cropStartInfo = useRef<{ originalCropBox: Rect; startCanvasPoint: Point } | null>(null);
  const dragStartElementPositions = useRef<Map<string, { x: number; y: number } | Point[]>>(new Map());
  const panRafRef = useRef<number | null>(null);
  const panLastPointRef = useRef<Point | null>(null);
  const touchLongPressTimeoutRef = useRef<number | null>(null);
  const touchLongPressStartInfoRef = useRef<SingleTouchInfo | null>(null);
  const touchSinglePendingRef = useRef(false);

  const clearTouchLongPress = useCallback(() => {
    if (touchLongPressTimeoutRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(touchLongPressTimeoutRef.current);
    }
    touchLongPressTimeoutRef.current = null;
    touchSinglePendingRef.current = false;
  }, []);

  const scheduleTouchLongPress = useCallback(
    (info: SingleTouchInfo) => {
      if (activeTool !== 'select') return;
      if (editingElement) return;
      if (croppingState) return;
      if (typeof window === 'undefined') return;
      clearTouchLongPress();
      touchLongPressStartInfoRef.current = info;
      touchSinglePendingRef.current = true;
      touchLongPressTimeoutRef.current = window.setTimeout(() => {
        const startInfo = touchLongPressStartInfoRef.current;
        if (!startInfo) return;
        if (!touchSinglePendingRef.current) return;
        const canvasPoint = startInfo.canvasPoint;
        touchSinglePendingRef.current = false;
        startPoint.current = { x: startInfo.clientX, y: startInfo.clientY };
        setSelectedElementIds([]);
        setSelectionBox({
          x: canvasPoint.x,
          y: canvasPoint.y,
          width: 0,
          height: 0,
        });
        interactionMode.current = 'selectBox';
      }, 500);
    },
    [activeTool, clearTouchLongPress, croppingState, editingElement, setSelectedElementIds, setSelectionBox],
  );

  const handleCanvasPointerDown = useCallback(
    (params: CanvasPointerDownParams) => {
      if (editingElement) return;
      if (contextMenu) setContextMenu(null);
      if (params.isMiddleButton) {
        interactionMode.current = 'pan';
        setIsPanning(true);
        startPoint.current = { x: params.clientX, y: params.clientY };
        if (params.preventDefault) params.preventDefault();
        return;
      }
      startPoint.current = { x: params.clientX, y: params.clientY };
        const canvasStartPoint = getCanvasPoint(params.clientX, params.clientY);
      const target = params.target as SVGElement | null;
      const handleName = target ? target.getAttribute('data-handle') : null;
        if (croppingState) {
        if (handleName) {
          interactionMode.current = `crop-${handleName}`;
          cropStartInfo.current = { originalCropBox: { ...croppingState.cropBox }, startCanvasPoint: canvasStartPoint };
        } else {
          const { cropBox } = croppingState;
          if (
            canvasStartPoint.x >= cropBox.x &&
            canvasStartPoint.x <= cropBox.x + cropBox.width &&
            canvasStartPoint.y >= cropBox.y &&
            canvasStartPoint.y <= cropBox.y + cropBox.height
          ) {
            interactionMode.current = 'crop-move';
            cropStartInfo.current = { originalCropBox: { ...croppingState.cropBox }, startCanvasPoint: canvasStartPoint };
          }
        }
        return;
      }
      if (activeTool === 'text') {
        const newText: TextElement = {
          id: generateId(),
          type: 'text',
          name: 'Text',
          x: canvasStartPoint.x,
          y: canvasStartPoint.y,
          width: 150,
          height: 40,
          text: 'Text',
          fontSize: 24,
          fontColor: drawingOptions.strokeColor,
        };
        setElements(prev => [...prev, newText], false);
        setSelectedElementIds([newText.id]);
        setEditingElement({ id: newText.id, text: newText.text });
        setActiveTool('select');
        return;
      }
      if (activeTool === 'pan') {
        interactionMode.current = 'pan';
        setIsPanning(true);
        return;
      }
      if (handleName && activeTool === 'select' && selectedElementIds.length === 1) {
        interactionMode.current = `resize-${handleName}`;
        const element = elements.find(el => el.id === selectedElementIds[0]) as ImageElement | ShapeElement | TextElement | VideoElement;
        resizeStartInfo.current = {
          originalElement: { ...element },
          startCanvasPoint: canvasStartPoint,
          handle: handleName,
          shiftKey: params.shiftKey,
        };
        return;
      }
      if (activeTool === 'draw' || activeTool === 'highlighter') {
        interactionMode.current = 'draw';
        const newPath: PathElement = {
          id: generateId(),
          type: 'path',
          name: 'Path',
          points: [canvasStartPoint],
          strokeColor: drawingOptions.strokeColor,
          strokeWidth: drawingOptions.strokeWidth,
          strokeOpacity: activeTool === 'highlighter' ? 0.5 : 1,
          x: 0,
          y: 0,
        };
        currentDrawingElementId.current = newPath.id;
        setElements(prev => [...prev, newPath], false);
      } else if (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'triangle') {
        interactionMode.current = 'drawShape';
        const newShape: ShapeElement = {
          id: generateId(),
          type: 'shape',
          name: activeTool.charAt(0).toUpperCase() + activeTool.slice(1),
          shapeType: activeTool,
          x: canvasStartPoint.x,
          y: canvasStartPoint.y,
          width: 0,
          height: 0,
          strokeColor: drawingOptions.strokeColor,
          strokeWidth: drawingOptions.strokeWidth,
          fillColor: 'transparent',
        };
        currentDrawingElementId.current = newShape.id;
        setElements(prev => [...prev, newShape], false);
      } else if (activeTool === 'arrow') {
        interactionMode.current = 'drawArrow';
        const newArrow: ArrowElement = {
          id: generateId(),
          type: 'arrow',
          name: 'Arrow',
          x: canvasStartPoint.x,
          y: canvasStartPoint.y,
          points: [canvasStartPoint, canvasStartPoint],
          strokeColor: drawingOptions.strokeColor,
          strokeWidth: drawingOptions.strokeWidth,
        };
        currentDrawingElementId.current = newArrow.id;
        setElements(prev => [...prev, newArrow], false);
      } else if (activeTool === 'line') {
        interactionMode.current = 'drawLine';
        const newLine: LineElement = {
          id: generateId(),
          type: 'line',
          name: 'Line',
          x: canvasStartPoint.x,
          y: canvasStartPoint.y,
          points: [canvasStartPoint, canvasStartPoint],
          strokeColor: drawingOptions.strokeColor,
          strokeWidth: drawingOptions.strokeWidth,
        };
        currentDrawingElementId.current = newLine.id;
        setElements(prev => [...prev, newLine], false);
      } else if (activeTool === 'erase') {
        interactionMode.current = 'erase';
      } else if (activeTool === 'lasso') {
        interactionMode.current = 'lasso';
        setLassoPath([canvasStartPoint]);
      } else if (activeTool === 'select') {
        const clickedElementId = target ? target.closest('[data-id]')?.getAttribute('data-id') : null;
        const selectableElement = clickedElementId ? getSelectableElement(clickedElementId, elementsRef.current) : null;
        const selectableElementId = selectableElement?.id;
        if (selectableElementId) {
          if (params.detail === 2 && elements.find(el => el.id === selectableElementId)?.type === 'text') {
            const textEl = elements.find(el => el.id === selectableElementId) as TextElement;
            setEditingElement({ id: textEl.id, text: textEl.text });
            return;
          }
          if (!params.shiftKey && !selectedElementIds.includes(selectableElementId)) {
            setSelectedElementIds([selectableElementId]);
          } else if (params.shiftKey) {
            setSelectedElementIds(prev =>
              prev.includes(selectableElementId) ? prev.filter(id => id !== selectableElementId) : [...prev, selectableElementId],
            );
          }
          interactionMode.current = 'dragElements';
          const idsToDrag = new Set<string>();
          if (selectedElementIds.length > 1 && selectedElementIds.includes(selectableElement.id)) {
            selectedElementIds.forEach(id => {
              const el = elementsRef.current.find(e => e.id === id);
              if (!el) return;
              if (el.type === 'group') {
                idsToDrag.add(el.id);
              } else {
                idsToDrag.add(el.id);
              }
            });
          } else {
            if (selectableElement.type === 'group') {
              elementsRef.current.forEach(desc => {
                if (desc.parentId === selectableElement.id) {
                  idsToDrag.add(desc.id);
                }
              });
            } else {
              idsToDrag.add(selectableElement.id);
            }
          }
          const initialPositions = new Map<string, { x: number; y: number } | Point[]>();
          elementsRef.current.forEach(el => {
            if (idsToDrag.has(el.id)) {
              if (el.type !== 'path' && el.type !== 'arrow' && el.type !== 'line') {
                initialPositions.set(el.id, { x: el.x, y: el.y });
              } else {
                initialPositions.set(el.id, el.points);
              }
            }
          });
          dragStartElementPositions.current = initialPositions;
        } else {
          setSelectedElementIds([]);
          interactionMode.current = 'selectBox';
          setSelectionBox({ x: canvasStartPoint.x, y: canvasStartPoint.y, width: 0, height: 0 });
        }
      }
    },
    [
      activeTool,
      contextMenu,
      croppingState,
      drawingOptions.strokeColor,
      drawingOptions.strokeWidth,
      editingElement,
      elements,
      elementsRef,
      generateId,
      getCanvasPoint,
      getSelectableElement,
      selectedElementIds,
      setActiveTool,
      setContextMenu,
      setEditingElement,
      setElements,
      setLassoPath,
      setSelectionBox,
      setSelectedElementIds,
    ],
  );

  const handleCanvasPointerMove = useCallback(
    (params: CanvasPointerMoveParams) => {
      if (!interactionMode.current) return;
      const point = getCanvasPoint(params.clientX, params.clientY);
      const startCanvasPoint = getCanvasPoint(startPoint.current.x, startPoint.current.y);
      if (interactionMode.current === 'erase') {
        const eraseRadius = drawingOptions.strokeWidth / zoom;
        const idsToDelete = new Set<string>();
        elements.forEach(el => {
          if (el.type === 'path') {
            for (let i = 0; i < el.points.length - 1; i++) {
              const distance = Math.hypot(point.x - el.points[i].x, point.y - el.points[i].y);
              if (distance < eraseRadius) {
                idsToDelete.add(el.id);
                return;
              }
            }
          }
        });
        if (idsToDelete.size > 0) {
          setElements(prev => prev.filter(el => !idsToDelete.has(el.id)), false);
        }
        return;
      }
      if (interactionMode.current.startsWith('resize-')) {
        if (!resizeStartInfo.current) return;
        const { originalElement, handle, startCanvasPoint: resizeStartPoint, shiftKey } = resizeStartInfo.current;
        let { x, y, width, height } = originalElement;
        const aspectRatio = originalElement.width / originalElement.height;
        const dx = point.x - resizeStartPoint.x;
        const dy = point.y - resizeStartPoint.y;
        if (handle.includes('r')) {
          width = originalElement.width + dx;
        }
        if (handle.includes('l')) {
          width = originalElement.width - dx;
          x = originalElement.x + dx;
        }
        if (handle.includes('b')) {
          height = originalElement.height + dy;
        }
        if (handle.includes('t')) {
          height = originalElement.height - dy;
          y = originalElement.y + dy;
        }
        if (originalElement.type !== 'text' && !shiftKey) {
          if (handle.includes('r') || handle.includes('l')) {
            height = width / aspectRatio;
            if (handle.includes('t')) y = originalElement.y + originalElement.height - height;
          } else {
            width = height * aspectRatio;
            if (handle.includes('l')) x = originalElement.x + originalElement.width - width;
          }
        }
        if (width < 1) {
          width = 1;
          x = originalElement.x + originalElement.width - 1;
        }
        if (height < 1) {
          height = 1;
          y = originalElement.y + originalElement.height - 1;
        }
        setElements(
          prev =>
            prev.map(el => (el.id === originalElement.id ? { ...el, x, y, width, height } : el)) as Element[],
          false,
        );
        return;
      }
        if (interactionMode.current === 'crop-move') {
        if (!croppingState || !cropStartInfo.current) return;
        const { originalCropBox, startCanvasPoint: cropStartPoint } = cropStartInfo.current;
        const { originalElement } = croppingState;
        const dx = point.x - cropStartPoint.x;
        const dy = point.y - cropStartPoint.y;
        let x = originalCropBox.x + dx;
        let y = originalCropBox.y + dy;
        const width = originalCropBox.width;
        const height = originalCropBox.height;
        if (x < originalElement.x) x = originalElement.x;
        if (y < originalElement.y) y = originalElement.y;
        if (x + width > originalElement.x + originalElement.width) x = originalElement.x + originalElement.width - width;
        if (y + height > originalElement.y + originalElement.height) y = originalElement.y + originalElement.height - height;
        setCroppingState(prev => (prev ? { ...prev, cropBox: { x, y, width, height } } : null));
        return;
      }
      if (interactionMode.current.startsWith('crop-')) {
        if (!croppingState || !cropStartInfo.current) return;
        const handle = interactionMode.current.split('-')[1];
        const { originalCropBox, startCanvasPoint: cropStartPoint } = cropStartInfo.current;
        let { x, y, width, height } = { ...originalCropBox };
        const { originalElement } = croppingState;
        const dx = point.x - cropStartPoint.x;
        const dy = point.y - cropStartPoint.y;
        if (handle.includes('r')) {
          width = originalCropBox.width + dx;
        }
        if (handle.includes('l')) {
          width = originalCropBox.width - dx;
          x = originalCropBox.x + dx;
        }
        if (handle.includes('b')) {
          height = originalCropBox.height + dy;
        }
        if (handle.includes('t')) {
          height = originalCropBox.height - dy;
          y = originalCropBox.y + dy;
        }
        if (x < originalElement.x) {
          width += x - originalElement.x;
          x = originalElement.x;
        }
        if (y < originalElement.y) {
          height += y - originalElement.y;
          y = originalElement.y;
        }
        if (x + width > originalElement.x + originalElement.width) {
          width = originalElement.x + originalElement.width - x;
        }
        if (y + height > originalElement.y + originalElement.height) {
          height = originalElement.y + originalElement.height - y;
        }
        const arVal = cropAspectRatio ? (() => {
          const parts = cropAspectRatio.split(':');
          if (parts.length !== 2) return null;
          const a = Number(parts[0]);
          const b = Number(parts[1]);
          if (!a || !b) return null;
          return a / b;
        })() : null;
        if (arVal) {
          if (handle.includes('r') || handle.includes('l')) {
            const nh = Math.max(1, Math.round(width / arVal));
            height = nh;
            if (handle.includes('t')) y = originalCropBox.y + originalCropBox.height - height;
          } else {
            const nw = Math.max(1, Math.round(height * arVal));
            width = nw;
            if (handle.includes('l')) x = originalCropBox.x + originalCropBox.width - width;
          }
          if (x < originalElement.x) x = originalElement.x;
          if (y < originalElement.y) y = originalElement.y;
          if (x + width > originalElement.x + originalElement.width) {
            const maxW = originalElement.x + originalElement.width - x;
            width = Math.max(1, Math.min(width, maxW));
            height = Math.max(1, Math.round(width / arVal));
            if (handle.includes('t')) y = originalCropBox.y + originalCropBox.height - height;
            if (handle.includes('l')) x = originalCropBox.x + originalCropBox.width - width;
          }
          if (y + height > originalElement.y + originalElement.height) {
            const maxH = originalElement.y + originalElement.height - y;
            height = Math.max(1, Math.min(height, maxH));
            width = Math.max(1, Math.round(height * arVal));
            if (handle.includes('t')) y = originalCropBox.y + originalCropBox.height - height;
            if (handle.includes('l')) x = originalCropBox.x + originalCropBox.width - width;
          }
        }
        if (width < 1) {
          width = 1;
          if (handle.includes('l')) {
            x = originalCropBox.x + originalCropBox.width - 1;
          }
        }
        if (height < 1) {
          height = 1;
          if (handle.includes('t')) {
            y = originalCropBox.y + originalCropBox.height - 1;
          }
        }
        setCroppingState(prev => (prev ? { ...prev, cropBox: { x, y, width, height } } : null));
        return;
      }
      switch (interactionMode.current) {
        case 'pan': {
          panLastPointRef.current = { x: params.clientX, y: params.clientY };
          if (panRafRef.current == null) {
            panRafRef.current = requestAnimationFrame(() => {
              panRafRef.current = null;
              const p = panLastPointRef.current;
              if (!p) return;
              const dx = p.x - startPoint.current.x;
              const dy = p.y - startPoint.current.y;
              updateActiveBoardSilent(b => ({ ...b, panOffset: { x: b.panOffset.x + dx, y: b.panOffset.y + dy } }));
              startPoint.current = { x: p.x, y: p.y };
            });
          }
          break;
        }
        case 'draw': {
          if (currentDrawingElementId.current) {
            setElements(prev => {
              return prev.map(el => {
                if (el.id === currentDrawingElementId.current && el.type === 'path') {
                  return { ...el, points: [...el.points, point] };
                }
                return el;
              });
            }, false);
          }
          break;
        }
        case 'lasso': {
          setLassoPath(prev => (prev ? [...prev, point] : [point]));
          break;
        }
        case 'drawShape': {
          if (currentDrawingElementId.current) {
            setElements(prev => {
              return prev.map(el => {
                if (el.id === currentDrawingElementId.current && el.type === 'shape') {
                  let newWidth = Math.abs(point.x - startCanvasPoint.x);
                  let newHeight = Math.abs(point.y - startCanvasPoint.y);
                  let newX = Math.min(point.x, startCanvasPoint.x);
                  let newY = Math.min(point.y, startCanvasPoint.y);
                  if (params.shiftKey) {
                    if (el.shapeType === 'rectangle' || el.shapeType === 'circle') {
                      const side = Math.max(newWidth, newHeight);
                      newWidth = side;
                      newHeight = side;
                    } else if (el.shapeType === 'triangle') {
                      newHeight = newWidth * (Math.sqrt(3) / 2);
                    }
                    if (point.x < startCanvasPoint.x) newX = startCanvasPoint.x - newWidth;
                    if (point.y < startCanvasPoint.y) newY = startCanvasPoint.y - newHeight;
                  }
                  return { ...el, x: newX, y: newY, width: newWidth, height: newHeight };
                }
                return el;
              });
            }, false);
          }
          break;
        }
        case 'drawArrow': {
          if (currentDrawingElementId.current) {
            setElements(prev => {
              return prev.map(el => {
                if (el.id === currentDrawingElementId.current && el.type === 'arrow') {
                  return { ...el, points: [el.points[0], point] };
                }
                return el;
              });
            }, false);
          }
          break;
        }
        case 'drawLine': {
          if (currentDrawingElementId.current) {
            setElements(prev => {
              return prev.map(el => {
                if (el.id === currentDrawingElementId.current && el.type === 'line') {
                  return { ...el, points: [el.points[0], point] };
                }
                return el;
              });
            }, false);
          }
          break;
        }
        case 'dragElements': {
          const dx = point.x - startCanvasPoint.x;
          const dy = point.y - startCanvasPoint.y;
          const { dx: finalDx, dy: finalDy, guides } = computeDragSnapping({
            elements,
            dragStartElementPositions: dragStartElementPositions.current,
            dx,
            dy,
            zoom,
          });
          setAlignmentGuides(guides);
          const movingElementIds = Array.from(dragStartElementPositions.current.keys());
          setElements(prev => {
            return prev.map(el => {
              if (movingElementIds.includes(el.id)) {
                const startPos = dragStartElementPositions.current.get(el.id);
                if (!startPos) return el;
                if (el.type !== 'path' && el.type !== 'arrow' && el.type !== 'line') {
                  return { ...el, x: (startPos as Point).x + finalDx, y: (startPos as Point).y + finalDy };
                }
                if (el.type === 'path') {
                  const startPoints = startPos as Point[];
                  const newPoints = startPoints.map(p => ({ x: p.x + finalDx, y: p.y + finalDy }));
                  const updatedEl: PathElement = { ...el, points: newPoints };
                  return updatedEl;
                } else if (el.type === 'arrow' || el.type === 'line') {
                  const startPoints = startPos as [Point, Point];
                  const newPoints: [Point, Point] = [
                    { x: startPoints[0].x + finalDx, y: startPoints[0].y + finalDy },
                    { x: startPoints[1].x + finalDx, y: startPoints[1].y + finalDy },
                  ];
                  const updatedEl = { ...el, points: newPoints };
                  return updatedEl;
                }
              }
              return el;
            });
          }, false);
          break;
        }
        case 'selectBox': {
          const newX = Math.min(point.x, startCanvasPoint.x);
          const newY = Math.min(point.y, startCanvasPoint.y);
          const newWidth = Math.abs(point.x - startCanvasPoint.x);
          const newHeight = Math.abs(point.y - startCanvasPoint.y);
          setSelectionBox({ x: newX, y: newY, width: newWidth, height: newHeight });
          break;
        }
      }
    },
    [
      cropAspectRatio,
      croppingState,
      drawingOptions.strokeWidth,
      elements,
      getCanvasPoint,
      setCroppingState,
      setElements,
      updateActiveBoardSilent,
      zoom,
      setAlignmentGuides,
      setLassoPath,
      setSelectionBox,
    ],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      handleCanvasPointerDown({
        clientX: e.clientX,
        clientY: e.clientY,
        detail: e.detail,
        shiftKey: e.shiftKey,
        target: e.target,
        isMiddleButton: e.button === 1,
        preventDefault: () => e.preventDefault(),
      });
    },
    [handleCanvasPointerDown],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      handleCanvasPointerMove({
        clientX: e.clientX,
        clientY: e.clientY,
        shiftKey: e.shiftKey,
      });
    },
    [handleCanvasPointerMove],
  );

  const handleMouseUp = useCallback(() => {
    if (interactionMode.current) {
      if (interactionMode.current === 'selectBox' && selectionBox) {
        const selectedIds: string[] = [];
        const { x: sx, y: sy, width: sw, height: sh } = selectionBox;
        elements.forEach(element => {
          const bounds = getElementBounds(element, elements);
          const { x: ex, y: ey, width: ew, height: eh } = bounds;
          if (sx < ex + ew && sx + sw > ex && sy < ey + eh && sy + sh > ey) {
            const selectable = getSelectableElement(element.id, elements);
            if (selectable) selectedIds.push(selectable.id);
          }
        });
        setSelectedElementIds([...new Set(selectedIds)]);
      } else if (interactionMode.current === 'lasso' && lassoPath && lassoPath.length > 2) {
        const selectedIds = elements
          .filter(el => {
            const bounds = getElementBounds(el, elements);
            const center: Point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
            return isPointInPolygon(center, lassoPath);
          })
          .map(el => getSelectableElement(el.id, elements)?.id)
          .filter((id): id is string => !!id);
        setSelectedElementIds(prev => [...new Set([...prev, ...selectedIds])]);
        setLassoPath(null);
      } else if (
        ['draw', 'drawShape', 'drawArrow', 'drawLine', 'dragElements', 'erase'].some(prefix => interactionMode.current?.startsWith(prefix)) ||
        interactionMode.current.startsWith('resize-')
      ) {
        commitAction(els => els);
      }
    }
    interactionMode.current = null;
    setIsPanning(false);
    currentDrawingElementId.current = null;
    setSelectionBox(null);
    setLassoPath(null);
    resizeStartInfo.current = null;
    cropStartInfo.current = null;
    setAlignmentGuides([]);
    dragStartElementPositions.current.clear();
  }, [commitAction, elements, getElementBounds, getSelectableElement, lassoPath, selectionBox, setAlignmentGuides, setIsPanning, setLassoPath, setSelectionBox, setSelectedElementIds]);

  const touchHandlers = useTouchCanvas({
    svgRef,
    zoom,
    panOffset,
    wheelAction,
    activeTool,
    isEditing: !!editingElement,
    isCropping: !!croppingState,
    onPanZoomChange: ({ zoom: nextZoom, panOffset: nextPanOffset }) => {
      updateActiveBoardSilent(b => ({
        ...b,
        zoom: nextZoom,
        panOffset: nextPanOffset,
      }));
    },
    onSingleTouchStart: (info: SingleTouchInfo) => {
      scheduleTouchLongPress(info);
      if (activeTool === 'select' && !editingElement && !croppingState) {
        return;
      }
      handleCanvasPointerDown({
        clientX: info.clientX,
        clientY: info.clientY,
        detail: info.detail,
        shiftKey: false,
        target: info.target,
        isMiddleButton: false,
      });
    },
    onSingleTouchMove: (info: SingleTouchInfo) => {
      const startInfo = touchLongPressStartInfoRef.current;
      if (startInfo) {
        const dx = info.canvasPoint.x - startInfo.canvasPoint.x;
        const dy = info.canvasPoint.y - startInfo.canvasPoint.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 5 && touchSinglePendingRef.current && activeTool === 'select' && !editingElement && !croppingState) {
          clearTouchLongPress();
          touchSinglePendingRef.current = false;
          interactionMode.current = 'pan';
          setIsPanning(true);
          startPoint.current = { x: info.clientX, y: info.clientY };
        } else if (distance > 5 && startInfo === touchLongPressStartInfoRef.current) {
          clearTouchLongPress();
        }
      }
      if (!touchSinglePendingRef.current || activeTool !== 'select' || editingElement || croppingState) {
        handleCanvasPointerMove({
          clientX: info.clientX,
          clientY: info.clientY,
          shiftKey: false,
        });
      }
    },
    onSingleTouchEnd: () => {
      clearTouchLongPress();
      touchLongPressStartInfoRef.current = null;
      handleMouseUp();
    },
  });

  return {
    isPanning,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    touchHandlers,
  };
}
