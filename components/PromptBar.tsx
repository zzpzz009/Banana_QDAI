import React from 'react';
import { QuickPrompts } from './QuickPrompts';
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

    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Reset height
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
        const name = window.prompt(t('myEffects.saveEffectPrompt'), t('myEffects.defaultName'));
        if (name && prompt.trim()) {
            onAddUserEffect({ id: `user_${Date.now()}`, name, value: prompt });
        }
    };

    const containerStyle: React.CSSProperties = {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
    };

    return (
        <div ref={containerRef} className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-full sm:max-w-full md:max-w-2xl lg:max-w-3xl px-4">
            <div 
                style={{ ...containerStyle, ['--pod-ring-width' as unknown as string]: '1px' }}
                className="flex items-center gap-2 p-2 pod-toolbar pod-elevated-outline pod-bar-soft-gradient pod-inner-gradient-ring flex-wrap md:flex-nowrap"
            >
                {/* Left area previously hosting BananaSidebar; now empty to keep layout tight */}
                 <div className="flex-shrink-0 flex items-center rounded-full p-1">
                    <button onClick={() => setGenerationMode('image')} className={`pod-chip ${generationMode === 'image' ? 'active' : ''}`}>{t('promptBar.imageMode')}</button>
                    <button onClick={() => setGenerationMode('video')} className={`pod-chip ${generationMode === 'video' ? 'active' : ''}`}>{t('promptBar.videoMode')}</button>
                </div>
                
                {generationMode === 'video' && (
                    <div className="flex-shrink-0 flex items-center rounded-full p-1 ml-1">
                        <button onClick={() => setVideoAspectRatio('16:9')} aria-label={t('promptBar.aspectRatioHorizontal')} title={t('promptBar.aspectRatioHorizontal')} className="pod-icon-button" style={videoAspectRatio === '16:9' ? { backgroundColor: 'var(--text-accent)', color: 'var(--bg-page)' } : {}}>
                             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="10" rx="2" ry="2"></rect></svg>
                        </button>
                        <button onClick={() => setVideoAspectRatio('9:16')} aria-label={t('promptBar.aspectRatioVertical')} title={t('promptBar.aspectRatioVertical')} className="pod-icon-button" style={videoAspectRatio === '9:16' ? { backgroundColor: 'var(--text-accent)', color: 'var(--bg-page)' } : {}}>
                             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2" ry="2"></rect></svg>
                        </button>
                    </div>
                )}
                {generationMode === 'image' && activeImageModel.toLowerCase() === 'nano-banana-2' && (
                    <div className="flex-shrink-0 flex items-center rounded-full p-1 ml-1">
                        <button onClick={() => setImageSize('1K')} className={`pod-chip ${imageSize === '1K' ? 'active' : ''}`}>1K</button>
                        <button onClick={() => setImageSize('2K')} className={`pod-chip ${imageSize === '2K' ? 'active' : ''}`}>2K</button>
                        <button onClick={() => setImageSize('4K')} className={`pod-chip ${imageSize === '4K' ? 'active' : ''}`}>4K</button>
                    </div>
                )}
                <QuickPrompts 
                    t={t}
                    setPrompt={setPrompt}
                    disabled={!isSelectionActive || isLoading}
                    userEffects={userEffects}
                    onDeleteUserEffect={onDeleteUserEffect}
                />
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={getPlaceholderText()}
                    className="pod-textarea flex-grow placeholder-neutral-400 px-2 overflow-hidden max-h-32"
                    disabled={isLoading}
                />
                {prompt.trim() && !isLoading && (
                    <button
                        onClick={handleSaveEffect}
                        title={t('myEffects.saveEffectTooltip')}
                        className="pod-icon-button flex-shrink-0 w-11 h-11 flex items-center justify-center"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
                    </button>
                )}
                <button
                    onClick={onGenerate}
                    disabled={isLoading || !prompt.trim()}
                    aria-label={t('promptBar.generate')}
                    title={t('promptBar.generate')}
                    className="pod-primary-button flex-shrink-0 w-11 h-11"
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
                </button>
            </div>
        </div>
    );
};
