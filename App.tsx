





import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useBoardActions } from '@/hooks/useBoardActions';
import { Toolbar } from './components/Toolbar';
import { PromptBar } from './components/PromptBar';
import { Loader } from './components/Loader';
import { CanvasSettings } from './components/CanvasSettings';
import { LayerPanel } from './components/LayerPanel';
import { BoardPanel } from './components/BoardPanel';
import type { Tool, Point, Element, ImageElement, PathElement, ShapeElement, TextElement, ArrowElement, UserEffect, LineElement, WheelAction, GroupElement, Board, VideoElement } from './types';
import { rasterizeElement, rasterizeElements, flattenElementsToImage } from '@/utils/canvas';
import { editImage, generateImageFromText, generateVideo } from './services/geminiService';
import { fileToDataUrl } from './utils/fileUtils';
import { resizeBase64ToMax } from './utils/image';
import { translations } from './translations';
import { touchLastSessionPending } from '@/src/services/boardsStorage';

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const getElementBounds = (element: Element, allElements: Element[] = []): { x: number; y: number; width: number; height: number } => {
    if (element.type === 'group') {
        const children = allElements.filter(el => el.parentId === element.id);
        if (children.length === 0) {
            return { x: element.x, y: element.y, width: element.width, height: element.height };
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        children.forEach(child => {
            const bounds = getElementBounds(child, allElements);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    if (element.type === 'image' || element.type === 'shape' || element.type === 'text' || element.type === 'video') {
        return { x: element.x, y: element.y, width: element.width, height: element.height };
    }
    if (element.type === 'arrow' || element.type === 'line') {
        const { points } = element;
        const minX = Math.min(points[0].x, points[1].x);
        const maxX = Math.max(points[0].x, points[1].x);
        const minY = Math.min(points[0].y, points[1].y);
        const maxY = Math.max(points[0].y, points[1].y);
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    const { points } = element;
    if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = points[0].x, maxX = points[0].x;
    let minY = points[0].y, maxY = points[0].y;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

type Rect = { x: number; y: number; width: number; height: number };
type Guide = { type: 'v' | 'h'; position: number; start: number; end: number };
const SNAP_THRESHOLD = 5; // pixels in screen space

// Ray-casting algorithm to check if a point is inside a polygon
const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;
        const intersect = ((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
};

// moved to '@/utils/canvas'

// moved to '@/utils/canvas'

        
        

        

        

        

        
        
 


const rasterizeMask = (
    maskPaths: PathElement[],
    baseImage: ImageElement
): Promise<{ href: string; mimeType: 'image/png' }> => {
    return new Promise((resolve, reject) => {
        const { width, height, x: imageX, y: imageY } = baseImage;
        if (width <= 0 || height <= 0) {
            return reject(new Error('Base image has invalid dimensions.'));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return reject(new Error('Could not get canvas context for mask.'));
        }

        // Black background for areas to be kept
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);

        // White for areas to be inpainted
        ctx.strokeStyle = 'white';
        ctx.fillStyle = 'white';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        maskPaths.forEach(path => {
            ctx.lineWidth = path.strokeWidth;
            ctx.beginPath();
            
            if (path.points.length === 1) {
                const point = path.points[0];
                ctx.arc(point.x - imageX, point.y - imageY, path.strokeWidth / 2, 0, 2 * Math.PI);
                ctx.fill();
            } else if (path.points.length > 1) {
                const startPoint = path.points[0];
                ctx.moveTo(startPoint.x - imageX, startPoint.y - imageY);
                for (let i = 1; i < path.points.length; i++) {
                    const point = path.points[i];
                    ctx.lineTo(point.x - imageX, point.y - imageY);
                }
                ctx.stroke();
            }
        });

        resolve({ href: canvas.toDataURL('image/png'), mimeType: 'image/png' });
    });
};

const createNewBoard = (name: string): Board => {
    const id = generateId();
    return {
        id,
        name,
        elements: [],
        history: [[]],
        historyIndex: 0,
        panOffset: { x: 0, y: 0 },
        zoom: 1,
        canvasBackgroundColor: '#1f2937',
    };
};

const App: React.FC = () => {
    const [boards, setBoards] = useState<Board[]>(() => {
        const init = window.__BANANAPOD_INITIAL_BOARDS__
        if (init && Array.isArray(init) && init.length > 0) return init as Board[]
        return [createNewBoard('Board 1')]
    });
    const [activeBoardId, setActiveBoardId] = useState<string>(() => {
        const initId = window.__BANANAPOD_INITIAL_ACTIVE_BOARD_ID__
        if (initId && typeof initId === 'string') return initId
        return boards[0].id
    });

    const activeBoard = useMemo(() => boards.find(b => b.id === activeBoardId) || boards[0], [boards, activeBoardId]);

    const { elements, history, historyIndex, panOffset, zoom, canvasBackgroundColor } = activeBoard;

    const [activeTool, setActiveTool] = useState<Tool>('select');
const [drawingOptions, setDrawingOptions] = useState({ strokeColor: '#FF0000', strokeWidth: 5 });
    const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
    const [selectionBox, setSelectionBox] = useState<Rect | null>(null);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
    const [isLayerPanelOpen, setIsLayerPanelOpen] = useState(false);
    const [isBoardPanelOpen, setIsBoardPanelOpen] = useState(false);
    const panRafRef = useRef<number | null>(null);
    const panLastPointRef = useRef<Point | null>(null);
    const wheelRafRef = useRef<number | null>(null);
    const wheelLastEventRef = useRef<{ clientX: number; clientY: number; deltaX: number; deltaY: number; ctrlKey: boolean } | null>(null);
    const [wheelAction, setWheelAction] = useState<WheelAction>('zoom');
    const [croppingState, setCroppingState] = useState<{ elementId: string; originalElement: ImageElement; cropBox: Rect } | null>(null);
    const [cropAspectRatio, setCropAspectRatio] = useState<string | null>(null);
    const [alignmentGuides, setAlignmentGuides] = useState<Guide[]>([]);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string | null } | null>(null);
    const [editingElement, setEditingElement] = useState<{ id: string; text: string; } | null>(null);
    const [lassoPath, setLassoPath] = useState<Point[] | null>(null);

    const [language, setLanguage] = useState<'en' | 'zho'>('zho');
    const [apiKey, setApiKey] = useState<string>(() => {
        try {
            return localStorage.getItem('WHATAI_API_KEY') || '';
        } catch {
            return '';
        }
    });
    const [systemToken, setSystemToken] = useState<string>(() => {
        try {
            return localStorage.getItem('WHATAI_SYSTEM_TOKEN') || '';
        } catch { return ''; }
    });
    const [userId, setUserId] = useState<string>(() => {
        try {
            return localStorage.getItem('WHATAI_USER_ID') || '';
        } catch { return ''; }
    });
    useEffect(() => {
        try {
            if (apiKey) localStorage.setItem('WHATAI_API_KEY', apiKey);
            else localStorage.removeItem('WHATAI_API_KEY');
        } catch { void 0; }
    }, [apiKey]);
    useEffect(() => {
        try {
            if (systemToken) localStorage.setItem('WHATAI_SYSTEM_TOKEN', systemToken);
            else localStorage.removeItem('WHATAI_SYSTEM_TOKEN');
        } catch { void 0; }
    }, [systemToken]);
    useEffect(() => {
        try {
            if (userId) localStorage.setItem('WHATAI_USER_ID', userId);
            else localStorage.removeItem('WHATAI_USER_ID');
        } catch { void 0; }
    }, [userId]);
    const [uiTheme, setUiTheme] = useState({ color: '#171717', opacity: 0.7 });
    const [buttonTheme, setButtonTheme] = useState({ color: '#374151', opacity: 0.8 });
    
    const [userEffects, setUserEffects] = useState<UserEffect[]>(() => {
        try {
            const saved = localStorage.getItem('userEffects');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error("Failed to parse user effects from localStorage", error);
            return [];
        }
    });
    
    const [generationMode, setGenerationMode] = useState<'image' | 'video'>('image');
    const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [imageModel, setImageModel] = useState<string>(() => {
        try {
            return localStorage.getItem('WHATAI_IMAGE_MODEL') || (process.env.WHATAI_IMAGE_MODEL as string) || 'gemini-2.5-flash-image';
        } catch {
            return (process.env.WHATAI_IMAGE_MODEL as string) || 'gemini-2.5-flash-image';
        }
    });
    const [imageSize, setImageSize] = useState<'1K' | '2K' | '4K'>(() => {
        return '1K';
    });
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key === 'WHATAI_IMAGE_MODEL') {
                setImageModel(e.newValue || 'gemini-2.5-flash-image');
            }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);
    useEffect(() => {
        const lower = (imageModel || '').toLowerCase();
        if (lower !== 'nano-banana-2') {
            setImageSize('1K');
        } else {
            setImageSize('1K');
        }
    }, [imageModel]);

    const interactionMode = useRef<string | null>(null);
    const startPoint = useRef<Point>({ x: 0, y: 0 });
    const currentDrawingElementId = useRef<string | null>(null);
    const resizeStartInfo = useRef<{ originalElement: ImageElement | ShapeElement | TextElement | VideoElement; startCanvasPoint: Point; handle: string; shiftKey: boolean } | null>(null);
    const cropStartInfo = useRef<{ originalCropBox: Rect, startCanvasPoint: Point } | null>(null);
    const dragStartElementPositions = useRef<Map<string, {x: number, y: number} | Point[]>>(new Map());
    const elementsRef = useRef(elements);
    const svgRef = useRef<SVGSVGElement>(null);
    const editingTextareaRef = useRef<HTMLTextAreaElement>(null);
    const previousToolRef = useRef<Tool>('select');
    const spacebarDownTime = useRef<number | null>(null);
    const promptBarRef = useRef<HTMLDivElement>(null);
    elementsRef.current = elements;

    const SUPPORTED_CROP_RATIOS = ['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'] as const;
    const parseRatio = (r: string | null): number | null => {
        if (!r) return null;
        const parts = r.split(':');
        if (parts.length !== 2) return null;
        const a = Number(parts[0]);
        const b = Number(parts[1]);
        if (!a || !b) return null;
        return a / b;
    };
    const nearestSupportedCropRatioBySize = (w?: number | null, h?: number | null): string | null => {
        if (!w || !h || w <= 0 || h <= 0) return null;
        const target = w / h;
        let best: string | null = null;
        let diffBest = Number.POSITIVE_INFINITY;
        for (const cand of SUPPORTED_CROP_RATIOS) {
            const [a, b] = cand.split(':').map(Number);
            if (!a || !b) continue;
            const val = a / b;
            const d = Math.abs(val - target);
            if (d < diffBest) { diffBest = d; best = cand; }
        }
        return best;
    };
    const fitCropToRatio = (element: ImageElement, ratioText: string): Rect => {
        const ar = parseRatio(ratioText) || (element.width / element.height);
        const W = element.width, H = element.height;
        let width: number, height: number;
        if (ar >= W / H) {
            width = W;
            height = Math.max(1, Math.round(width / ar));
        } else {
            height = H;
            width = Math.max(1, Math.round(height * ar));
        }
        const x = element.x + Math.round((W - width) / 2);
        const y = element.y + Math.round((H - height) / 2);
        return { x, y, width, height };
    };
    const handleCropAspectRatioChange = (value: string | null) => {
        setCropAspectRatio(value);
        setCroppingState(prev => {
            if (!prev) return prev;
            const { originalElement } = prev;
            if (value && SUPPORTED_CROP_RATIOS.includes(value as (typeof SUPPORTED_CROP_RATIOS)[number])) {
                const nextBox = fitCropToRatio(originalElement, value);
                return { ...prev, cropBox: nextBox };
            }
            return prev;
        });
    };

    

    

    useEffect(() => {
        setSelectedElementIds([]);
        setEditingElement(null);
        setCroppingState(null);
        setSelectionBox(null);
        setPrompt('');
    }, [activeBoardId]);
    
    useEffect(() => {
        try {
            localStorage.setItem('userEffects', JSON.stringify(userEffects));
        } catch (error) {
            console.error("Failed to save user effects to localStorage", error);
        }
    }, [userEffects]);

    const handleAddUserEffect = useCallback((effect: UserEffect) => {
        setUserEffects(prev => [...prev, effect]);
    }, []);

    const handleDeleteUserEffect = useCallback((id: string) => {
        setUserEffects(prev => prev.filter(effect => effect.id !== id));
    }, []);

    const t = useCallback((key: string, ...args: unknown[]): unknown => {
        const keys = key.split('.');
        let result: unknown = translations[language];
        for (const k of keys) {
            result = (result as Record<string, unknown> | undefined)?.[k];
        }
        if (typeof result === 'function') {
            return (result as (...a: unknown[]) => unknown)(...args);
        }
        return result || key;
    }, [language]);


    useEffect(() => {
        const root = document.documentElement;
        const hex = uiTheme.color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        root.style.setProperty('--ui-bg-color', `rgba(${r}, ${g}, ${b}, ${uiTheme.opacity})`);

        const btnHex = buttonTheme.color.replace('#', '');
        const btnR = parseInt(btnHex.substring(0, 2), 16);
        const btnG = parseInt(btnHex.substring(2, 4), 16);
        const btnB = parseInt(btnHex.substring(4, 6), 16);
        root.style.setProperty('--button-bg-color', `rgba(${btnR}, ${btnG}, ${btnB}, ${buttonTheme.opacity})`);
        // Tune animated gradient stops based on current canvas background color
        const clamp = (n: number) => Math.max(0, Math.min(255, n));
        const parseHex = (h: string) => {
            const clean = h.replace('#', '');
            return {
                r: parseInt(clean.substring(0, 2), 16),
                g: parseInt(clean.substring(2, 4), 16),
                b: parseInt(clean.substring(4, 6), 16),
            };
        };
        const adjust = (h: string, delta: number) => {
            const { r, g, b } = parseHex(h);
            return `rgb(${clamp(r + delta)}, ${clamp(g + delta)}, ${clamp(b + delta)})`;
        };
        // Organic but balanced contrast: slightly softer extremes, brighter mid
        root.style.setProperty('--bg-gradient-1', adjust(canvasBackgroundColor, -30));
        root.style.setProperty('--bg-gradient-2', adjust(canvasBackgroundColor, 50));
        root.style.setProperty('--bg-gradient-3', adjust(canvasBackgroundColor, -65));
    }, [uiTheme, buttonTheme, canvasBackgroundColor]);

    const { updateActiveBoard, updateActiveBoardSilent, setElements, commitAction, handleUndo, handleRedo, getDescendants } = useBoardActions(activeBoardId, setBoards);

    const handleMergeLayers = useCallback(async (mode: 'selected' | 'visible') => {
        const all = elementsRef.current || elements;
        // Collect elements to merge: selected (and their descendants), else all visible
        let idsToMerge = new Set<string>();
        if (mode === 'selected' && selectedElementIds.length > 0) {
            selectedElementIds.forEach(id => {
                idsToMerge.add(id);
                const el = all.find(e => e.id === id);
                if (el && el.type === 'group') {
                    getDescendants(id, all).forEach(desc => idsToMerge.add(desc.id));
                }
            });
        } else {
            all.forEach(el => {
                if (el.isVisible !== false) {
                    idsToMerge.add(el.id);
                    if (el.type === 'group') {
                        getDescendants(el.id, all).forEach(desc => idsToMerge.add(desc.id));
                    }
                }
            });
        }

        const elementsToFlatten = all.filter(el => idsToMerge.has(el.id) && el.type !== 'group');
        if (elementsToFlatten.length === 0) return;

        try {
            const flattened = await flattenElementsToImage(elementsToFlatten);
            const newImage: ImageElement = {
                id: generateId(),
                type: 'image',
                name: 'Merged Image',
                x: flattened.x,
                y: flattened.y,
                width: flattened.width,
                height: flattened.height,
                href: flattened.href,
                mimeType: flattened.mimeType,
                isLocked: false,
                isVisible: true,
            };

            commitAction(prev => {
                const keep = prev.filter(el => !idsToMerge.has(el.id));
                return [...keep, newImage];
            });
        } catch (e) {
            console.error(e);
            setError('合并图层失败：' + (e as Error).message);
        }
    }, [selectedElementIds, elements, commitAction, getDescendants]);


    const handleStopEditing = useCallback(() => {
        if (!editingElement) return;
        commitAction(prev => prev.map(el =>
            el.id === editingElement.id && el.type === 'text'
                ? { ...el, text: editingElement.text }
                // Persist auto-height change on blur
                : el.id === editingElement.id && el.type === 'text' && editingTextareaRef.current ? { ...el, text: editingElement.text, height: editingTextareaRef.current.scrollHeight }
                : el
        ));
        setEditingElement(null);
    }, [commitAction, editingElement]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (editingElement) {
                if(e.key === 'Escape') handleStopEditing();
                return;
            }

            const target = e.target as HTMLElement;
            const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); return; }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); handleRedo(); return; }
            
            if (!isTyping && (e.key === 'Delete' || e.key === 'Backspace') && selectedElementIds.length > 0) {
                e.preventDefault();
                commitAction(prev => {
                    const idsToDelete = new Set(selectedElementIds);
                    selectedElementIds.forEach(id => {
                        getDescendants(id, prev).forEach(desc => idsToDelete.add(desc.id));
                    });
                    return prev.filter(el => !idsToDelete.has(el.id));
                });
                setSelectedElementIds([]);
                return;
            }

            if (e.key === ' ' && !isTyping) {
                e.preventDefault();
                if (spacebarDownTime.current === null) {
                    spacebarDownTime.current = Date.now();
                    previousToolRef.current = activeTool;
                    setActiveTool('pan');
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === ' ' && !editingElement) {
                const target = e.target as HTMLElement;
                const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
                if (isTyping || spacebarDownTime.current === null) return;
                
                e.preventDefault();

                const duration = Date.now() - spacebarDownTime.current;
                spacebarDownTime.current = null;
                
                const toolBeforePan = previousToolRef.current;

                if (duration < 200) { // Tap
                    if (toolBeforePan === 'pan') {
                        setActiveTool('select');
                    } else if (toolBeforePan === 'select') {
                        setActiveTool('pan');
                    } else {
                        setActiveTool('select');
                    }
                } else { // Hold
                    setActiveTool(toolBeforePan);
                }
            }
        };


        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleUndo, handleRedo, selectedElementIds, editingElement, activeTool, commitAction, getDescendants, handleStopEditing]);
    
    const getCanvasPoint = useCallback((screenX: number, screenY: number): Point => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const svgBounds = svgRef.current.getBoundingClientRect();
        const xOnSvg = screenX - svgBounds.left;
        const yOnSvg = screenY - svgBounds.top;
        
        return {
            x: (xOnSvg - panOffset.x) / zoom,
            y: (yOnSvg - panOffset.y) / zoom,
        };
    }, [panOffset, zoom]);

    const handleAddImageElement = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            setError('Only image files are supported.');
            return;
        }
        setError(null);
        try {
            const { dataUrl, mimeType } = await fileToDataUrl(file);
            const resized = await resizeBase64ToMax(dataUrl, mimeType, 2048, 2048);
            const usedDataUrl = resized && resized.scale < 1 ? `data:${mimeType};base64,${resized.base64}` : dataUrl;
            const img = new Image();
            img.onload = () => {
                if (!svgRef.current) return;
                const svgBounds = svgRef.current.getBoundingClientRect();
                const screenCenter = { x: svgBounds.left + svgBounds.width / 2, y: svgBounds.top + svgBounds.height / 2 };
                const canvasPoint = getCanvasPoint(screenCenter.x, screenCenter.y);

                const newImage: ImageElement = {
                    id: generateId(),
                    type: 'image',
                    name: file.name,
                    x: canvasPoint.x - (img.width / 2),
                    y: canvasPoint.y - (img.height / 2),
                    width: img.width,
                    height: img.height,
                    href: usedDataUrl,
                    mimeType: mimeType,
                    opacity: 100,
                };
                setElements(prev => [...prev, newImage]);
                setSelectedElementIds([newImage.id]);
                setActiveTool('select');
            };
            img.src = usedDataUrl;
        } catch (err) {
            setError('Failed to load image.');
            console.error(err);
        }
    }, [getCanvasPoint, setElements]);

     const getSelectableElement = (elementId: string, allElements: Element[]): Element | null => {
        const element = allElements.find(el => el.id === elementId);
        if (!element) return null;
        if (element.isLocked) return null;

        let current = element;
        while (current.parentId) {
            const parent = allElements.find(el => el.id === current.parentId);
            if (!parent) return current; // Orphaned, treat as top-level
            if (parent.isLocked) return null; // Parent is locked, nothing inside is selectable
            current = parent;
        }
        return current;
    };
    
    const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
        if (editingElement) return;
        if (contextMenu) setContextMenu(null);

        if (e.button === 1) { // Middle mouse button for panning
            interactionMode.current = 'pan';
            startPoint.current = { x: e.clientX, y: e.clientY };
            e.preventDefault();
            return;
        }

        startPoint.current = { x: e.clientX, y: e.clientY };
        const canvasStartPoint = getCanvasPoint(e.clientX, e.clientY);

        const target = e.target as SVGElement;
        const handleName = target.getAttribute('data-handle');

        if (croppingState) {
            if (handleName) {
                interactionMode.current = `crop-${handleName}`;
                cropStartInfo.current = { originalCropBox: { ...croppingState.cropBox }, startCanvasPoint: canvasStartPoint };
            } else {
                const { cropBox } = croppingState;
                if (canvasStartPoint.x >= cropBox.x && canvasStartPoint.x <= cropBox.x + cropBox.width && canvasStartPoint.y >= cropBox.y && canvasStartPoint.y <= cropBox.y + cropBox.height) {
                    interactionMode.current = 'crop-move';
                    cropStartInfo.current = { originalCropBox: { ...croppingState.cropBox }, startCanvasPoint: canvasStartPoint };
                }
            }
            return;
        }
         if (activeTool === 'text') {
            const newText: TextElement = {
                id: generateId(), type: 'text', name: 'Text',
                x: canvasStartPoint.x, y: canvasStartPoint.y,
                width: 150, height: 40,
                text: "Text", fontSize: 24, fontColor: drawingOptions.strokeColor
            };
            setElements(prev => [...prev, newText]);
            setSelectedElementIds([newText.id]);
            setEditingElement({ id: newText.id, text: newText.text });
            setActiveTool('select');
            return;
        }

        if (activeTool === 'pan') {
            interactionMode.current = 'pan';
            return;
        }
        
        if (handleName && activeTool === 'select' && selectedElementIds.length === 1) {
            interactionMode.current = `resize-${handleName}`;
            const element = elements.find(el => el.id === selectedElementIds[0]) as ImageElement | ShapeElement | TextElement | VideoElement;
            resizeStartInfo.current = {
                originalElement: { ...element },
                startCanvasPoint: canvasStartPoint,
                handle: handleName,
                shiftKey: e.shiftKey,
            };
            return;
        }

        if (activeTool === 'draw' || activeTool === 'highlighter') {
            interactionMode.current = 'draw';
            const newPath: PathElement = {
                id: generateId(),
                type: 'path', name: 'Path',
                points: [canvasStartPoint],
                strokeColor: drawingOptions.strokeColor,
                strokeWidth: drawingOptions.strokeWidth,
                strokeOpacity: activeTool === 'highlighter' ? 0.5 : 1,
                x: 0, y: 0 
            };
            currentDrawingElementId.current = newPath.id;
            setElements(prev => [...prev, newPath], false);
        } else if (activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'triangle') {
            interactionMode.current = 'drawShape';
            const newShape: ShapeElement = {
                id: generateId(),
                type: 'shape', name: activeTool.charAt(0).toUpperCase() + activeTool.slice(1),
                shapeType: activeTool,
                x: canvasStartPoint.x,
                y: canvasStartPoint.y,
                width: 0,
                height: 0,
                strokeColor: drawingOptions.strokeColor,
                strokeWidth: drawingOptions.strokeWidth,
                fillColor: 'transparent',
            }
            currentDrawingElementId.current = newShape.id;
            setElements(prev => [...prev, newShape], false);
        } else if (activeTool === 'arrow') {
            interactionMode.current = 'drawArrow';
            const newArrow: ArrowElement = {
                id: generateId(), type: 'arrow', name: 'Arrow',
                x: canvasStartPoint.x, y: canvasStartPoint.y,
                points: [canvasStartPoint, canvasStartPoint],
                strokeColor: drawingOptions.strokeColor, strokeWidth: drawingOptions.strokeWidth
            };
            currentDrawingElementId.current = newArrow.id;
            setElements(prev => [...prev, newArrow], false);
        } else if (activeTool === 'line') {
            interactionMode.current = 'drawLine';
            const newLine: LineElement = {
                id: generateId(), type: 'line', name: 'Line',
                x: canvasStartPoint.x, y: canvasStartPoint.y,
                points: [canvasStartPoint, canvasStartPoint],
                strokeColor: drawingOptions.strokeColor, strokeWidth: drawingOptions.strokeWidth
            };
            currentDrawingElementId.current = newLine.id;
            setElements(prev => [...prev, newLine], false);
        } else if (activeTool === 'erase') {
            interactionMode.current = 'erase';
        } else if (activeTool === 'lasso') {
            interactionMode.current = 'lasso';
            setLassoPath([canvasStartPoint]);
        } else if (activeTool === 'select') {
            const clickedElementId = target.closest('[data-id]')?.getAttribute('data-id');
            const selectableElement = clickedElementId ? getSelectableElement(clickedElementId, elementsRef.current) : null;
            const selectableElementId = selectableElement?.id;

            if (selectableElementId) {
                if (e.detail === 2 && elements.find(el => el.id === selectableElementId)?.type === 'text') {
                     const textEl = elements.find(el => el.id === selectableElementId) as TextElement;
                     setEditingElement({ id: textEl.id, text: textEl.text });
                     return;
                }
                if (!e.shiftKey && !selectedElementIds.includes(selectableElementId)) {
                     setSelectedElementIds([selectableElementId]);
                } else if (e.shiftKey) {
                    setSelectedElementIds(prev => 
                        prev.includes(selectableElementId) ? prev.filter(id => id !== selectableElementId) : [...prev, selectableElementId]
                    );
                }
                interactionMode.current = 'dragElements';
                const idsToDrag = new Set<string>();
                if (selectedElementIds.length > 1 && selectedElementIds.includes(selectableElement.id)) {
                    selectedElementIds.forEach(id => {
                        const el = elementsRef.current.find(e => e.id === id);
                        if (!el) return;
                        if (el.type === 'group') {
                            getDescendants(el.id, elementsRef.current).forEach(desc => idsToDrag.add(desc.id));
                        } else {
                            idsToDrag.add(el.id);
                        }
                    });
                } else {
                    if (selectableElement.type === 'group') {
                        getDescendants(selectableElement.id, elementsRef.current).forEach(desc => idsToDrag.add(desc.id));
                    } else {
                        idsToDrag.add(selectableElement.id);
                    }
                }

                 const initialPositions = new Map<string, {x: number, y: number} | Point[]>();
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
    };

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        if (!interactionMode.current) return;
        const point = getCanvasPoint(e.clientX, e.clientY);
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

            if (handle.includes('r')) { width = originalElement.width + dx; }
            if (handle.includes('l')) { width = originalElement.width - dx; x = originalElement.x + dx; }
            if (handle.includes('b')) { height = originalElement.height + dy; }
            if (handle.includes('t')) { height = originalElement.height - dy; y = originalElement.y + dy; }

            if (originalElement.type !== 'text' && !shiftKey) {
                if (handle.includes('r') || handle.includes('l')) {
                    height = width / aspectRatio;
                    if (handle.includes('t')) y = (originalElement.y + originalElement.height) - height;
                } else {
                    width = height * aspectRatio;
                    if (handle.includes('l')) x = (originalElement.x + originalElement.width) - width;
                }
            }

            if (width < 1) { width = 1; x = originalElement.x + originalElement.width - 1; }
            if (height < 1) { height = 1; y = originalElement.y + originalElement.height - 1; }

            setElements(prev => prev.map(el =>
                el.id === originalElement.id ? { ...el, x, y, width, height } : el
            ), false);
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

            setCroppingState(prev => prev ? { ...prev, cropBox: { x, y, width, height } } : null);
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

            if (handle.includes('r')) { width = originalCropBox.width + dx; }
            if (handle.includes('l')) { width = originalCropBox.width - dx; x = originalCropBox.x + dx; }
            if (handle.includes('b')) { height = originalCropBox.height + dy; }
            if (handle.includes('t')) { height = originalCropBox.height - dy; y = originalCropBox.y + dy; }
            
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

            const arVal = parseRatio(cropAspectRatio);
            
            if (arVal) {
                if (handle.includes('r') || handle.includes('l')) {
                    const nh = Math.max(1, Math.round(width / arVal));
                    height = nh;
                    if (handle.includes('t')) y = (originalCropBox.y + originalCropBox.height) - height;
                } else {
                    const nw = Math.max(1, Math.round(height * arVal));
                    width = nw;
                    if (handle.includes('l')) x = (originalCropBox.x + originalCropBox.width) - width;
                }

                if (x < originalElement.x) x = originalElement.x;
                if (y < originalElement.y) y = originalElement.y;
                if (x + width > originalElement.x + originalElement.width) {
                    const maxW = (originalElement.x + originalElement.width) - x;
                    width = Math.max(1, Math.min(width, maxW));
                    height = Math.max(1, Math.round(width / arVal));
                    if (handle.includes('t')) y = (originalCropBox.y + originalCropBox.height) - height;
                    if (handle.includes('l')) x = (originalCropBox.x + originalCropBox.width) - width;
                }
                if (y + height > originalElement.y + originalElement.height) {
                    const maxH = (originalElement.y + originalElement.height) - y;
                    height = Math.max(1, Math.min(height, maxH));
                    width = Math.max(1, Math.round(height * arVal));
                    if (handle.includes('t')) y = (originalCropBox.y + originalCropBox.height) - height;
                    if (handle.includes('l')) x = (originalCropBox.x + originalCropBox.width) - width;
                }
            }

            if (width < 1) {
                width = 1;
                if (handle.includes('l')) { x = originalCropBox.x + originalCropBox.width - 1; }
            }
            if (height < 1) {
                height = 1;
                if (handle.includes('t')) { y = originalCropBox.y + originalCropBox.height - 1; }
            }

            setCroppingState(prev => prev ? { ...prev, cropBox: { x, y, width, height } } : null);
            return;
        }


        switch(interactionMode.current) {
            case 'pan': {
                panLastPointRef.current = { x: e.clientX, y: e.clientY };
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
                    setElements(prev => prev.map(el => {
                        if (el.id === currentDrawingElementId.current && el.type === 'path') {
                            return { ...el, points: [...el.points, point] };
                        }
                        return el;
                    }), false);
                }
                break;
            }
            case 'lasso': {
                setLassoPath(prev => (prev ? [...prev, point] : [point]));
                break;
            }
            case 'drawShape': {
                 if (currentDrawingElementId.current) {
                    setElements(prev => prev.map(el => {
                        if (el.id === currentDrawingElementId.current && el.type === 'shape') {
                            let newWidth = Math.abs(point.x - startCanvasPoint.x);
                            let newHeight = Math.abs(point.y - startCanvasPoint.y);
                            let newX = Math.min(point.x, startCanvasPoint.x);
                            let newY = Math.min(point.y, startCanvasPoint.y);
                            
                            if (e.shiftKey) {
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

                            return {...el, x: newX, y: newY, width: newWidth, height: newHeight};
                        }
                        return el;
                    }), false);
                }
                break;
            }
            case 'drawArrow': {
                if (currentDrawingElementId.current) {
                    setElements(prev => prev.map(el => {
                        if (el.id === currentDrawingElementId.current && el.type === 'arrow') {
                            return { ...el, points: [el.points[0], point] };
                        }
                        return el;
                    }), false);
                }
                break;
            }
            case 'drawLine': {
                if (currentDrawingElementId.current) {
                    setElements(prev => prev.map(el => {
                        if (el.id === currentDrawingElementId.current && el.type === 'line') {
                            return { ...el, points: [el.points[0], point] };
                        }
                        return el;
                    }), false);
                }
                break;
            }
            case 'dragElements': {
                const dx = point.x - startCanvasPoint.x;
                const dy = point.y - startCanvasPoint.y;
                
                const movingElementIds = Array.from(dragStartElementPositions.current.keys());
                const movingElements = elements.filter(el => movingElementIds.includes(el.id));
                const otherElements = elements.filter(el => !movingElementIds.includes(el.id));
                const snapThresholdCanvas = SNAP_THRESHOLD / zoom;

                let finalDx = dx;
                let finalDy = dy;
                let activeGuides: Guide[] = [];

                // Alignment Snapping
                const getSnapPoints = (bounds: Rect) => ({
                    v: [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width],
                    h: [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height],
                });

                const staticSnapPoints = { v: new Set<number>(), h: new Set<number>() };
                otherElements.forEach(el => {
                    const bounds = getElementBounds(el);
                    getSnapPoints(bounds).v.forEach(p => staticSnapPoints.v.add(p));
                    getSnapPoints(bounds).h.forEach(p => staticSnapPoints.h.add(p));
                });
                
                let bestSnapX = { dist: Infinity, val: finalDx, guide: null as Guide | null };
                let bestSnapY = { dist: Infinity, val: finalDy, guide: null as Guide | null };
                
                movingElements.forEach(movingEl => {
                    const startPos = dragStartElementPositions.current.get(movingEl.id);
                    if (!startPos) return;

                    let movingBounds: Rect;
                     if (movingEl.type !== 'path' && movingEl.type !== 'arrow' && movingEl.type !== 'line') {
                        movingBounds = getElementBounds({...movingEl, x: (startPos as Point).x, y: (startPos as Point).y });
                    } else { // path or arrow or line
                        if (movingEl.type === 'arrow' || movingEl.type === 'line') {
                            movingBounds = getElementBounds({...movingEl, points: startPos as [Point, Point]});
                        } else {
                            movingBounds = getElementBounds({...movingEl, points: startPos as Point[]});
                        }
                    }

                    const movingSnapPoints = getSnapPoints(movingBounds);

                    movingSnapPoints.v.forEach(p => {
                        staticSnapPoints.v.forEach(staticP => {
                            const dist = Math.abs((p + finalDx) - staticP);
                            if (dist < snapThresholdCanvas && dist < bestSnapX.dist) {
                                bestSnapX = { dist, val: staticP - p, guide: { type: 'v', position: staticP, start: movingBounds.y, end: movingBounds.y + movingBounds.height }};
                            }
                        });
                    });
                    movingSnapPoints.h.forEach(p => {
                        staticSnapPoints.h.forEach(staticP => {
                            const dist = Math.abs((p + finalDy) - staticP);
                            if (dist < snapThresholdCanvas && dist < bestSnapY.dist) {
                                bestSnapY = { dist, val: staticP - p, guide: { type: 'h', position: staticP, start: movingBounds.x, end: movingBounds.x + movingBounds.width }};
                            }
                        });
                    });
                });
                
                if (bestSnapX.guide) { finalDx = bestSnapX.val; activeGuides.push(bestSnapX.guide); }
                if (bestSnapY.guide) { finalDy = bestSnapY.val; activeGuides.push(bestSnapY.guide); }
                
                setAlignmentGuides(activeGuides);

                setElements(prev => prev.map(el => {
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
                }), false);
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
    };
    
    const handleMouseUp = () => {
        if (interactionMode.current) {
            if (interactionMode.current === 'selectBox' && selectionBox) {
                const selectedIds: string[] = [];
                const { x: sx, y: sy, width: sw, height: sh } = selectionBox;
                
                elements.forEach(element => {
                    const bounds = getElementBounds(element, elements);
                    const { x: ex, y: ey, width: ew, height: eh } = bounds;
                    
                    if (sx < ex + ew && sx + sw > ex && sy < ey + eh && sy + sh > ey) {
                        const selectable = getSelectableElement(element.id, elements);
                        if(selectable) selectedIds.push(selectable.id);
                    }
                });
                setSelectedElementIds([...new Set(selectedIds)]);
            } else if (interactionMode.current === 'lasso' && lassoPath && lassoPath.length > 2) {
                const selectedIds = elements.filter(el => {
                    const bounds = getElementBounds(el, elements);
                    const center: Point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
                    return isPointInPolygon(center, lassoPath);
                }).map(el => getSelectableElement(el.id, elements)?.id).filter((id): id is string => !!id);
                setSelectedElementIds(prev => [...new Set([...prev, ...selectedIds])]);
                setLassoPath(null);
            } else if (['draw', 'drawShape', 'drawArrow', 'drawLine', 'dragElements', 'erase'].some(prefix => interactionMode.current?.startsWith(prefix)) || interactionMode.current.startsWith('resize-')) {
                 commitAction(els => els); // This effectively commits the current state to history
            }
        }
        
        interactionMode.current = null;
        currentDrawingElementId.current = null;
        setSelectionBox(null);
        setLassoPath(null);
        resizeStartInfo.current = null;
        cropStartInfo.current = null;
        setAlignmentGuides([]);
        dragStartElementPositions.current.clear();
    };

  

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
        const listener = (e: WheelEvent) => {
          if (croppingState || editingElement) { e.preventDefault(); return; }
          e.preventDefault();
          const { clientX, clientY, deltaX, deltaY, ctrlKey } = e;
          wheelLastEventRef.current = { clientX, clientY, deltaX, deltaY, ctrlKey };
          if (wheelRafRef.current == null) {
            wheelRafRef.current = requestAnimationFrame(() => {
              wheelRafRef.current = null;
              const last = wheelLastEventRef.current;
              if (!last) return;
              if (last.ctrlKey || wheelAction === 'zoom') {
                const zoomFactor = 1.05;
                const oldZoom = zoom;
                const newZoom = last.deltaY < 0 ? oldZoom * zoomFactor : oldZoom / zoomFactor;
                const clampedZoom = Math.max(0.1, Math.min(newZoom, 10));
                const mousePoint = { x: last.clientX, y: last.clientY };
                const newPanX = mousePoint.x - (mousePoint.x - panOffset.x) * (clampedZoom / oldZoom);
                const newPanY = mousePoint.y - (mousePoint.y - panOffset.y) * (clampedZoom / oldZoom);
                updateActiveBoardSilent(b => ({ ...b, zoom: clampedZoom, panOffset: { x: newPanX, y: newPanY } }));
              } else {
                updateActiveBoardSilent(b => ({ ...b, panOffset: { x: b.panOffset.x - last.deltaX, y: b.panOffset.y - last.deltaY } }));
              }
            });
          }
        };
    el.addEventListener('wheel', listener, { passive: false });
  return () => { el.removeEventListener('wheel', listener as EventListener); };
  }, [croppingState, editingElement, wheelAction, zoom, panOffset, updateActiveBoardSilent]);

    const handleDeleteElement = (id: string) => {
        commitAction(prev => {
            const idsToDelete = new Set([id]);
            getDescendants(id, prev).forEach(desc => idsToDelete.add(desc.id));
            return prev.filter(el => !idsToDelete.has(el.id));
        });
        setSelectedElementIds(prev => prev.filter(selId => selId !== id));
    };

    const handleCopyElement = (elementToCopy: Element) => {
        commitAction(prev => {
            const elementsToCopy = [elementToCopy, ...getDescendants(elementToCopy.id, prev)];
            const idMap = new Map<string, string>();
            
// FIX: Refactored element creation to use explicit switch cases for each element type.
// This helps TypeScript correctly infer the return type of the map function as Element[],
// preventing type errors caused by spreading a discriminated union.
            const newElements: Element[] = elementsToCopy.map((el): Element => {
                const newId = generateId();
                idMap.set(el.id, newId);
                const dx = 20 / zoom;
                const dy = 20 / zoom;

                switch (el.type) {
                    case 'path':
                        return { ...el, id: newId, points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
                    case 'arrow':
                        return { ...el, id: newId, points: [{ x: el.points[0].x + dx, y: el.points[0].y + dy }, { x: el.points[1].x + dx, y: el.points[1].y + dy }] as [Point, Point] };
                    case 'line':
                         return { ...el, id: newId, points: [{ x: el.points[0].x + dx, y: el.points[0].y + dy }, { x: el.points[1].x + dx, y: el.points[1].y + dy }] as [Point, Point] };
                    case 'image':
                        return { ...el, id: newId, x: el.x + dx, y: el.y + dy };
                    case 'shape':
                         return { ...el, id: newId, x: el.x + dx, y: el.y + dy };
                    case 'text':
                         return { ...el, id: newId, x: el.x + dx, y: el.y + dy };
                    case 'group':
                         return { ...el, id: newId, x: el.x + dx, y: el.y + dy };
                    case 'video':
                        return { ...el, id: newId, x: el.x + dx, y: el.y + dy };
                }
            });
            
// FIX: Refactored parentId assignment to use an explicit switch statement.
// This ensures TypeScript can correctly track the types within the Element union
// and avoids errors when returning the new array of elements.
            const finalNewElements: Element[] = newElements.map((el): Element => {
                const parentId = el.parentId ? idMap.get(el.parentId) : undefined;
                switch (el.type) {
                    case 'image': return { ...el, parentId };
                    case 'path': return { ...el, parentId };
                    case 'shape': return { ...el, parentId };
                    case 'text': return { ...el, parentId };
                    case 'arrow': return { ...el, parentId };
                    case 'line': return { ...el, parentId };
                    case 'group': return { ...el, parentId };
                    case 'video': return { ...el, parentId };
                }
            });
            
            setSelectedElementIds([idMap.get(elementToCopy.id)!]);
            return [...prev, ...finalNewElements];
        });
    };
    
     const handleDownloadImage = (element: ImageElement) => {
        const link = document.createElement('a');
        link.href = element.href;
        link.download = `canvas-image-${element.id}.${element.mimeType.split('/')[1] || 'png'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleStartCrop = (element: ImageElement) => {
        setActiveTool('select');
        const auto = nearestSupportedCropRatioBySize(element.width, element.height);
        setCropAspectRatio(auto);
        const initialBox = auto ? fitCropToRatio(element, auto) : { x: element.x, y: element.y, width: element.width, height: element.height };
        setCroppingState({
            elementId: element.id,
            originalElement: { ...element },
            cropBox: initialBox,
        });
    };

    const handleCancelCrop = () => setCroppingState(null);

    const handleConfirmCrop = () => {
        if (!croppingState) return;
        const { elementId, cropBox } = croppingState;
        const elementToCrop = elementsRef.current.find(el => el.id === elementId) as ImageElement;

        if (!elementToCrop) { handleCancelCrop(); return; }
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = cropBox.width;
            canvas.height = cropBox.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { setError("Failed to create canvas context for cropping."); handleCancelCrop(); return; }
            // 映射到原始图像像素坐标，避免因缩放导致错误裁剪
            const scaleX = img.width / elementToCrop.width;
            const scaleY = img.height / elementToCrop.height;
            let sx = (cropBox.x - elementToCrop.x) * scaleX;
            let sy = (cropBox.y - elementToCrop.y) * scaleY;
            let sWidth = cropBox.width * scaleX;
            let sHeight = cropBox.height * scaleY;
            // 越界保护
            if (sx < 0) { sWidth += sx; sx = 0; }
            if (sy < 0) { sHeight += sy; sy = 0; }
            if (sx + sWidth > img.width) { sWidth = img.width - sx; }
            if (sy + sHeight > img.height) { sHeight = img.height - sy; }
            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, cropBox.width, cropBox.height);
            const newHref = canvas.toDataURL(elementToCrop.mimeType);

            commitAction(prev => prev.map(el => {
                if (el.id === elementId && el.type === 'image') {
                    const updatedEl: ImageElement = {
                        ...el,
                        href: newHref,
                        x: cropBox.x,
                        y: cropBox.y,
                        width: cropBox.width,
                        height: cropBox.height
                    };
                    return updatedEl;
                }
                return el;
            }));
            handleCancelCrop();
        };
        img.onerror = () => { setError("Failed to load image for cropping."); handleCancelCrop(); }
        img.src = elementToCrop.href;
    };
    
    useEffect(() => {
        if (editingElement && editingTextareaRef.current) {
            setTimeout(() => {
                if (editingTextareaRef.current) {
                    editingTextareaRef.current.focus();
                    editingTextareaRef.current.select();
                }
            }, 0);
        }
    }, [editingElement]);
    
    useEffect(() => {
        if (editingElement && editingTextareaRef.current) {
            const textarea = editingTextareaRef.current;
            textarea.style.height = 'auto';
            const newHeight = textarea.scrollHeight;
            textarea.style.height = ''; 

            const currentElement = elementsRef.current.find(el => el.id === editingElement.id);
            if (currentElement && currentElement.type === 'text' && currentElement.height !== newHeight) {
                setElements(prev => prev.map(el => 
                    el.id === editingElement.id && el.type === 'text' 
                    ? { ...el, height: newHeight } 
                    : el
                ), false);
            }
        }
    }, [editingElement, setElements]);


    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError('Please enter a prompt.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setProgressMessage('Starting generation...');

        if (generationMode === 'video') {
            try {
                const selectedElements = elements.filter(el => selectedElementIds.includes(el.id));
                const imageElement = selectedElements.find(el => el.type === 'image') as ImageElement | undefined;
                
                if (selectedElementIds.length > 1 || (selectedElementIds.length === 1 && !imageElement)) {
                    setError('For video generation, please select a single image or no elements.');
                    setIsLoading(false);
                    return;
                }
                
                const { videoBlob, mimeType } = await generateVideo(
                    prompt, 
                    videoAspectRatio, 
                    (message) => setProgressMessage(message), 
                    imageElement ? { href: imageElement.href, mimeType: imageElement.mimeType } : undefined
                );

                setProgressMessage('Processing video...');
                const videoUrl = URL.createObjectURL(videoBlob);
                const video = document.createElement('video');
                
                video.onloadedmetadata = () => {
                    if (!svgRef.current) return;
                    
                    let newWidth = video.videoWidth;
                    let newHeight = video.videoHeight;
                    const MAX_DIM = 800;
                    if (newWidth > MAX_DIM || newHeight > MAX_DIM) {
                        const ratio = newWidth / newHeight;
                        if (ratio > 1) { // landscape
                            newWidth = MAX_DIM;
                            newHeight = MAX_DIM / ratio;
                        } else { // portrait or square
                            newHeight = MAX_DIM;
                            newWidth = MAX_DIM * ratio;
                        }
                    }

                    const svgBounds = svgRef.current.getBoundingClientRect();
                    const screenCenter = { x: svgBounds.left + svgBounds.width / 2, y: svgBounds.top + svgBounds.height / 2 };
                    const canvasPoint = getCanvasPoint(screenCenter.x, screenCenter.y);
                    const x = canvasPoint.x - (newWidth / 2);
                    const y = canvasPoint.y - (newHeight / 2);

                    const newVideoElement: VideoElement = {
                        id: generateId(), type: 'video', name: 'Generated Video',
                        x, y,
                        width: newWidth,
                        height: newHeight,
                        href: videoUrl,
                        mimeType,
                    };

                    commitAction(prev => [...prev, newVideoElement]);
                    setSelectedElementIds([newVideoElement.id]);
                    setIsLoading(false);
                };

                video.onerror = () => {
                    setError('Could not load generated video metadata.');
                    setIsLoading(false);
                };
                
                video.src = videoUrl;

            } catch (err) {
                 const error = err as Error; 
                 setError(`Video generation failed: ${error.message}`); 
                 console.error("Video generation failed:", error);
                 setIsLoading(false);
            }
            return;
        }


        // IMAGE GENERATION LOGIC
        try {
            const isEditing = selectedElementIds.length > 0;

            if (isEditing) {
                const selectedElements = elements.filter(el => selectedElementIds.includes(el.id));
                const imageElements = selectedElements.filter(el => el.type === 'image') as ImageElement[];
                const maskPaths = selectedElements.filter(el => el.type === 'path' && el.strokeOpacity && el.strokeOpacity < 1) as PathElement[];

                // Inpainting logic: selection is ONLY one image and one or more mask paths
                if (imageElements.length === 1 && maskPaths.length > 0 && selectedElements.length === (1 + maskPaths.length)) {
                    const baseImage = imageElements[0];
                    const maskData = await rasterizeMask(maskPaths, baseImage);
                    const result = await editImage(
                        [{ href: baseImage.href, mimeType: baseImage.mimeType }],
                        prompt,
                        { href: maskData.href, mimeType: maskData.mimeType },
                        imageSize
                    );
                    
                    if (result.newImageBase64 && result.newImageMimeType) {
                        const { newImageBase64, newImageMimeType } = result;

                    loadImageWithFallback(newImageBase64, newImageMimeType).then(({ img, href }) => {
                        const maskPathIds = new Set(maskPaths.map(p => p.id));
                        commitAction(prev => 
                            prev.map(el => {
                                if (el.id === baseImage.id && el.type === 'image') {
                                    return {
                                        ...el,
                                        href,
                                        width: img.width,
                                        height: img.height,
                                    };
                                }
                                return el;
                            }).filter(el => !maskPathIds.has(el.id))
                        );
                        setSelectedElementIds([baseImage.id]);
                    }).catch(() => setError('Failed to load the generated image.'));

                    } else {
                        setError(result.textResponse || 'Inpainting failed to produce an image.');
                    }
                    return; // End execution for inpainting path
                }
                
                // Regular edit/combine logic
                const imagePromises = selectedElements.map(el => {
                    if (el.type === 'image') return Promise.resolve({ href: el.href, mimeType: el.mimeType });
                    if (el.type === 'video') return Promise.reject(new Error("Cannot use video elements in image generation."));
                    return rasterizeElement(el as Exclude<Element, ImageElement | VideoElement>);
                });
                const imagesToProcess = await Promise.all(imagePromises);
                const result = await editImage(imagesToProcess, prompt, undefined, imageSize);

                if (result.newImageBase64 && result.newImageMimeType) {
                    const { newImageBase64, newImageMimeType } = result;
                    
                    loadImageWithFallback(newImageBase64, newImageMimeType).then(({ img, href }) => {
                        let minX = Infinity, minY = Infinity, maxX = -Infinity;
                        selectedElements.forEach(el => {
                            const bounds = getElementBounds(el);
                            minX = Math.min(minX, bounds.x);
                            minY = Math.min(minY, bounds.y);
                            maxX = Math.max(maxX, bounds.x + bounds.width);
                        });
                        const x = maxX + 20;
                        const y = minY;
                        
                        const newImage: ImageElement = {
                            id: generateId(), type: 'image', x, y, name: 'Generated Image',
                            width: img.width, height: img.height,
                            href, mimeType: newImageMimeType,
                        };
                        commitAction(prev => [...prev, newImage]);
                        setSelectedElementIds([newImage.id]);
                    }).catch(() => setError('Failed to load the generated image.'));
                } else {
                    setError(result.textResponse || 'Generation failed to produce an image.');
                }

            } else {
                // Generate from scratch
                let aspectRatio: string | undefined = undefined;
                if (svgRef.current) {
                    const b = svgRef.current.getBoundingClientRect();
                    const w = Math.max(1, Math.floor(b.width));
                    const h = Math.max(1, Math.floor(b.height));
                    const r = w / h;
                    const list = [
                        { ar: '1:1', v: 1 },
                        { ar: '16:9', v: 16/9 },
                        { ar: '4:3', v: 4/3 },
                        { ar: '3:2', v: 3/2 },
                        { ar: '2:3', v: 2/3 },
                        { ar: '3:4', v: 3/4 },
                        { ar: '9:16', v: 9/16 },
                    ];
                    let best = list[0];
                    let bestDiff = Math.abs(r - best.v);
                    for (let i = 1; i < list.length; i++) {
                        const d = Math.abs(r - list[i].v);
                        if (d < bestDiff) { best = list[i]; bestDiff = d; }
                    }
                    aspectRatio = best.ar;
                }
                const result = await generateImageFromText(prompt, undefined, { aspectRatio, imageSize });

                if (result.newImageBase64 && result.newImageMimeType) {
                    const { newImageBase64, newImageMimeType } = result;
                    
                    loadImageWithFallback(newImageBase64, newImageMimeType).then(({ img, href }) => {
                        if (!svgRef.current) return;
                        const svgBounds = svgRef.current.getBoundingClientRect();
                        const screenCenter = { x: svgBounds.left + svgBounds.width / 2, y: svgBounds.top + svgBounds.height / 2 };
                        const canvasPoint = getCanvasPoint(screenCenter.x, screenCenter.y);
                        const x = canvasPoint.x - (img.width / 2);
                        const y = canvasPoint.y - (img.height / 2);
                        
                        const newImage: ImageElement = {
                            id: generateId(), type: 'image', x, y, name: 'Generated Image',
                            width: img.width, height: img.height,
                            href, mimeType: newImageMimeType,
                        };
                        commitAction(prev => [...prev, newImage]);
                        setSelectedElementIds([newImage.id]);
                    }).catch(() => setError('Failed to load the generated image.'));
                } else { 
                    setError(result.textResponse || 'Generation failed to produce an image.'); 
                }
            }
        } catch (err) {
            const error = err as Error; 
            let friendlyMessage = `An error occurred during generation: ${error.message}`;

            if (error.message && (error.message.includes('429') || error.message.toUpperCase().includes('RESOURCE_EXHAUSTED'))) {
                friendlyMessage = "API quota exceeded. Please check your Google AI Studio plan and billing details, or try again later.";
            }

            setError(friendlyMessage); 
            console.error("Generation failed:", error);
        } finally { 
            setIsLoading(false); 
        }
    };
    
    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);
    const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.files && e.dataTransfer.files[0]) { handleAddImageElement(e.dataTransfer.files[0]); } }, [handleAddImageElement]);

    const handlePropertyChange = (elementId: string, updates: Partial<Element>) => {
        commitAction(prev => prev.map(el => {
            if (el.id === elementId) {
                 return { ...el, ...updates };
            }
            return el;
        }));
    };

     const handleLayerAction = (elementId: string, action: 'front' | 'back' | 'forward' | 'backward') => {
        commitAction(prev => {
            const elementsCopy = [...prev];
            const index = elementsCopy.findIndex(el => el.id === elementId);
            if (index === -1) return elementsCopy;

            const [element] = elementsCopy.splice(index, 1);

            if (action === 'front') {
                elementsCopy.push(element);
            } else if (action === 'back') {
                elementsCopy.unshift(element);
            } else if (action === 'forward') {
                const newIndex = Math.min(elementsCopy.length, index + 1);
                elementsCopy.splice(newIndex, 0, element);
            } else if (action === 'backward') {
                const newIndex = Math.max(0, index - 1);
                elementsCopy.splice(newIndex, 0, element);
            }
            return elementsCopy;
        });
        setContextMenu(null);
    };
    
    const handleRasterizeSelection = async () => {
        const elementsToRasterize = elements.filter(
            el => selectedElementIds.includes(el.id) && el.type !== 'image' && el.type !== 'video'
        ) as Exclude<Element, ImageElement | VideoElement>[];

        if (elementsToRasterize.length === 0) return;

        setContextMenu(null);
        setIsLoading(true);
        setError(null);

        try {
            let minX = Infinity, minY = Infinity;
            elementsToRasterize.forEach(element => {
                const bounds = getElementBounds(element);
                minX = Math.min(minX, bounds.x);
                minY = Math.min(minY, bounds.y);
            });
            
            const { href, mimeType, width, height } = await rasterizeElements(elementsToRasterize);
            
            const newImage: ImageElement = {
                id: generateId(),
                type: 'image', name: 'Rasterized Image',
                x: minX - 10, // Account for padding used during rasterization
                y: minY - 10, // Account for padding
                width,
                height,
                href,
                mimeType
            };

            const idsToRemove = new Set(elementsToRasterize.map(el => el.id));

            commitAction(prev => {
                const remainingElements = prev.filter(el => !idsToRemove.has(el.id));
                return [...remainingElements, newImage];
            });

            setSelectedElementIds([newImage.id]);

        } catch (err) {
            const error = err as Error;
            setError(`Failed to rasterize selection: ${error.message}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGroup = () => {
        const selectedElements = elements.filter(el => selectedElementIds.includes(el.id));
        if (selectedElements.length < 2) return;
        
        const bounds = getSelectionBounds(selectedElementIds);
        const newGroupId = generateId();

        const newGroup: GroupElement = {
            id: newGroupId,
            type: 'group',
            name: 'Group',
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
        };

        commitAction(prev => {
            const updatedElements = prev.map(el => 
                selectedElementIds.includes(el.id) ? { ...el, parentId: newGroupId } : el
            );
            return [...updatedElements, newGroup];
        });

        setSelectedElementIds([newGroupId]);
        setContextMenu(null);
    };

    const handleUngroup = () => {
        if (selectedElementIds.length !== 1) return;
        const groupId = selectedElementIds[0];
        const group = elements.find(el => el.id === groupId);
        if (!group || group.type !== 'group') return;

        const childrenIds: string[] = [];
        commitAction(prev => {
            return prev.map(el => {
                if (el.parentId === groupId) {
                    childrenIds.push(el.id);
                    return { ...el, parentId: undefined };
                }
                return el;
            }).filter(el => el.id !== groupId);
        });

        setSelectedElementIds(childrenIds);
        setContextMenu(null);
    };


    const handleContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
        e.preventDefault();
        setContextMenu(null);
        const target = e.target as SVGElement;
        const elementId = target.closest('[data-id]')?.getAttribute('data-id');
        setContextMenu({ x: e.clientX, y: e.clientY, elementId: elementId || null });
    };


    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => { if (e.clipboardData?.files[0]?.type.startsWith("image/")) { e.preventDefault(); handleAddImageElement(e.clipboardData.files[0]); } };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [handleAddImageElement]);

    const getSelectionBounds = useCallback((selectionIds: string[]): Rect => {
        const selectedElements = elementsRef.current.filter(el => selectionIds.includes(el.id));
        if (selectedElements.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        selectedElements.forEach(el => {
            const bounds = getElementBounds(el, elementsRef.current);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });

        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }, []);

    const handleAlignSelection = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
        const selectedElements = elementsRef.current.filter(el => selectedElementIds.includes(el.id));
        if (selectedElements.length < 2) return;
    
        const selectionBounds = getSelectionBounds(selectedElementIds);
        const { x: minX, y: minY, width, height } = selectionBounds;
        const maxX = minX + width;
        const maxY = minY + height;
    
        const selectionCenterX = minX + width / 2;
        const selectionCenterY = minY + height / 2;
    
        commitAction(prev => {
            const elementsToUpdate = new Map<string, { dx: number; dy: number }>();

            selectedElements.forEach(el => {
                const bounds = getElementBounds(el, prev);
                let dx = 0;
                let dy = 0;
        
                switch (alignment) {
                    case 'left':   dx = minX - bounds.x; break;
                    case 'center': dx = selectionCenterX - (bounds.x + bounds.width / 2); break;
                    case 'right':  dx = maxX - (bounds.x + bounds.width); break;
                    case 'top':    dy = minY - bounds.y; break;
                    case 'middle': dy = selectionCenterY - (bounds.y + bounds.height / 2); break;
                    case 'bottom': dy = maxY - (bounds.y + bounds.height); break;
                }
        
                if (dx !== 0 || dy !== 0) {
                    const elementsToMove = [el, ...getDescendants(el.id, prev)];
                    elementsToMove.forEach(elementToMove => {
                        if (!elementsToUpdate.has(elementToMove.id)) {
                            elementsToUpdate.set(elementToMove.id, { dx, dy });
                        }
                    });
                }
            });
            return prev.map((el): Element => {
                const delta = elementsToUpdate.get(el.id);
                if (!delta) {
                    return el;
                }

                const { dx, dy } = delta;
                
                switch (el.type) {
                    case 'image':
                    case 'shape':
                    case 'text':
                    case 'group':
                    case 'video':
                        return { ...el, x: el.x + dx, y: el.y + dy };
                    case 'arrow':
                    case 'line':
                        return { ...el, points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) as [Point, Point] };
                    case 'path':
                        return { ...el, points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
                }
            });
        });
    };

    const isElementVisible = useCallback((element: Element, allElements: Element[]): boolean => {
        if (element.isVisible === false) return false;
        if (element.parentId) {
            const parent = allElements.find(el => el.id === element.parentId);
            if (parent) {
                return isElementVisible(parent, allElements);
            }
        }
        return true;
    }, []);


    const isSelectionActive = selectedElementIds.length > 0;
    const singleSelectedElement = selectedElementIds.length === 1 ? elements.find(el => el.id === selectedElementIds[0]) : null;

    let cursor = 'default';
    if (croppingState) cursor = 'default';
    else if (interactionMode.current === 'pan') cursor = 'grabbing';
    else if (activeTool === 'pan') cursor = 'grab';
    else if (['draw', 'erase', 'rectangle', 'circle', 'triangle', 'arrow', 'line', 'text', 'highlighter', 'lasso'].includes(activeTool)) cursor = 'crosshair';

    // Board Management
    const handleAddBoard = () => {
        const newBoard = createNewBoard(`Board ${boards.length + 1}`);
        setBoards(prev => {
            const next = [...prev, newBoard];
            touchLastSessionPending({ boards: next, activeBoardId: newBoard.id });
            return next;
        });
        setActiveBoardId(newBoard.id);
    };

    const handleDuplicateBoard = (boardId: string) => {
        const boardToDuplicate = boards.find(b => b.id === boardId);
        if (!boardToDuplicate) return;
        const newBoard = {
            ...boardToDuplicate,
            id: generateId(),
            name: `${boardToDuplicate.name} Copy`,
            history: [boardToDuplicate.elements],
            historyIndex: 0,
        };
        setBoards(prev => {
            const next = [...prev, newBoard];
            touchLastSessionPending({ boards: next, activeBoardId: newBoard.id });
            return next;
        });
        setActiveBoardId(newBoard.id);
    };
    
    const handleDeleteBoard = (boardId: string) => {
        setBoards(prev => {
            if (prev.length <= 1) return prev;
            const next = prev.filter(b => b.id !== boardId);
            const newActiveId = activeBoardId === boardId && next.length > 0 ? next[0].id : activeBoardId;
            if (newActiveId !== activeBoardId) {
                setActiveBoardId(newActiveId);
            }
            touchLastSessionPending({ boards: next, activeBoardId: newActiveId });
            return next;
        });
    };
    
    const handleRenameBoard = (boardId: string, name: string) => {
        setBoards(prev => {
            const next = prev.map(b => b.id === boardId ? { ...b, name } : b);
            touchLastSessionPending({ boards: next, activeBoardId });
            return next;
        });
    };

    const handleCanvasBackgroundColorChange = (color: string) => {
        updateActiveBoard(b => ({ ...b, canvasBackgroundColor: color }));
    };

    const generateBoardThumbnail = useCallback((elements: Element[], bgColor: string): string => {
         const THUMB_WIDTH = 120;
         const THUMB_HEIGHT = 80;

        if (elements.length === 0) {
            const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_WIDTH}" height="${THUMB_HEIGHT}"><rect width="100%" height="100%" fill="${bgColor}" /></svg>`;
            return `data:image/svg+xml;base64,${btoa(emptySvg)}`;
        }
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        elements.forEach(el => {
            const bounds = getElementBounds(el, elements);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;

        if (contentWidth <= 0 || contentHeight <= 0) {
            const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_WIDTH}" height="${THUMB_HEIGHT}"><rect width="100%" height="100%" fill="${bgColor}" /></svg>`;
            return `data:image/svg+xml;base64,${btoa(emptySvg)}`;
        }

        const scale = Math.min(THUMB_WIDTH / contentWidth, THUMB_HEIGHT / contentHeight) * 0.9;
        const dx = (THUMB_WIDTH - contentWidth * scale) / 2 - minX * scale;
        const dy = (THUMB_HEIGHT - contentHeight * scale) / 2 - minY * scale;

        const svgContent = elements.map(el => {
             if (el.type === 'path') {
                const pathData = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                return `<path d="${pathData}" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${el.strokeOpacity || 1}" />`;
             }
             if (el.type === 'image') {
                 return `<image href="${el.href}" x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" opacity="${typeof el.opacity === 'number' ? el.opacity / 100 : 1}" />`;
             }
             // Add other element types for more accurate thumbnails if needed
             return '';
        }).join('');

        const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_WIDTH}" height="${THUMB_HEIGHT}"><rect width="100%" height="100%" fill="${bgColor}" /><g transform="translate(${dx} ${dy}) scale(${scale})">${svgContent}</g></svg>`;
        return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(fullSvg)))}`;
    }, []);

    return (
            <div className="w-screen h-screen flex flex-col font-sans podui-theme" onDragOver={handleDragOver} onDrop={handleDrop}>
            {isLoading && <Loader progressMessage={progressMessage} />}
            {error && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md shadow-lg flex items-center max-w-lg">
                    <span className="flex-grow">{error}</span>
                    <button onClick={() => setError(null)} className="ml-4 p-1 rounded-full hover:bg-red-200">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                    </button>
                </div>
            )}
            <BoardPanel
                isOpen={isBoardPanelOpen}
                onClose={() => setIsBoardPanelOpen(false)}
                boards={boards}
                activeBoardId={activeBoardId}
                onSwitchBoard={(id) => {
                    setActiveBoardId(id);
                    touchLastSessionPending({ boards, activeBoardId: id });
                    setIsBoardPanelOpen(false);
                }}
                onAddBoard={handleAddBoard}
                onRenameBoard={handleRenameBoard}
                onDuplicateBoard={handleDuplicateBoard}
                onDeleteBoard={handleDeleteBoard}
                generateBoardThumbnail={(els) => generateBoardThumbnail(els, activeBoard.canvasBackgroundColor)}
                onImportHistoryBoard={(snapshot) => {
                    const pad = (x: number) => String(x).padStart(2, '0');
                    const d = new Date(snapshot.savedAt);
                    const code = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
                    const newBoard = {
                        id: generateId(),
                        name: code,
                        elements: snapshot.elements,
                        history: [snapshot.elements],
                        historyIndex: 0,
                        panOffset: snapshot.panOffset || { x: 0, y: 0 },
                        zoom: snapshot.zoom || 1,
                        canvasBackgroundColor: snapshot.canvasBackgroundColor || activeBoard.canvasBackgroundColor,
                    } as Board
                    setBoards(prev => {
                        const next = [...prev, newBoard];
                        touchLastSessionPending({ boards: next, activeBoardId: newBoard.id });
                        return next;
                    })
                    setActiveBoardId(newBoard.id)
                    setIsBoardPanelOpen(false)
                }}
            />
            <CanvasSettings 
                isOpen={isSettingsPanelOpen} 
                onClose={() => setIsSettingsPanelOpen(false)} 
                canvasBackgroundColor={canvasBackgroundColor} 
                onCanvasBackgroundColorChange={handleCanvasBackgroundColorChange}
                language={language}
                setLanguage={setLanguage}
                uiTheme={uiTheme}
                setUiTheme={setUiTheme}
                buttonTheme={buttonTheme}
                setButtonTheme={setButtonTheme}
                wheelAction={wheelAction}
                setWheelAction={setWheelAction}
                t={t}
                apiKey={apiKey}
                setApiKey={setApiKey}
                systemToken={systemToken}
                setSystemToken={setSystemToken}
                userId={userId}
                setUserId={setUserId}
                imageModel={imageModel}
                setImageModel={setImageModel}
            />
            <Toolbar
                t={t}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                drawingOptions={drawingOptions}
                setDrawingOptions={setDrawingOptions}
                onUpload={handleAddImageElement}
                isCropping={!!croppingState}
                onConfirmCrop={handleConfirmCrop}
                onCancelCrop={handleCancelCrop}
                cropAspectRatio={cropAspectRatio}
                onCropAspectRatioChange={handleCropAspectRatioChange}
                onSettingsClick={() => setIsSettingsPanelOpen(true)}
                onLayersClick={() => setIsLayerPanelOpen(prev => !prev)}
                onBoardsClick={() => setIsBoardPanelOpen(prev => !prev)}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={historyIndex > 0}
                canRedo={historyIndex < history.length - 1}
            />
             <LayerPanel
                isOpen={isLayerPanelOpen}
                onClose={() => setIsLayerPanelOpen(false)}
                elements={elements}
                selectedElementIds={selectedElementIds}
                onSelectElement={id => setSelectedElementIds(id ? [id] : [])}
                onToggleVisibility={id => handlePropertyChange(id, { isVisible: !(elements.find(el => el.id === id)?.isVisible ?? true) })}
                onToggleLock={id => handlePropertyChange(id, { isLocked: !(elements.find(el => el.id === id)?.isLocked ?? false) })}
                onRenameElement={(id, name) => handlePropertyChange(id, { name })}
                onMergeLayers={handleMergeLayers}
                onReorder={(draggedId, targetId, position) => {
                    commitAction(prev => {
                        const newElements = [...prev];
                        const draggedIndex = newElements.findIndex(el => el.id === draggedId);
                        if (draggedIndex === -1) return prev;

                        const [draggedItem] = newElements.splice(draggedIndex, 1);
                        const targetIndex = newElements.findIndex(el => el.id === targetId);
                        if (targetIndex === -1) {
                            newElements.push(draggedItem); // Fallback
                            return newElements;
                        }
                        
                        const finalIndex = position === 'before' ? targetIndex : targetIndex + 1;
                        newElements.splice(finalIndex, 0, draggedItem);
                        
                        return newElements;
                    });
                }}
            />
            <div className="flex-grow relative overflow-hidden">
                <svg
                    ref={svgRef}
                    className="w-full h-full"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onContextMenu={handleContextMenu}
                    style={{ cursor }}
                >
                    <defs>
                        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <circle cx="1" cy="1" r="1" style={{ fill: 'var(--grid-dot-color)', opacity: 'var(--grid-dot-opacity)' }}/>
                        </pattern>
                         {elements.map(el => {
                            if (el.type === 'image' && el.borderRadius && el.borderRadius > 0) {
                                const clipPathId = `clip-${el.id}`;
                                return (
                                    <clipPath id={clipPathId} key={clipPathId}>
                                        <rect
                                            width={el.width}
                                            height={el.height}
                                            rx={el.borderRadius}
                                            ry={el.borderRadius}
                                        />
                                    </clipPath>
                                );
                            }
                            return null;
                        })}
                    </defs>
                    <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
                        <rect x={-panOffset.x/zoom} y={-panOffset.y/zoom} width={`calc(100% / ${zoom})`} height={`calc(100% / ${zoom})`} fill="url(#grid)" />
                        
                        {elements.map(el => {
                            if (!isElementVisible(el, elements)) return null;

                            const isSelected = selectedElementIds.includes(el.id);
                            let selectionComponent = null;

                            if (isSelected && !croppingState) {
                                if (selectedElementIds.length > 1 || el.type === 'path' || el.type === 'arrow' || el.type === 'line' || el.type === 'group') {
                                     const bounds = getElementBounds(el, elements);
                                     selectionComponent = <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill="none" stroke="rgb(59 130 246)" strokeWidth={2/zoom} strokeDasharray={`${6/zoom} ${4/zoom}`} pointerEvents="none" />
                                } else if ((el.type === 'image' || el.type === 'shape' || el.type === 'text' || el.type === 'video')) {
                                    const handleSize = 8 / zoom;
                                    const handles = [
                                        { name: 'tl', x: el.x, y: el.y, cursor: 'nwse-resize' }, { name: 'tm', x: el.x + el.width / 2, y: el.y, cursor: 'ns-resize' }, { name: 'tr', x: el.x + el.width, y: el.y, cursor: 'nesw-resize' },
                                        { name: 'ml', x: el.x, y: el.y + el.height / 2, cursor: 'ew-resize' }, { name: 'mr', x: el.x + el.width, y: el.y + el.height / 2, cursor: 'ew-resize' },
                                        { name: 'bl', x: el.x, y: el.y + el.height, cursor: 'nesw-resize' }, { name: 'bm', x: el.x + el.width / 2, y: el.y + el.height, cursor: 'ns-resize' }, { name: 'br', x: el.x + el.width, y: el.y + el.height, cursor: 'nwse-resize' },
                                    ];
                                     selectionComponent = <g>
                                        <rect x={el.x} y={el.y} width={el.width} height={el.height} fill="none" stroke="rgb(59 130 246)" strokeWidth={2 / zoom} pointerEvents="none" />
                                        {handles.map(h => <rect key={h.name} data-handle={h.name} x={h.x - handleSize / 2} y={h.y - handleSize / 2} width={handleSize} height={handleSize} fill="white" stroke="#3b82f6" strokeWidth={1 / zoom} style={{ cursor: h.cursor }} />)}
                                    </g>;
                                }
                            }
                           
                            if (el.type === 'path') {
                                const pathData = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                return <g key={el.id} data-id={el.id} className="cursor-pointer"><path d={pathData} stroke={el.strokeColor} strokeWidth={el.strokeWidth / zoom} fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="stroke" strokeOpacity={el.strokeOpacity} />{selectionComponent}</g>;
                            }
                            if (el.type === 'arrow') {
                                const [start, end] = el.points;
                                const angle = Math.atan2(end.y - start.y, end.x - start.x);
                                const headLength = el.strokeWidth * 4;

                                const arrowHeadHeight = headLength * Math.cos(Math.PI / 6);
                                const lineEnd = {
                                    x: end.x - arrowHeadHeight * Math.cos(angle),
                                    y: end.y - arrowHeadHeight * Math.sin(angle),
                                };

                                const headPoint1 = { x: end.x - headLength * Math.cos(angle - Math.PI / 6), y: end.y - headLength * Math.sin(angle - Math.PI / 6) };
                                const headPoint2 = { x: end.x - headLength * Math.cos(angle + Math.PI / 6), y: end.y - headLength * Math.sin(angle + Math.PI / 6) };
                                return (
                                    <g key={el.id} data-id={el.id} className="cursor-pointer">
                                        <line x1={start.x} y1={start.y} x2={lineEnd.x} y2={lineEnd.y} stroke={el.strokeColor} strokeWidth={el.strokeWidth / zoom} strokeLinecap="round" />
                                        <polygon points={`${end.x},${end.y} ${headPoint1.x},${headPoint1.y} ${headPoint2.x},${headPoint2.y}`} fill={el.strokeColor} />
                                        {selectionComponent}
                                    </g>
                                );
                            }
                            if (el.type === 'line') {
                                const [start, end] = el.points;
                                return (
                                    <g key={el.id} data-id={el.id} className="cursor-pointer">
                                        <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={el.strokeColor} strokeWidth={el.strokeWidth / zoom} strokeLinecap="round" />
                                        {selectionComponent}
                                    </g>
                                );
                            }
                            if (el.type === 'text') {
                                const isEditing = editingElement?.id === el.id;
                                return (
                                    <g key={el.id} data-id={el.id} transform={`translate(${el.x}, ${el.y})`} className="cursor-pointer">
                                        {!isEditing && (
                                            <foreignObject width={el.width} height={el.height} style={{ overflow: 'visible' }}>
                                                <div style={{ fontSize: el.fontSize, color: el.fontColor, width: '100%', height: '100%', wordBreak: 'break-word' }}>
                                                    {el.text}
                                                </div>
                                            </foreignObject>
                                        )}
                                        {selectionComponent && React.cloneElement(selectionComponent, { transform: `translate(${-el.x}, ${-el.y})` })}
                                    </g>
                                )
                            }
                             if (el.type === 'shape') {
                                let shapeJsx;
                                if (el.shapeType === 'rectangle') shapeJsx = <rect width={el.width} height={el.height} rx={el.borderRadius || 0} ry={el.borderRadius || 0} />
                                else if (el.shapeType === 'circle') shapeJsx = <ellipse cx={el.width/2} cy={el.height/2} rx={el.width/2} ry={el.height/2} />
                                else if (el.shapeType === 'triangle') shapeJsx = <polygon points={`${el.width/2},0 0,${el.height} ${el.width},${el.height}`} />
                                return (
                                     <g key={el.id} data-id={el.id} transform={`translate(${el.x}, ${el.y})`} className="cursor-pointer">
                                        {shapeJsx && React.cloneElement(shapeJsx, { 
                                            fill: el.fillColor, 
                                            stroke: el.strokeColor, 
                                            strokeWidth: el.strokeWidth / zoom,
                                            strokeDasharray: el.strokeDashArray ? el.strokeDashArray.join(' ') : 'none'
                                        })}
                                        {selectionComponent && React.cloneElement(selectionComponent, { transform: `translate(${-el.x}, ${-el.y})` })}
                                    </g>
                                );
                            }
                            if (el.type === 'image') {
                                const hasBorderRadius = el.borderRadius && el.borderRadius > 0;
                                const clipPathId = `clip-${el.id}`;
                                return (
                                    <g key={el.id} data-id={el.id}>
                                        <image 
                                            transform={`translate(${el.x}, ${el.y})`} 
                                            href={el.href} 
                                            width={el.width} 
                                            height={el.height} 
                                            className={croppingState && croppingState.elementId !== el.id ? 'opacity-30' : ''} 
                                            opacity={typeof el.opacity === 'number' ? el.opacity / 100 : 1}
                                            clipPath={hasBorderRadius ? `url(#${clipPathId})` : undefined}
                                        />
                                        {selectionComponent}
                                    </g>
                                );
                            }
                             if (el.type === 'video') {
                                return (
                                    <g key={el.id} data-id={el.id}>
                                        <foreignObject x={el.x} y={el.y} width={el.width} height={el.height}>
                                            <video 
                                                src={el.href} 
                                                controls 
                                                style={{ width: '100%', height: '100%', borderRadius: '8px' }}
                                                className={croppingState ? 'opacity-30' : ''}
                                            ></video>
                                        </foreignObject>
                                        {selectionComponent}
                                    </g>
                                );
                            }
                             if (el.type === 'group') {
                                return <g key={el.id} data-id={el.id}>{selectionComponent}</g>
                             }
                            return null;
                        })}

                        {lassoPath && (
                            <path d={lassoPath.map((p, i) => i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`).join(' ')} stroke="rgb(59 130 246)" strokeWidth={1 / zoom} strokeDasharray={`${4/zoom} ${4/zoom}`} fill="rgba(59, 130, 246, 0.1)" />
                        )}
                        
                        {alignmentGuides.map((guide, i) => (
                             <line key={i} x1={guide.type === 'v' ? guide.position : guide.start} y1={guide.type === 'h' ? guide.position : guide.start} x2={guide.type === 'v' ? guide.position : guide.end} y2={guide.type === 'h' ? guide.position : guide.end} stroke="red" strokeWidth={1/zoom} strokeDasharray={`${4/zoom} ${2/zoom}`} />
                        ))}

                        {selectedElementIds.length > 0 && !croppingState && !editingElement && (() => {
                            if (selectedElementIds.length > 1) {
                                const bounds = getSelectionBounds(selectedElementIds);
                                const toolbarScreenWidth = 280;
                                const toolbarScreenHeight = 56;
                                
                                const toolbarCanvasWidth = toolbarScreenWidth / zoom;
                                const toolbarCanvasHeight = toolbarScreenHeight / zoom;
                                
                                const x = bounds.x + bounds.width / 2 - (toolbarCanvasWidth / 2);
                                const y = bounds.y - toolbarCanvasHeight - (10 / zoom);

                                const toolbar = <div
                                    style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'top left', width: `${toolbarScreenWidth}px`, height: `${toolbarScreenHeight}px` }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    <div className="p-1.5 bg-white rounded-lg shadow-lg flex items-center justify-center space-x-2 border border-gray-200 text-gray-800">
                                        <button title={t('contextMenu.alignment.alignLeft')} onClick={() => handleAlignSelection('left')} className="p-2 rounded hover:bg-gray-100"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="3"></line><rect x="8" y="6" width="8" height="4" rx="1"></rect><rect x="8" y="14" width="12" height="4" rx="1"></rect></svg></button>
                                        <button title={t('contextMenu.alignment.alignCenter')} onClick={() => handleAlignSelection('center')} className="p-2 rounded hover:bg-gray-100"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="21" x2="12" y2="3" strokeDasharray="2 2"></line><rect x="7" y="6" width="10" height="4" rx="1"></rect><rect x="4" y="14" width="16" height="4" rx="1"></rect></svg></button>
                                        <button title={t('contextMenu.alignment.alignRight')} onClick={() => handleAlignSelection('right')} className="p-2 rounded hover:bg-gray-100"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="20" y1="21" x2="20" y2="3"></line><rect x="12" y="6" width="8" height="4" rx="1"></rect><rect x="8" y="14" width="12" height="4" rx="1"></rect></svg></button>
                                        <div className="h-6 w-px bg-gray-200"></div>
                                        <button title={t('contextMenu.alignment.alignTop')} onClick={() => handleAlignSelection('top')} className="p-2 rounded hover:bg-gray-100"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="4" x2="21" y2="4"></line><rect x="6" y="8" width="4" height="8" rx="1"></rect><rect x="14" y="8" width="4" height="12" rx="1"></rect></svg></button>
                                        <button title={t('contextMenu.alignment.alignMiddle')} onClick={() => handleAlignSelection('middle')} className="p-2 rounded hover:bg-gray-100"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12" strokeDasharray="2 2"></line><rect x="6" y="7" width="4" height="10" rx="1"></rect><rect x="14" y="4" width="4" height="16" rx="1"></rect></svg></button>
                                        <button title={t('contextMenu.alignment.alignBottom')} onClick={() => handleAlignSelection('bottom')} className="p-2 rounded hover:bg-gray-100"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="20" x2="21" y2="20"></line><rect x="6" y="12" width="4" height="8" rx="1"></rect><rect x="14" y="8" width="4" height="12" rx="1"></rect></svg></button>
                                    </div>
                                </div>;
                                return (
                                    <foreignObject x={x} y={y} width={toolbarCanvasWidth} height={toolbarCanvasHeight} style={{ overflow: 'visible' }}>
                                        {toolbar}
                                    </foreignObject>
                                );
                            } else if (singleSelectedElement) {
                                const element = singleSelectedElement;
                                const bounds = getElementBounds(element, elements);
                                let toolbarScreenWidth = 160;
                                if (element.type === 'shape') {
                                    toolbarScreenWidth = 300;
                                    if (element.shapeType === 'rectangle') toolbarScreenWidth += 190;
                                }
                                if (element.type === 'text') toolbarScreenWidth = 220;
                                if (element.type === 'arrow' || element.type === 'line') toolbarScreenWidth = 220;
                                if (element.type === 'image') toolbarScreenWidth = 340;
                                if (element.type === 'video') toolbarScreenWidth = 160;
                                if (element.type === 'group') toolbarScreenWidth = 80;

                                const toolbarScreenHeight = 56;
                                
                                const toolbarCanvasWidth = toolbarScreenWidth / zoom;
                                const toolbarCanvasHeight = toolbarScreenHeight / zoom;
                                
                                const x = bounds.x + bounds.width / 2 - (toolbarCanvasWidth / 2);
                                const y = bounds.y - toolbarCanvasHeight - (10 / zoom);
                                
                                const toolbar = <div
                                    style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'top left', width: `${toolbarScreenWidth}px`, height: `${toolbarScreenHeight}px` }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    <div className="p-1.5 bg-white rounded-lg shadow-lg flex items-center justify-center space-x-2 border border-gray-200 text-gray-800">
                                        <button title={t('contextMenu.copy')} onClick={() => handleCopyElement(element)} className="p-2 rounded hover:bg-gray-100 flex items-center justify-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                                        {element.type === 'image' && <button title={t('contextMenu.download')} onClick={() => handleDownloadImage(element)} className="p-2 rounded hover:bg-gray-100 flex items-center justify-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>}
                                        {element.type === 'video' && <a title={t('contextMenu.download')} href={element.href} download={`video-${element.id}.mp4`} className="p-2 rounded hover:bg-gray-100 flex items-center justify-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></a>}
                                        {element.type === 'image' && <button title={t('contextMenu.crop')} onClick={() => handleStartCrop(element)} className="p-2 rounded hover:bg-gray-100 flex items-center justify-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path></svg></button>}
                                        {element.type === 'image' && (
                                            <>
                                                <div className="h-6 w-px bg-gray-200"></div>
                                                <div title={t('contextMenu.opacity')} className="flex items-center space-x-1 p-1">
                                                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><circle cx="12" cy="12" r="9"/></svg>
                                                    <input 
                                                        type="range" 
                                                        min="0" 
                                                        max={100} 
                                                        value={typeof element.opacity === 'number' ? element.opacity : 100} 
                                                        onChange={e => handlePropertyChange(element.id, { opacity: parseInt(e.target.value, 10) })} 
                                                        className="w-16" 
                                                    />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={100}
                                                        value={typeof element.opacity === 'number' ? element.opacity : 100}
                                                        onChange={e => handlePropertyChange(element.id, { opacity: parseInt(e.target.value, 10) || 0 })}
                                                        className="w-14 p-1 text-xs border rounded bg-gray-100 text-gray-800"
                                                    />
                                                </div>
                                            </>
                                        )}
                                        {element.type === 'shape' && (
                                            <>
                                                <input type="color" title={t('contextMenu.fillColor')} value={element.fillColor} onChange={e => handlePropertyChange(element.id, { fillColor: e.target.value })} className="w-7 h-7 p-0 border-none rounded cursor-pointer" />
                                                <div className="h-6 w-px bg-gray-200"></div>
                                                <input type="color" title={t('contextMenu.strokeColor')} value={element.strokeColor} onChange={e => handlePropertyChange(element.id, { strokeColor: e.target.value })} className="w-7 h-7 p-0 border-none rounded cursor-pointer" />
                                                <div className="h-6 w-px bg-gray-200"></div>
                                                <div title={t('contextMenu.strokeStyle')} className="flex items-center space-x-1 p-1 bg-gray-100 rounded-md">
                                                    <button title={t('contextMenu.solid')} onClick={() => handlePropertyChange(element.id, { strokeDashArray: undefined })} className={`p-1 rounded ${!element.strokeDashArray ? 'bg-blue-200' : 'hover:bg-gray-200'}`}>
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                    </button>
                                                    <button title={t('contextMenu.dashed')} onClick={() => handlePropertyChange(element.id, { strokeDashArray: [10, 10] })} className={`p-1 rounded ${element.strokeDashArray?.toString() === '10,10' ? 'bg-blue-200' : 'hover:bg-gray-200'}`}>
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="9" y2="12"></line><line x1="15" y1="12" x2="19" y2="12"></line></svg>
                                                    </button>
                                                    <button title={t('contextMenu.dotted')} onClick={() => handlePropertyChange(element.id, { strokeDashArray: [2, 6] })} className={`p-1 rounded ${element.strokeDashArray?.toString() === '2,6' ? 'bg-blue-200' : 'hover:bg-gray-200'}`}>
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="5.01" y2="12"></line><line x1="12" y1="12" x2="12.01" y2="12"></line><line x1="19" y1="12" x2="19.01" y2="12"></line></svg>
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                         {element.type === 'shape' && element.shapeType === 'rectangle' && (
                                            <>
                                                <div className="h-6 w-px bg-gray-200"></div>
                                                <div title={t('contextMenu.borderRadius')} className="flex items-center space-x-1 p-1">
                                                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600"><path d="M10 3H5a2 2 0 0 0-2 2v5"/></svg>
                                                    <input 
                                                        type="range" 
                                                        min="0" 
                                                        max={Math.min(element.width, element.height) / 2} 
                                                        value={element.borderRadius || 0} 
                                                        onChange={e => handlePropertyChange(element.id, { borderRadius: parseInt(e.target.value, 10) })} 
                                                        className="w-16" 
                                                    />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={Math.min(element.width, element.height) / 2}
                                                        value={element.borderRadius || 0}
                                                        onChange={e => handlePropertyChange(element.id, { borderRadius: parseInt(e.target.value, 10) || 0 })}
                                                        className="w-14 p-1 text-xs border rounded bg-gray-100 text-gray-800"
                                                    />
                                                </div>
                                            </>
                                        )}
                                        {element.type === 'text' && <input type="color" title={t('contextMenu.fontColor')} value={element.fontColor} onChange={e => handlePropertyChange(element.id, { fontColor: e.target.value })} className="w-7 h-7 p-0 border-none rounded cursor-pointer" />}
                                        {element.type === 'text' && <input type="number" title={t('contextMenu.fontSize')} value={element.fontSize} onChange={e => handlePropertyChange(element.id, { fontSize: parseInt(e.target.value, 10) || 16 })} className="w-16 p-1 border rounded bg-gray-100 text-gray-800" />}
                                        {(element.type === 'arrow' || element.type === 'line') && <input type="color" title={t('contextMenu.strokeColor')} value={element.strokeColor} onChange={e => handlePropertyChange(element.id, { strokeColor: e.target.value })} className="w-7 h-7 p-0 border-none rounded cursor-pointer" />}
                                        {(element.type === 'arrow' || element.type === 'line') && <input type="range" title={t('contextMenu.strokeWidth')} min="1" max="50" value={element.strokeWidth} onChange={e => handlePropertyChange(element.id, { strokeWidth: parseInt(e.target.value, 10) })} className="w-20" />}
                                        <div className="h-6 w-px bg-gray-200"></div>
                                        <button title={t('contextMenu.delete')} onClick={() => handleDeleteElement(element.id)} className="p-2 rounded hover:bg-red-100 hover:text-red-600 flex items-center justify-center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
                                    </div>
                                </div>;
                                
                                return (
                                    <foreignObject x={x} y={y} width={toolbarCanvasWidth} height={toolbarCanvasHeight} style={{ overflow: 'visible' }}>
                                        {toolbar}
                                    </foreignObject>
                                );
                            }
                            return null;
                        })()}
                        {editingElement && (() => {
                             const element = elements.find(el => el.id === editingElement.id) as TextElement;
                             if (!element) return null;
                             return <foreignObject 
                                x={element.x} y={element.y} width={element.width} height={element.height}
                                onMouseDown={(e) => e.stopPropagation()}
                             >
                                 <textarea
                                    ref={editingTextareaRef}
                                    value={editingElement.text}
                                    onChange={(e) => setEditingElement({ ...editingElement, text: e.target.value })}
                                    onBlur={() => handleStopEditing()}
                                    style={{
                                        width: '100%', height: '100%', border: 'none', padding: 0, margin: 0,
                                        outline: 'none', resize: 'none', background: 'transparent',
                                        fontSize: element.fontSize, color: element.fontColor,
                                        overflow: 'hidden'
                                    }}
                                 />
                             </foreignObject>
                        })()}
                        {croppingState && (
                             <g>
                                <path
                                    d={`M ${-panOffset.x/zoom},${-panOffset.y/zoom} H ${window.innerWidth/zoom - panOffset.x/zoom} V ${window.innerHeight/zoom - panOffset.y/zoom} H ${-panOffset.x/zoom} Z M ${croppingState.cropBox.x},${croppingState.cropBox.y} v ${croppingState.cropBox.height} h ${croppingState.cropBox.width} v ${-croppingState.cropBox.height} Z`}
                                    fill="rgba(0,0,0,0.5)"
                                    fillRule="evenodd"
                                    pointerEvents="none"
                                />
                                <rect x={croppingState.cropBox.x} y={croppingState.cropBox.y} width={croppingState.cropBox.width} height={croppingState.cropBox.height} fill="none" stroke="white" strokeWidth={2 / zoom} pointerEvents="all" />
                                {(() => {
                                    const { x, y, width, height } = croppingState.cropBox;
                                    const handleSize = 10 / zoom;
                                    const handles = [
                                        { name: 'tl', x, y, cursor: 'nwse-resize' }, { name: 'tr', x: x + width, y, cursor: 'nesw-resize' },
                                        { name: 'bl', x, y: y + height, cursor: 'nesw-resize' }, { name: 'br', x: x + width, y: y + height, cursor: 'nwse-resize' },
                                    ];
                                    return handles.map(h => <rect key={h.name} data-handle={h.name} x={h.x - handleSize/2} y={h.y - handleSize/2} width={handleSize} height={handleSize} fill="white" stroke="#3b82f6" strokeWidth={1/zoom} style={{ cursor: h.cursor }}/>)
                                })()}
                            </g>
                        )}
                        {selectionBox && (
                             <rect
                                x={selectionBox.x}
                                y={selectionBox.y}
                                width={selectionBox.width}
                                height={selectionBox.height}
                                fill="rgba(59, 130, 246, 0.1)"
                                stroke="rgb(59, 130, 246)"
                                strokeWidth={1 / zoom}
                            />
                        )}
                    </g>
                </svg>
                 {contextMenu && (() => {
                    const hasDrawableSelection = elements.some(el => selectedElementIds.includes(el.id) && el.type !== 'image' && el.type !== 'video');
                    const isGroupable = selectedElementIds.length > 1;
                    const isUngroupable = selectedElementIds.length === 1 && elements.find(el => el.id === selectedElementIds[0])?.type === 'group';

                    return (
                        <div style={{ top: contextMenu.y, left: contextMenu.x }} className="absolute z-30 bg-white rounded-md shadow-lg border border-gray-200 text-sm py-1 text-gray-800" onContextMenu={e => e.stopPropagation()}>
                           {isGroupable && <button onClick={handleGroup} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.group')}</button>}
                           {isGroupable && <button onClick={() => handleMergeLayers('selected')} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.mergeLayers')}</button>}
                           {isUngroupable && <button onClick={handleUngroup} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.ungroup')}</button>}
                           {(isGroupable || isUngroupable) && <div className="border-t border-gray-100 my-1"></div>}
                            
                            {contextMenu.elementId && (<>
                                <button onClick={() => handleLayerAction(contextMenu.elementId!, 'forward')} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.bringForward')}</button>
                                <button onClick={() => handleLayerAction(contextMenu.elementId!, 'backward')} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.sendBackward')}</button>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button onClick={() => handleLayerAction(contextMenu.elementId!, 'front')} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.bringToFront')}</button>
                                <button onClick={() => handleLayerAction(contextMenu.elementId!, 'back')} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.sendToBack')}</button>
                            </>)}
                            
                            {hasDrawableSelection && (
                                <>
                                    <div className="border-t border-gray-100 my-1"></div>
                                    <button onClick={handleRasterizeSelection} className="block w-full text-left px-4 py-1.5 hover:bg-gray-100">{t('contextMenu.rasterize')}</button>
                                </>
                            )}
                        </div>
                    );
                })()}
            </div>
            {/* Measure PromptBar to position BananaSidebar responsively */}
            {!croppingState && <PromptBar 
                t={t}
                prompt={prompt} 
                setPrompt={setPrompt} 
                onGenerate={handleGenerate} 
                isLoading={isLoading} 
                isSelectionActive={isSelectionActive} 
                selectedElementCount={selectedElementIds.length}
                onAddUserEffect={handleAddUserEffect}
                userEffects={userEffects}
                onDeleteUserEffect={handleDeleteUserEffect}
                generationMode={generationMode}
                setGenerationMode={setGenerationMode}
                videoAspectRatio={videoAspectRatio}
                setVideoAspectRatio={setVideoAspectRatio}
                activeImageModel={imageModel}
                imageSize={imageSize}
                setImageSize={setImageSize}
                containerRef={promptBarRef}
            />}
        </div>
    );
};

export default App;
    const loadImageWithFallback = (b64: string, mime: string): Promise<{ img: HTMLImageElement; href: string }> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const sanitize = (input: string) => {
                const raw = input.includes('base64,') ? input.split('base64,')[1] : input.replace(/^data:.*?;base64,?/i, '');
                let s = raw.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
                const pad = s.length % 4;
                if (pad === 2) s += '==';
                else if (pad === 3) s += '=';
                else if (pad !== 0) { while (s.length % 4 !== 0) s += '='; }
                return s;
            };
            const safeB64 = sanitize(b64);
            const safeMime = mime && mime.startsWith('image/') ? mime : 'image/png';
            try {
                const binary = atob(safeB64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                const blob = new Blob([bytes], { type: safeMime });
                const objUrl = URL.createObjectURL(blob);
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(img, 0, 0);
                            const dataUrl = canvas.toDataURL(safeMime);
                            URL.revokeObjectURL(objUrl);
                            resolve({ img, href: dataUrl });
                        } else {
                            URL.revokeObjectURL(objUrl);
                            const dataUrl = `data:${safeMime};base64,${safeB64}`;
                            resolve({ img, href: dataUrl });
                        }
                    } catch {
                        URL.revokeObjectURL(objUrl);
                        const dataUrl = `data:${safeMime};base64,${safeB64}`;
                        resolve({ img, href: dataUrl });
                    }
                };
                img.onerror = () => {
                    const dataUrl = `data:${safeMime};base64,${safeB64}`;
                    img.onload = () => resolve({ img, href: dataUrl });
                    img.onerror = () => reject(new Error('Failed to load generated image'));
                    img.src = dataUrl;
                };
                img.src = objUrl;
            } catch (e) {
                const dataUrl = `data:${safeMime};base64,${safeB64}`;
                img.onload = () => resolve({ img, href: dataUrl });
                img.onerror = () => reject(e instanceof Error ? e : new Error(String(e)));
                img.src = dataUrl;
            }
        });
    };
