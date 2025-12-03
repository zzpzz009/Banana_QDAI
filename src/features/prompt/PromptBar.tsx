import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QuickPrompts } from './QuickPrompts';
import { BananaSidebar } from '@/features/sidebar/BananaSidebar';
import { IconButton, Textarea } from '../../ui';
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
    imageAspectRatio: string;
    setImageAspectRatio: (ratio: string) => void;
    setImageModel: (model: string) => void;
}

const MODELS = [
    { id: 'gemini-2.5-flash-image', label: 'gemini-2.5-flash', short: 'Flash' },
    { id: 'gemini-3-pro-image-preview', label: 'gemini-3-pro', short: 'Pro 3' },
    { id: 'nano-banana', label: 'nano-banana', short: 'Nano' },
    { id: 'nano-banana-2', label: 'nano-banana-2', short: 'NB2' },
];

const ASPECT_RATIOS = [
    { id: 'auto', label: 'auto' },
    { id: '1:1', label: '1:1' },
    { id: '16:9', label: '16:9' },
    { id: '9:16', label: '9:16' },
    { id: '4:3', label: '4:3' },
    { id: '3:4', label: '3:4' },
    { id: '3:2', label: '3:2' },
    { id: '2:3', label: '2:3' },
    { id: '5:4', label: '5:4' },
    { id: '4:5', label: '4:5' },
    { id: '21:9', label: '21:9' },
];

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
    imageAspectRatio,
    setImageAspectRatio,
    setImageModel
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const [isRatioMenuOpen, setIsRatioMenuOpen] = useState(false);
    const [modelMenuAnchor, setModelMenuAnchor] = useState<{ left: number; top: number; width: number } | null>(null);
    const [ratioMenuAnchor, setRatioMenuAnchor] = useState<{ left: number; top: number; width: number } | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const modelMenuRef = useRef<HTMLDivElement>(null);
    const ratioMenuRef = useRef<HTMLDivElement>(null);
    const modelButtonRef = useRef<HTMLButtonElement>(null);
    const ratioButtonRef = useRef<HTMLButtonElement>(null);
    const modelPortalRef = useRef<HTMLDivElement>(null);
    const ratioPortalRef = useRef<HTMLDivElement>(null);
    const blockCollapseUntilRef = useRef<number>(0);

    // Auto-expand if prompt is not empty
    useEffect(() => {
        if (prompt.trim().length > 0 && !isExpanded) {
            const id = setTimeout(() => setIsExpanded(true), 0);
            return () => clearTimeout(id);
        }
    }, [prompt, isExpanded]);

    // Click outside to collapse
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const inWrapper = wrapperRef.current?.contains(target) ?? false;
            const inModelButton = modelButtonRef.current?.contains(target) ?? false;
            const inModelPortal = modelPortalRef.current?.contains(target) ?? false;
            const inRatioButton = ratioButtonRef.current?.contains(target) ?? false;
            const inRatioPortal = ratioPortalRef.current?.contains(target) ?? false;

            if (!inModelButton && !inModelPortal) {
                setIsModelMenuOpen(false);
            }
            if (!inRatioButton && !inRatioPortal) {
                setIsRatioMenuOpen(false);
            }

            const now = Date.now();
            if (prompt.trim().length === 0 && !(inWrapper || inModelButton || inModelPortal || inRatioButton || inRatioPortal) && now >= blockCollapseUntilRef.current) {
                setIsExpanded(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [prompt]);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        let raf = requestAnimationFrame(() => {
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        });
        return () => cancelAnimationFrame(raf);
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

    // Handle Banana Sidebar selection
    const handleBananaSelect = (val: string) => {
        setPrompt(val);
        setIsExpanded(true);
    };

    const activeModelLabel = MODELS.find(m => m.id === activeImageModel)?.label || activeImageModel || 'Model';
    const effectiveSize = activeImageModel === 'nano-banana-2' ? imageSize : '1K';
    const sizeDisabled = activeImageModel !== 'nano-banana-2';

    return (
        <div ref={containerRef} className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] flex justify-center">
            <motion.div
                ref={wrapperRef}
                layout
                initial={false}
                animate={{
                    width: isExpanded ? 580 : 180,
                    height: isExpanded ? 'auto' : 56,
                    borderRadius: isExpanded ? 24 : 999
                }}
                transition={{ type: "spring", stiffness: 220, damping: 28, delay: isExpanded ? 0 : 0.18 }}
                className="relative overflow-hidden bg-[#18181b]/95 border border-white/10 shadow-2xl backdrop-blur-xl"
                style={{
                    boxShadow: '0 20px 40px -10px rgba(0,0,0,0.6)',
                    willChange: 'width, height, border-radius'
                }}
            >
                <AnimatePresence mode="sync">
                    {!isExpanded ? (
                        /* Collapsed Pill View */
                        <motion.div
                            key="collapsed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, transition: { duration: 0.2, delay: isExpanded ? 0 : 0.18 } }}
                            exit={{ opacity: 0, transition: { duration: 0.2, delay: isExpanded ? 0.18 : 0 } }}
                            className="absolute inset-0 flex items-center gap-3 w-full px-3 cursor-pointer"
                            onClick={() => setIsExpanded(true)}
                        >
                            <div className="flex items-center gap-3 w-full">
                                <div className="flex-shrink-0">
                                    <BananaSidebar
                                        t={t}
                                        setPrompt={handleBananaSelect}
                                        onGenerate={() => { }}
                                        disabled={isLoading}
                                        promptBarOffsetPx={0}
                                        buttonSize={40}
                                    />
                                </div>
                                <span className="text-neutral-400 text-sm font-medium truncate select-none">
                                    Ask Banana...
                                </span>
                            </div>
                        </motion.div>
                    ) : (
                        /* Expanded Card View */
                        <motion.div
                            key="expanded"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, transition: { duration: 0.2, delay: isExpanded ? 0.18 : 0 } }}
                            exit={{ opacity: 0, transition: { duration: 0.2 } }}
                            className="flex flex-col px-3 pt-1 pb-2 gap-0 w-[580px]" // Reduced padding and gap
                        >
                            {/* Body: Input Area */}
                            <div className="relative group rounded-xl px-1 transition-colors">
                                {/* Top-Right Controls: QuickPrompts + Mode Switcher */}
                            <div className="absolute top-1 right-1 z-10 flex items-center gap-2">
                                <QuickPrompts
                                        t={t}
                                        setPrompt={setPrompt}
                                        disabled={!isSelectionActive || isLoading}
                                        userEffects={userEffects}
                                        onDeleteUserEffect={onDeleteUserEffect}
                                        className="w-10 h-10 text-neutral-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all"
                                    />
                                    {/* Mode Switcher */}
                                    <div className="flex bg-black/20 rounded-full p-0.5 border border-white/5">
                                        <button
                                            onClick={() => setGenerationMode('image')}
                                            className={`p-1.5 rounded-full transition-all ${generationMode === 'image' ? 'bg-[#3f3f46] text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                                            title="Image Mode"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                                        </button>
                                        <button
                                            onClick={() => setGenerationMode('video')}
                                            className={`p-1.5 rounded-full transition-all ${generationMode === 'video' ? 'bg-[#3f3f46] text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                                            title="Video Mode"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                                        </button>
                                    </div>
                                </div>

                                <Textarea
                                    ref={textareaRef}
                                    rows={3}
                                    value={prompt}
                                    onChange={(e) => setPrompt((e.target as HTMLTextAreaElement).value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={getPlaceholderText()}
                                    className="w-full bg-transparent text-neutral-200 placeholder-neutral-500 resize-none focus:outline-none text-[15px] leading-relaxed font-light"
                                    style={{ minHeight: '60px', border: 'none', padding: '18px 130px 18px 12px', transition: 'height 150ms ease', overflow: 'hidden' }}
                                    disabled={isLoading}
                                    autoFocus
                                />
                                {prompt.trim() && !isLoading && (
                                    <div className="absolute bottom-0 right-0">
                                        <IconButton
                                            onClick={handleSaveEffect}
                                            title={t('myEffects.saveEffectTooltip')}
                                            noHoverHighlight
                                            className="w-7 h-7 flex items-center justify-center text-neutral-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
                                        </IconButton>
                                    </div>
                                )}
                            </div>

                            {/* Footer: Controls Row */}
                            <div className="flex items-center justify-between pt-1">
                                {/* Left: Banana Button */}
                                <div className="relative">
                                    <BananaSidebar
                                        t={t}
                                        setPrompt={setPrompt}
                                        onGenerate={onGenerate}
                                        disabled={isLoading}
                                        promptBarOffsetPx={0}
                                        buttonSize={36}
                                    />
                                </div>

                                {/* Right: Settings & Generate */}
                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                    {/* Model Selector */}
                                    {generationMode === 'image' && (
                                        <div className="relative" ref={modelMenuRef}>
                                            <button
                                                ref={modelButtonRef}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                                setModelMenuAnchor({ left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width) });
                                                setIsModelMenuOpen(!isModelMenuOpen);
                                            }}
                                                className="h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-medium text-neutral-300 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                                            >
                                                {activeModelLabel}
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
                                            </button>
                                            {isModelMenuOpen && modelMenuAnchor && createPortal(
                                                <motion.div
                                                    ref={modelPortalRef}
                                                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    style={{ position: 'fixed', left: Math.round(modelMenuAnchor.left + modelMenuAnchor.width / 2 - 192 / 2), bottom: Math.round(window.innerHeight - modelMenuAnchor.top + 8), zIndex: 10000, width: 192 }}
                                                    className="bg-[#27272a] border border-white/10 rounded-xl shadow-xl overflow-hidden py-1"
                                                >
                                                    {MODELS.map(m => (
                                                        <button
                                                            key={m.id}
                                                            onClick={(e) => { e.stopPropagation(); setImageModel(m.id); setIsModelMenuOpen(false); setIsExpanded(true); }}
                                                            className={`w-full px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors flex items-center justify-between ${activeImageModel === m.id ? 'text-yellow-400 font-medium' : 'text-neutral-300'}`}
                                                        >
                                                            <span>{m.label}</span>
                                                            {activeImageModel === m.id && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                                                        </button>
                                                    ))}
                                                </motion.div>, document.body)
                                            }
                                        </div>
                                    )}

                                    {/* Size Selector */}
                                    {generationMode === 'image' && (
                                        <div className="flex bg-white/5 rounded-xl p-1 border border-white/5 h-9 items-center">
                                            {(['1K', '2K', '4K'] as const).map((size) => (
                                                <button
                                                    key={size}
                                                    onClick={() => { if (!sizeDisabled) setImageSize(size); }}
                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${effectiveSize === size ? 'bg-[#4A4458] text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'} ${sizeDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                                                    aria-disabled={sizeDisabled}
                                                >
                                                    <span className={effectiveSize === size && size === '4K' ? 'pod-text-gold-sheen' : ''}>
                                                        {size}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Aspect Ratio Selector */}
                                    <div className="relative" ref={ratioMenuRef}>
                                        <button
                                            ref={ratioButtonRef}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onClick={(e) => {
                                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                                setRatioMenuAnchor({ left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width) });
                                                setIsRatioMenuOpen(!isRatioMenuOpen);
                                            }}
                                            className="h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-medium text-neutral-300 hover:text-neutral-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                                            title="Aspect Ratio"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="10" rx="2" ry="2" /></svg>
                                            {generationMode === 'image' ? imageAspectRatio : videoAspectRatio}
                                        </button>
                                        {isRatioMenuOpen && ratioMenuAnchor && createPortal(
                                            <motion.div
                                                ref={ratioPortalRef}
                                                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                style={{ 
                                                    position: 'fixed', 
                                                    left: Math.round(ratioMenuAnchor.left + ratioMenuAnchor.width / 2 - (generationMode === 'image' ? 240 : 96) / 2), 
                                                    bottom: Math.round(window.innerHeight - ratioMenuAnchor.top + 8), 
                                                    zIndex: 10000, 
                                                    width: generationMode === 'image' ? 240 : 96 
                                                }}
                                                className={`bg-[#27272a] border border-white/10 rounded-xl shadow-xl overflow-hidden py-1 ${generationMode === 'image' ? 'grid grid-cols-3 gap-1 p-1' : ''}`}
                                            >
                                                {generationMode === 'image' ? (
                                                    ASPECT_RATIOS.map(r => (
                                                        <button
                                                            key={r.id}
                                                            onClick={() => { setImageAspectRatio(r.id); setIsRatioMenuOpen(false); setIsExpanded(true); blockCollapseUntilRef.current = Date.now() + 800; requestAnimationFrame(() => { textareaRef.current?.focus(); }); }}
                                                             className={`w-full px-1 py-1.5 text-center text-xs hover:bg-white/5 rounded-md transition-colors ${imageAspectRatio === r.id ? 'bg-white/10 text-yellow-400 font-medium' : 'text-neutral-300'}`}
                                                         >
                                                             {r.label}
                                                         </button>
                                                     ))
                                                 ) : (
                                                    ['16:9', '9:16'].map(r => (
                                                        <button
                                                            key={r}
                                                            onClick={() => { setVideoAspectRatio(r as '16:9' | '9:16'); setIsRatioMenuOpen(false); setIsExpanded(true); blockCollapseUntilRef.current = Date.now() + 800; requestAnimationFrame(() => { textareaRef.current?.focus(); }); }}
                                                             className={`w-full px-3 py-1.5 text-left text-xs hover:bg-white/5 transition-colors ${videoAspectRatio === r ? 'text-yellow-400 font-medium' : 'text-neutral-300'}`}
                                                         >
                                                             {r}
                                                         </button>
                                                     ))
                                                 )}
                                            </motion.div>, document.body)
                                        }
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        onClick={onGenerate}
                                        disabled={isLoading || !prompt.trim()}
                                        className="h-9 px-5 rounded-xl font-bold text-sm text-[#062102] transition-all active:scale-[0.98] shadow-lg shadow-black/20 whitespace-nowrap bg-[#B6F298] hover:bg-[#A4DA89] border border-white/5 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <svg className="animate-spin h-4 w-4 text-[#062102]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            t('promptBar.generate')
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
