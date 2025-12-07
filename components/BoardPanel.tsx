
import React, { useState, useRef, useEffect, memo, forwardRef } from 'react';
import type { Board, HistoryBoardSnapshot } from '@/types';
import { getHistoryBoards, updateHistoryThumbnail } from '@/src/services/boardsStorage';

interface BoardPanelProps {
    isOpen: boolean;
    onClose: () => void;
    boards: Board[];
    activeBoardId: string;
    onSwitchBoard: (id: string) => void;
    onAddBoard: () => void;
    onRenameBoard: (id: string, name: string) => void;
    onDuplicateBoard: (id: string) => void;
    onDeleteBoard: (id: string) => void;
    generateBoardThumbnail: (elements: Board['elements']) => string;
    onImportHistoryBoard?: (snapshot: HistoryBoardSnapshot) => void;
}

type BoardItemProps = {
    board: Board;
    isActive: boolean;
    thumbnail: string;
    onClick: () => void;
    onRename: (name: string) => void;
    onDuplicate: () => void;
    onDelete: () => void;
    dataBoardId: string;
};

const BoardItem = forwardRef<HTMLDivElement, BoardItemProps>(({ board, isActive, thumbnail, onClick, onRename, onDuplicate, onDelete, dataBoardId }, ref) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(board.name);
    const [menuOpen, setMenuOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // 移除在 effect 中同步 setState 的模式；当进入编辑态时再从 props 同步

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleBlur = () => {
        setIsEditing(false);
        if (name.trim() === '') {
            setName(board.name);
        } else if (name.trim() !== board.name) {
            onRename(name.trim());
        }
    };
    
    const handleMenuAction = (action: 'rename' | 'duplicate' | 'delete') => {
        setMenuOpen(false);
        switch (action) {
            case 'rename':
                setName(board.name);
                setIsEditing(true);
                break;
            case 'duplicate':
                onDuplicate();
                break;
            case 'delete':
                if (window.confirm(`Are you sure you want to delete "${board.name}"?`)) {
                    onDelete();
                }
                break;
        }
    };

    return (
        <div
            ref={ref}
            data-boardid={dataBoardId}
            onClick={onClick}
            className={`group relative p-2 pod-list-item cursor-pointer ${isActive ? 'selected' : ''}`}
        >
            <div className="aspect-[3/2] w-full pod-rounded-base mb-2 overflow-hidden border-2" style={{ borderColor: isActive ? 'var(--brand-accent)' : 'transparent' }}>
                <img src={thumbnail} alt={`${board.name} thumbnail`} className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center justify-between">
                {isEditing ? (
                     <input
                        ref={inputRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
                        className="w-full bg-transparent border-b border-[var(--brand-primary)] outline-none text-white text-sm"
                        onClick={e => e.stopPropagation()}
                    />
                ) : (
                    <span
                        className="text-sm truncate"
                        onDoubleClick={() => { setName(board.name); setIsEditing(true); }}
                    >
                        {board.name}
                    </span>
                )}
               
                <div className="relative" ref={menuRef}>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(p => !p); }} 
                        className="pod-icon-button opacity-0 group-hover:opacity-100"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 bottom-full mb-1 z-10 w-32 pod-panel py-1 text-sm">
                            <button onClick={() => handleMenuAction('rename')} className="pod-menu-item block w-full text-left">Rename</button>
                            <button onClick={() => handleMenuAction('duplicate')} className="pod-menu-item block w-full text-left">Duplicate</button>
                            <div className="my-1" style={{ borderTop: '1px solid var(--border-color)' }}></div>
                            <button onClick={() => handleMenuAction('delete')} className="pod-menu-item block w-full text-left" style={{ color: 'var(--brand-highlight)' }}>Delete</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

const MemoBoardItem = memo(BoardItem);
BoardItem.displayName = 'BoardItem';
MemoBoardItem.displayName = 'MemoBoardItem';


export const BoardPanel: React.FC<BoardPanelProps> = ({ 
    isOpen, onClose, boards, activeBoardId, onSwitchBoard, onAddBoard, 
    onRenameBoard, onDuplicateBoard, onDeleteBoard, onImportHistoryBoard, generateBoardThumbnail 
}) => {
    const [history, setHistory] = useState<HistoryBoardSnapshot[]>([]);
    useEffect(() => { if (!isOpen) return; getHistoryBoards().then(setHistory).catch(() => setHistory([])); }, [isOpen]);
    const [thumbs, setThumbs] = useState<Record<number, string>>({});
    const queueRef = useRef<number[]>([]);
    const runningRef = useRef(false);
    const workerRef = useRef<Worker | null>(null);
    const historyRef = useRef<HistoryBoardSnapshot[]>([]);
    useEffect(() => { historyRef.current = history; }, [history]);
    useEffect(() => {
        workerRef.current = new Worker(new URL('../src/workers/thumbWorker.ts', import.meta.url), { type: 'module' });
        const w = workerRef.current;
        w.onmessage = (e: MessageEvent) => {
            const { savedAt, thumbnail } = e.data as { savedAt: number; thumbnail: string };
            setThumbs(prev => ({ ...prev, [savedAt]: thumbnail }));
            updateHistoryThumbnail(savedAt, thumbnail).finally(() => {
                if (runningRef.current) {
                    const next = queueRef.current.shift();
                    if (next == null) { runningRef.current = false; return; }
                    const h = historyRef.current.find(x => x.savedAt === next);
                    if (!h) { w.postMessage({ elements: [], bgColor: '#000', savedAt: next }); return; }
                    w.postMessage({ elements: h.elements, bgColor: h.canvasBackgroundColor, savedAt: h.savedAt });
                }
            });
        };
        return () => { w.terminate(); };
    }, []);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const elRefs = useRef<Record<number, HTMLElement>>({});
    const visibleRef = useRef<Set<number>>(new Set());
    const scheduleQueue = React.useCallback(() => {
        const candidates = history.filter(h => visibleRef.current.has(h.savedAt) && !h.thumbnail && !thumbs[h.savedAt]).map(h => h.savedAt);
        if (candidates.length === 0) return;
        queueRef.current = Array.from(new Set([...queueRef.current, ...candidates]));
        if (runningRef.current) return;
        runningRef.current = true;
        const w = workerRef.current;
        const nextId = queueRef.current.shift();
        if (nextId == null) { runningRef.current = false; return; }
        const h = history.find(x => x.savedAt === nextId);
        if (!h || !w) { runningRef.current = false; return; }
        w.postMessage({ elements: h.elements, bgColor: h.canvasBackgroundColor, savedAt: h.savedAt });
    }, [history, thumbs]);
    useEffect(() => {
        if (!isOpen) return;
        const obs = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const el = entry.target as HTMLElement;
                const id = Number(el.dataset.savedat);
                if (entry.isIntersecting) visibleRef.current.add(id); else visibleRef.current.delete(id);
            });
            scheduleQueue();
        }, { root: containerRef.current || undefined, threshold: 0.1 });
        for (const el of Object.values(elRefs.current) as HTMLElement[]) { obs.observe(el); }
        return () => { obs.disconnect(); };
    }, [isOpen, history, scheduleQueue]);

    // Boards thumbnails (lazy + cached via worker)
    const [boardThumbs, setBoardThumbs] = useState<Record<string, string>>({});
    const boardsRef = useRef<Board[]>([]);
    useEffect(() => { boardsRef.current = boards; }, [boards]);
    const boardQueueRef = useRef<string[]>([]);
    const boardRunningRef = useRef(false);
    const boardWorkerRef = useRef<Worker | null>(null);
    const boardReqSeqRef = useRef(1);
    const boardReqMapRef = useRef<Record<number, string>>({});
    useEffect(() => {
        boardWorkerRef.current = new Worker(new URL('../src/workers/thumbWorker.ts', import.meta.url), { type: 'module' });
        const w = boardWorkerRef.current;
        w.onmessage = (e: MessageEvent) => {
            const { savedAt, thumbnail } = e.data as { savedAt: number; thumbnail: string };
            const boardId = boardReqMapRef.current[savedAt];
            if (boardId) {
                setBoardThumbs(prev => ({ ...prev, [boardId]: thumbnail }));
                delete boardReqMapRef.current[savedAt];
                if (boardRunningRef.current) {
                    const nextBoard = boardQueueRef.current.shift();
                    if (!nextBoard) { boardRunningRef.current = false; return; }
                    const b = boardsRef.current.find(x => x.id === nextBoard);
                    if (!b) { boardRunningRef.current = false; return; }
                    const reqId = ++boardReqSeqRef.current;
                    boardReqMapRef.current[reqId] = nextBoard;
                    w.postMessage({ elements: b.elements, bgColor: b.canvasBackgroundColor, savedAt: reqId });
                }
            }
        };
        return () => { w.terminate(); };
    }, []);
    const boardsContainerRef = useRef<HTMLDivElement | null>(null);
    const boardElRefs = useRef<Record<string, HTMLElement>>({});
    const boardVisibleRef = useRef<Set<string>>(new Set());
    const scheduleBoardQueue = React.useCallback(() => {
        const candidates = boardsRef.current.filter(b => boardVisibleRef.current.has(b.id) && !boardThumbs[b.id]).map(b => b.id);
        if (candidates.length === 0) return;
        boardQueueRef.current = Array.from(new Set([...boardQueueRef.current, ...candidates]));
        if (boardRunningRef.current) return;
        boardRunningRef.current = true;
        const w = boardWorkerRef.current;
        const nextId = boardQueueRef.current.shift();
        if (!nextId || !w) { boardRunningRef.current = false; return; }
        const b = boardsRef.current.find(x => x.id === nextId);
        if (!b) { boardRunningRef.current = false; return; }
        const reqId = ++boardReqSeqRef.current;
        boardReqMapRef.current[reqId] = nextId;
        w.postMessage({ elements: b.elements, bgColor: b.canvasBackgroundColor, savedAt: reqId });
    }, [boardThumbs]);
    useEffect(() => {
        if (!isOpen) return;
        const obs = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const el = entry.target as HTMLElement;
                const id = String(el.dataset.boardid || '');
                if (!id) return;
                if (entry.isIntersecting) boardVisibleRef.current.add(id); else boardVisibleRef.current.delete(id);
            });
            scheduleBoardQueue();
        }, { root: boardsContainerRef.current || undefined, threshold: 0.1 });
        for (const el of Object.values(boardElRefs.current) as HTMLElement[]) { obs.observe(el); }
        return () => { obs.disconnect(); };
    }, [isOpen, boards, scheduleBoardQueue]);
    useEffect(() => {
        if (!isOpen) return;
        const firstSix = boards.slice(0, 6).map(b => b.id);
        boardQueueRef.current = Array.from(new Set([...boardQueueRef.current, ...firstSix]));
        scheduleBoardQueue();
    }, [isOpen, boards, scheduleBoardQueue]);

    // Throttle active board thumbnail refresh while panel open
    const activeThumbTimerRef = useRef<number | null>(null);
    useEffect(() => {
        if (!isOpen) return;
        const id = activeBoardId;
        if (!id) return;
        if (!boardVisibleRef.current.has(id)) return;
        if (activeThumbTimerRef.current != null) {
            clearTimeout(activeThumbTimerRef.current);
            activeThumbTimerRef.current = null;
        }
        activeThumbTimerRef.current = window.setTimeout(() => {
            boardQueueRef.current = Array.from(new Set([...boardQueueRef.current, id]));
            scheduleBoardQueue();
        }, 300);
        return () => {
            if (activeThumbTimerRef.current != null) {
                clearTimeout(activeThumbTimerRef.current);
                activeThumbTimerRef.current = null;
            }
        };
    }, [isOpen, boards, activeBoardId, scheduleBoardQueue]);
    if (!isOpen) return null;

    return (
        <div 
            className="absolute top-4 left-4 z-20 flex flex-col w-64 h-[calc(100vh-2rem)] pod-glass-strong pod-rounded-base overflow-hidden"
        >
            <div className="flex-shrink-0 flex justify-between items-center p-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <h3 className="text-base" style={{ color: 'var(--text-heading)', fontWeight: 600 }}>Boards</h3>
                <div className="flex items-center space-x-1">
                    <button onClick={onAddBoard} className="pod-icon-button" title="New Board">
                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                    <button onClick={onClose} className="pod-icon-button">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>
            <div className="flex-grow p-2 overflow-y-auto" ref={boardsContainerRef}>
                <div className="grid grid-cols-2 gap-2 content-start mb-3">
                 {boards.map(board => (
                     <MemoBoardItem
                        key={board.id}
                        ref={el => { if (el) { boardElRefs.current[board.id] = el; } else { delete boardElRefs.current[board.id]; } }}
                        dataBoardId={board.id}
                        board={board}
                        isActive={board.id === activeBoardId}
                        thumbnail={boardThumbs[board.id] || generateBoardThumbnail(board.elements)}
                        onClick={() => onSwitchBoard(board.id)}
                        onRename={(name) => onRenameBoard(board.id, name)}
                        onDuplicate={() => onDuplicateBoard(board.id)}
                        onDelete={() => onDeleteBoard(board.id)}
                     />
                 ))}
                </div>
                <div className="mt-2">
                    <h4 className="text-sm mb-2" style={{ color: 'var(--text-heading)', fontWeight: 600 }}>历史图版（最多5个）</h4>
                    <div ref={containerRef} className="grid grid-cols-2 gap-2 content-start overflow-y-auto">
                        {history.slice(0,5).map(h => {
                            const pad = (x: number) => String(x).padStart(2, '0');
                            const d = new Date(h.savedAt);
                            const code = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
                            return (
                                <div
                                    key={h.savedAt}
                                    className="group relative p-2 pod-list-item cursor-pointer"
                                    data-savedat={h.savedAt}
                                    ref={el => { if (el) { elRefs.current[h.savedAt] = el; } else { delete elRefs.current[h.savedAt]; } }}
                                    onClick={() => onImportHistoryBoard && onImportHistoryBoard(h)}
                                >
                                    <div className="aspect-[3/2] w-full pod-rounded-base mb-2 overflow-hidden border">
                                        <img src={h.thumbnail || thumbs[h.savedAt] || generateBoardThumbnail(h.elements)} alt={`${code} history`} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm truncate">{code}</span>
                                    </div>
                                    <div className="text-[10px] text-gray-400">{d.toLocaleString()}</div>
                                </div>
                            );
                        })}
                        {history.length === 0 && (
                            <div className="text-xs" style={{ color: 'var(--text-primary)' }}>暂无历史图版</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
