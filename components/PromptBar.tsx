import React from 'react';
import { QuickPrompts } from './QuickPrompts';
import BananaSidebar from './BananaSidebar';
// BananaSidebar moved to App-level overlay; keep PromptBar focused on input controls
import type { UserEffect, GenerationMode } from '@/types';

interface PromptBarProps {
    t: (key: string, ...args: unknown[]) => string;
    prompt: string;
    setPrompt: (prompt: string) => void;
    onGenerate: () => void;
    isLoading: boolean;
    isSelectionActive: boolean;
    selectedElementCount: number;
    userEffects: UserEffect[];
    onAddUserEffect: (effect: UserEffect) => void;
    onDeleteUserEffect: (id: string) => void;
    generationMode: GenerationMode;
    setGenerationMode: (mode: GenerationMode) => void;
    videoAspectRatio: '16:9' | '9:16';
    setVideoAspectRatio: (ratio: '16:9' | '9:16') => void;
    activeImageModel: string;
    imageSize: '1K' | '2K' | '4K';
    setImageSize: (size: '1K' | '2K' | '4K') => void;
    containerRef?: React.Ref<HTMLDivElement>;
}

export const PromptBar: React.FC<PromptBarProps> = ({
    t,
    prompt,
    setPrompt,
    onGenerate,
    isLoading,
    isSelectionActive,
    selectedElementCount,
    userEffects,
    onAddUserEffect,
    onDeleteUserEffect,
    generationMode,
    setGenerationMode,
    videoAspectRatio,
    setVideoAspectRatio,
    activeImageModel,
    imageSize,
    setImageSize,
    containerRef,
}) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const sizeMenuWrapperRef = React.useRef<HTMLDivElement>(null);
    const [isSizeMenuOpen, setIsSizeMenuOpen] = React.useState(false);
    const sizeChipButtonRef = React.useRef<HTMLButtonElement>(null);
    const [bananaButtonSize, setBananaButtonSize] = React.useState<number>(40);
    const bananaWrapperRef = React.useRef<HTMLDivElement>(null);
    const [bananaPanelOffsetPx, setBananaPanelOffsetPx] = React.useState<number>(0);

    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [prompt]);
    
    const getPlaceholderText = () => {
        if (!isSelectionActive) {
            return generationMode === 'video' ? t('promptBar.placeholderDefaultVideo') : t('promptBar.placeholderDefault');
        }
        if (selectedElementCount === 1) {
            return t('promptBar.placeholderSingle');
        }
        return t('promptBar.placeholderMultiple', selectedElementCount);
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isLoading && prompt.trim()) {
                onGenerate();
            }
        }
    };
    
    const handleSaveEffect = () => {
        let name: string | null = null;
        const canPrompt = typeof window !== 'undefined' && typeof window.prompt === 'function';
        if (canPrompt) {
            name = window.prompt(t('myEffects.saveEffectPrompt'), t('myEffects.defaultName'));
        }
        const fallback = prompt.trim().slice(0, 16) || t('myEffects.defaultName');
        const finalName = (name ?? fallback).trim();
        if (finalName && prompt.trim()) {
            onAddUserEffect({ id: `user_${Date.now()}`, name: finalName, value: prompt });
        }
    };

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!sizeMenuWrapperRef.current) return;
            if (!sizeMenuWrapperRef.current.contains(e.target as Node)) {
                setIsSizeMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    React.useEffect(() => {
        const el = sizeChipButtonRef.current;
        if (!el) return;
        let h = 0;
        const styles = window.getComputedStyle(el);
        const parsed = parseFloat(styles.height);
        if (!Number.isNaN(parsed) && parsed > 0) {
            h = Math.round(parsed);
        } else {
            const rect = el.getBoundingClientRect();
            h = Math.round(rect.height || 0);
        }
        if (h && h > 0) setBananaButtonSize(h);
    }, [imageSize, generationMode, activeImageModel]);

    React.useEffect(() => {
        const updateOffset = () => {
            const pbEl = (containerRef as React.RefObject<HTMLDivElement> | undefined)?.current;
            const bwEl = bananaWrapperRef.current;
            if (!pbEl || !bwEl) return;
            const pb = pbEl.getBoundingClientRect();
            const bw = bwEl.getBoundingClientRect();
            const centerX = pb.left + pb.width / 2;
            const offset = Math.round(centerX - bw.left);
            setBananaPanelOffsetPx(offset);
        };
        updateOffset();
        window.addEventListener('resize', updateOffset);
        return () => window.removeEventListener('resize', updateOffset);
    }, [containerRef, bananaButtonSize, generationMode, activeImageModel]);

    const handlePromptBarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (bananaWrapperRef.current && bananaWrapperRef.current.contains(e.target as Node)) {
            return;
        }
        e.stopPropagation();
    };

    return (
            <div
                ref={containerRef}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-3xl px-4"
                onMouseDown={handlePromptBarMouseDown}
            >
                <div className="relative flex items-center w-full pod-input-group pod-rounded-base p-2">
                    
                    {/* Left Controls Section */}
                    <div className="flex items-center gap-2 pl-1 mr-2 shrink-0">
                        {/* Mode Switch */}
                        <button
                            onClick={() => setGenerationMode(generationMode === 'image' ? 'video' : 'image')}
                            className={`flex items-center justify-center w-9 h-9 pod-rounded-base transition-colors ${generationMode === 'image' ? 'text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 hover:bg-[var(--brand-primary)]/20' : 'text-[var(--brand-accent)] bg-[var(--brand-accent)]/10 hover:bg-[var(--brand-accent)]/20'}`}
                            title={generationMode === 'image' ? t('promptBar.imageMode') : t('promptBar.videoMode')}
                        >
                            {generationMode === 'image' ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 16l-6-6-4 4-2-2-4 4"/></svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><polygon points="10,9 16,12 10,15"/></svg>
                            )}
                        </button>

                        {/* Video Aspect Ratio */}
                        {generationMode === 'video' && (
                            <div className="flex items-center gap-1 bg-[var(--bg-component-solid)]/50 pod-rounded-base p-1 border border-[var(--border-color)] h-9">
                                 <button onClick={() => setVideoAspectRatio('16:9')} className={`flex items-center justify-center w-7 h-7 pod-rounded-lg transition-all ${videoAspectRatio === '16:9' ? 'bg-[var(--brand-accent)] text-[var(--bg-page)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-component)]'}`} title={t('promptBar.aspectRatioHorizontal')}>
                                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="10" rx="2" ry="2"></rect></svg>
                                 </button>
                                <button onClick={() => setVideoAspectRatio('9:16')} className={`flex items-center justify-center w-7 h-7 pod-rounded-lg transition-all ${videoAspectRatio === '9:16' ? 'bg-[var(--brand-accent)] text-[var(--bg-page)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:bg-[var(--bg-component)]'}`} title={t('promptBar.aspectRatioVertical')}>
                                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="2" width="10" height="20" rx="2" ry="2"></rect></svg>
                                 </button>
                            </div>
                        )}

                        {/* Image Size Selector */}
                        {generationMode === 'image' && activeImageModel.toLowerCase() === 'nano-banana-2' && (
                            <div className="relative" ref={sizeMenuWrapperRef}>
                                 <button
                                    onClick={() => setIsSizeMenuOpen(!isSizeMenuOpen)}
                                    ref={sizeChipButtonRef}
                                    className="h-9 min-w-[36px] px-2 pod-rounded-base flex items-center justify-center text-xs font-bold tracking-wider transition-colors hover:bg-[var(--brand-primary)]/20 text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 border border-transparent hover:border-[var(--brand-primary)]/30"
                                >
                                    {imageSize}
                                </button>
                                {isSizeMenuOpen && (
                                    <div className="absolute bottom-full left-0 mb-2 p-1 pod-rounded-base pod-glass-strong flex flex-col gap-1 min-w-[60px] z-50 border border-[var(--border-color)]">
                                        {['1K', '2K', '4K'].map(size => (
                                            <button
                                                key={size}
                                                onClick={() => { setImageSize(size as '1K' | '2K' | '4K'); setIsSizeMenuOpen(false); }}
                                                className={`px-3 py-1.5 pod-rounded-lg text-xs font-bold transition-colors ${imageSize === size ? 'bg-[var(--brand-primary)] text-[var(--bg-page)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-component)]'}`}
                                            >
                                                {size}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Banana Sidebar Button Wrapper */}
                        <div ref={bananaWrapperRef} className="relative flex items-center justify-center w-9 h-9">
                             <BananaSidebar 
                                t={t}
                                setPrompt={setPrompt}
                                onGenerate={onGenerate}
                                disabled={isLoading}
                                promptBarOffsetPx={bananaPanelOffsetPx}
                                buttonSize={36} 
                            />
                        </div>
                        
                        {/* Vertical Divider */}
                        <div className="w-px h-6 bg-[var(--border-color)] mx-1"></div>
                    </div>

                    {/* Middle Input Section */}
                    <div className="flex-grow flex items-center relative h-full px-2">
                         <div className="shrink-0 mr-3">
                             <QuickPrompts 
                                t={t}
                                setPrompt={setPrompt}
                                disabled={!isSelectionActive || isLoading}
                                userEffects={userEffects}
                                onDeleteUserEffect={onDeleteUserEffect}
                            />
                         </div>
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={getPlaceholderText()}
                            className="pod-textarea w-full text-base py-3 max-h-32 resize-none placeholder-[var(--text-muted)] scrollbar-hide font-medium leading-relaxed"
                            disabled={isLoading}
                        />
                    </div>

                    {/* Right Actions Section */}
                    <div className="flex items-center gap-3 pr-1 pl-3 shrink-0">
                        {prompt.trim() && !isLoading && (
                             <button
                                onClick={handleSaveEffect}
                                className="p-2.5 pod-rounded-base text-[var(--text-secondary)] hover:text-[var(--brand-primary)] hover:bg-[var(--bg-component-solid)] transition-colors"
                                title={t('myEffects.saveEffectTooltip')}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
                            </button>
                        )}

                        {/* Integrated Generate Button - Rounded Square & Prominent */}
                        <button
                            onClick={onGenerate}
                            disabled={isLoading || !prompt.trim()}
                            aria-label={t('promptBar.generate')}
                            title={t('promptBar.generate')}
                            className={`flex items-center justify-center w-11 h-11 pod-rounded-base transition-all duration-300 shadow-lg ${
                                isLoading || !prompt.trim() 
                                    ? 'bg-[var(--bg-component-solid)] text-[var(--text-muted)] cursor-not-allowed border border-[var(--border-color)]' 
                                    : 'pod-generate-button hover:scale-105'
                            }`}
                        >
                            {isLoading ? (
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
                            )}
                        </button>
                    </div>

                </div>
            </div>
        );
};
