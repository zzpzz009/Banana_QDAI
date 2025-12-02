import React from 'react';
import { QuickPrompts } from './QuickPrompts';
import { BananaSidebar } from '@/features/sidebar/BananaSidebar';
import { Panel, IconButton, Chip, Button, Toolbar, Textarea } from '../../ui';
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
    const [inputExpanded, setInputExpanded] = React.useState<boolean>(false);

    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
            const h = textareaRef.current.scrollHeight;
            setInputExpanded(h > 56);
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

    const containerStyle: React.CSSProperties = {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        backgroundColor: 'rgba(33, 31, 38, 0.6)'
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

    return (
        <div ref={containerRef} className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-full sm:max-w-full md:max-w-2xl lg:max-w-3xl px-4">
            <Toolbar 
                style={{ 
                    ...containerStyle, 
                    ['--pod-ring-width' as unknown as string]: '1px', 
                    ['--pod-toolbar-radius' as unknown as string]: '22px',
                    ['--toolbar-bg-color' as unknown as string]: 'rgba(33, 31, 38, 0.6)'
                }}
                elevated
                softGradient
                className="flex items-center gap-1 p-2 flex-wrap md:flex-nowrap"
            >
                <div className="flex-shrink-0 flex items-center rounded-full p-1">
                    <Chip
                        onClick={() => setGenerationMode(generationMode === 'image' ? 'video' : 'image')}
                        className={`${generationMode === 'image' ? 'pod-chip-image' : 'pod-chip-video'}`}
                        active
                    >
                        {generationMode === 'image' ? (
                            <>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 16l-6-6-4 4-2-2-4 4"/></svg>
                                {t('promptBar.imageMode')}
                            </>
                        ) : (
                            <>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><rect x="3" y="4" width="18" height="16" rx="3"/><polygon points="10,9 16,12 10,15"/></svg>
                                {t('promptBar.videoMode')}
                            </>
                        )}
                    </Chip>
                </div>
                
                {generationMode === 'video' && (
                    <div className="flex-shrink-0 flex items-center rounded-full p-1">
                        <IconButton onClick={() => setVideoAspectRatio('16:9')} aria-label={t('promptBar.aspectRatioHorizontal')} title={t('promptBar.aspectRatioHorizontal')} style={videoAspectRatio === '16:9' ? { backgroundColor: 'var(--text-accent)', color: 'var(--bg-page)' } : {}}>
                             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="10" rx="2" ry="2"></rect></svg>
                        </IconButton>
                        <IconButton onClick={() => setVideoAspectRatio('9:16')} aria-label={t('promptBar.aspectRatioVertical')} title={t('promptBar.aspectRatioVertical')} style={videoAspectRatio === '9:16' ? { backgroundColor: 'var(--text-accent)', color: 'var(--bg-page)' } : {}}>
                             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2" ry="2"></rect></svg>
                        </IconButton>
                    </div>
                )}
                {generationMode === 'image' && activeImageModel.toLowerCase() === 'nano-banana-2' ? (
                    <div className="relative flex-shrink-0 flex items-center rounded-full p-1" ref={sizeMenuWrapperRef} style={{ alignSelf: 'center' }}>
                        <Chip
                            onClick={() => setIsSizeMenuOpen((v) => !v)}
                            className={`pod-chip-size pod-chip-circle pod-inner-gradient-ring ${imageSize === '4K' ? 'pod-chip-outline-sheen-4k pod-text-gold-sheen pod-chip-bg-4k' : ''} ${imageSize === '2K' ? 'pod-chip-outline-sheen-2k pod-text-silver-sheen pod-chip-bg-2k' : ''} ${imageSize === '1K' ? 'pod-chip-outline-sheen-1k pod-text-copper-sheen pod-chip-bg-1k' : ''}`}
                            title={imageSize}
                            aria-label={imageSize}
                            ref={sizeChipButtonRef}
                            active
                        >
                            {imageSize}
                        </Chip>
                        {isSizeMenuOpen && (
                            <Panel className="absolute bottom-full left-1/2 -translate-x-1/2 mb-6 pod-panel-pill p-2 flex flex-col items-center gap-2">
                                <Chip
                                    onClick={() => { setImageSize('1K'); setIsSizeMenuOpen(false); }}
                                    className={`pod-chip-size pod-chip-circle pod-inner-gradient-ring pod-chip-outline-sheen-1k pod-text-copper-sheen pod-chip-bg-1k`}
                                    style={{ backgroundColor: 'rgba(33,31,38,0.72)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', boxShadow: 'inset 0 1px 4px rgba(255,255,255,0.05), 0 3px 10px rgba(0,0,0,0.25)' }}
                                    title="1K"
                                    aria-label="1K"
                                    active={imageSize === '1K'}
                                >
                                    1K
                                </Chip>
                                <Chip
                                    onClick={() => { setImageSize('2K'); setIsSizeMenuOpen(false); }}
                                    className={`pod-chip-size pod-chip-circle pod-inner-gradient-ring pod-chip-outline-sheen-2k pod-text-silver-sheen pod-chip-bg-2k`}
                                    style={{ backgroundColor: 'rgba(33,31,38,0.72)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', boxShadow: 'inset 0 1px 4px rgba(255,255,255,0.05), 0 3px 10px rgba(0,0,0,0.25)' }}
                                    title="2K"
                                    aria-label="2K"
                                    active={imageSize === '2K'}
                                >
                                    2K
                                </Chip>
                                <Chip
                                    onClick={() => { setImageSize('4K'); setIsSizeMenuOpen(false); }}
                                    className={`pod-chip-size pod-chip-circle pod-inner-gradient-ring pod-chip-outline-sheen-4k pod-text-gold-sheen pod-chip-bg-4k`}
                                    style={{ backgroundColor: 'rgba(33,31,38,0.72)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', boxShadow: 'inset 0 1px 4px rgba(255,255,255,0.05), 0 3px 10px rgba(0,0,0,0.25)' }}
                                    title="4K"
                                    aria-label="4K"
                                    active={imageSize === '4K'}
                                >
                                    4K
                                </Chip>
                            </Panel>
                        )}
                    </div>
                ) : generationMode === 'image' ? (
                    <div className="flex-shrink-0 flex items-center rounded-full p-1">
                        <Chip className="pod-chip-circle-sheen" disabled title="1K" aria-label="1K" ref={sizeChipButtonRef}>1K</Chip>
                    </div>
                ) : null}
                <div className="flex-shrink-0 flex items-center rounded-full p-1" style={{ alignSelf: 'center' }} ref={bananaWrapperRef}>
                    <BananaSidebar 
                        t={t}
                        setPrompt={setPrompt}
                        onGenerate={onGenerate}
                        disabled={isLoading}
                        promptBarOffsetPx={bananaPanelOffsetPx}
                        buttonSize={bananaButtonSize}
                    />
                </div>
                <div className={`pod-input-group ${inputExpanded ? 'pod-input-group-expanded' : ''} flex-grow ml-3`}>
                    <QuickPrompts 
                        t={t}
                        setPrompt={setPrompt}
                        disabled={!isSelectionActive || isLoading}
                        userEffects={userEffects}
                        onDeleteUserEffect={onDeleteUserEffect}
                    />
                    <Textarea
                        ref={textareaRef}
                        rows={1}
                        value={prompt}
                        onChange={(e) => setPrompt((e.target as HTMLTextAreaElement).value)}
                        onKeyDown={handleKeyDown}
                        placeholder={getPlaceholderText()}
                        className="flex-grow placeholder-neutral-400 px-2 overflow-hidden max-h-32"
                        disabled={isLoading}
                    />
                    {prompt.trim() && !isLoading && (
                        <IconButton
                            onClick={handleSaveEffect}
                            title={t('myEffects.saveEffectTooltip')}
                            noHoverHighlight
                            className="save-effect-button flex-shrink-0 w-11 h-11 flex items-center justify-center"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
                        </IconButton>
                    )}
                </div>
                <Button
                    onClick={onGenerate}
                    disabled={isLoading || !prompt.trim()}
                    aria-label={t('promptBar.generate')}
                    title={t('promptBar.generate')}
                    className="pod-generate-button flex-shrink-0 w-11 h-11 ml-3"
                    style={{ 
                        borderRadius: '999px', 
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    {isLoading ? (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                       generationMode === 'image' 
                        ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                        : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg>
                    )}
                </Button>
            </Toolbar>
        </div>
    );
};
