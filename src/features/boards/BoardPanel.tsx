import React from 'react';
import type { Board, HistoryBoardSnapshot } from '@/types';
import { Panel, IconButton } from '../../ui';
import { BoardGrid } from './components/BoardGrid';
import { HistoryList } from './components/HistoryList';

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



export const BoardPanel: React.FC<BoardPanelProps> = ({ 
    isOpen, onClose, boards, activeBoardId, onSwitchBoard, onAddBoard, 
    onRenameBoard, onDuplicateBoard, onDeleteBoard, onImportHistoryBoard, generateBoardThumbnail 
}) => {
    if (!isOpen) return null;

    return (
         <Panel 
            className="absolute top-4 left-4 z-20 flex flex-col w-64 h-[calc(100vh-2rem)] overflow-hidden"
        >
            <div className="flex-shrink-0 flex justify-between items-center p-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <h3 className="text-base" style={{ color: 'var(--text-heading)', fontWeight: 600 }}>Boards</h3>
                <div className="flex items-center space-x-1">
                    <IconButton onClick={onAddBoard} title="New Board" aria-label="New Board">
                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </IconButton>
                    <IconButton onClick={onClose} aria-label="Close" title="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </IconButton>
                </div>
            </div>
            <div className="flex-grow p-2 overflow-y-auto">
                <BoardGrid
                    isOpen={isOpen}
                    boards={boards}
                    activeBoardId={activeBoardId}
                    onSwitchBoard={onSwitchBoard}
                    onRenameBoard={onRenameBoard}
                    onDuplicateBoard={onDuplicateBoard}
                    onDeleteBoard={onDeleteBoard}
                    generateBoardThumbnail={generateBoardThumbnail}
                />
                <HistoryList
                    isOpen={isOpen}
                    generateBoardThumbnail={generateBoardThumbnail}
                    onImportHistoryBoard={onImportHistoryBoard}
                />
            </div>
        </Panel>
    );
};
