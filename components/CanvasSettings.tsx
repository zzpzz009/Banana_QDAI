

import React from 'react';
import { fetchUserSelf } from '@/services/httpClient';
import type { WheelAction } from '../types';

interface CanvasSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    canvasBackgroundColor: string;
    onCanvasBackgroundColorChange: (color: string) => void;
    language: 'en' | 'zho';
    setLanguage: (lang: 'en' | 'zho') => void;
    uiTheme: { color: string; opacity: number };
    setUiTheme: (theme: { color: string; opacity: number }) => void;
    buttonTheme: { color: string; opacity: number };
    setButtonTheme: (theme: { color: string; opacity: number }) => void;
    wheelAction: WheelAction;
    setWheelAction: (action: WheelAction) => void;
    t: (key: string) => string;
    apiKey: string;
    setApiKey: (key: string) => void;
    systemToken: string;
    setSystemToken: (key: string) => void;
    userId: string;
    setUserId: (id: string) => void;
    
}

export const CanvasSettings: React.FC<CanvasSettingsProps> = ({
    isOpen,
    onClose,
    canvasBackgroundColor,
    onCanvasBackgroundColorChange,
    language,
    setLanguage,
    uiTheme,
    setUiTheme,
    buttonTheme,
    setButtonTheme,
    wheelAction,
    setWheelAction,
    t,
    apiKey,
    setApiKey,
    systemToken,
    setSystemToken,
    userId,
    setUserId
}) => {
    void uiTheme; void setUiTheme; void buttonTheme; void setButtonTheme;

    const [imageModel, setImageModel] = React.useState<string>(() => {
        try {
            return (localStorage.getItem('WHATAI_IMAGE_MODEL') || (process.env.WHATAI_IMAGE_MODEL as string) || 'gemini-2.5-flash-image');
        } catch {
            return (process.env.WHATAI_IMAGE_MODEL as string) || 'gemini-2.5-flash-image';
        }
    });
    const handleSetModel = (m: string) => {
        setImageModel(m);
        try {
            localStorage.setItem('WHATAI_IMAGE_MODEL', m);
        } catch { void 0; }
    };
    const [balanceData, setBalanceData] = React.useState<{ quota: number; used: number } | null>(null);
    const [balanceLoading, setBalanceLoading] = React.useState<boolean>(false);
    const handleCheckBalance = async () => {
        setBalanceLoading(true);
        setBalanceData(null);
        try {
            if (!userId || !systemToken) {
                setBalanceData(null);
                setBalanceLoading(false);
                return;
            }
            const result = await fetchUserSelf(userId, systemToken);
            const quota = result?.data?.quota ?? 0;
            const used = result?.data?.used_quota ?? 0;
            setBalanceData({ quota, used });
        } catch {
            setBalanceData(null);
        } finally {
            setBalanceLoading(false);
        }
    };

    if (!isOpen) return null;
    return (
        <div 
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                className="relative pod-panel p-4 flex flex-col space-y-2 w-72"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center">
                    <h3 className="text-lg" style={{ color: 'var(--text-heading)', fontWeight: 600 }}>{t('settings.title')}</h3>
                    <button onClick={onClose} aria-label={t('settings.close')} className="pod-icon-button">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div className="-mx-6" style={{ borderTop: '1px solid var(--border-color)' }}></div>

                <div className="space-y-1">
                    <label className="text-xs" style={{ color: 'var(--text-heading)', fontWeight: 500 }}>{t('settings.apiKey')}</label>
                    <div className="flex items-center gap-1">
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={t('settings.apiKeyPlaceholder')}
                            className="flex-1 h-8 p-1.5 rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500"
                        />
                        <button
                            onClick={onClose}
                            className="pod-primary-button h-8 px-3 py-0 text-sm flex items-center justify-center leading-none whitespace-nowrap"
                        >
                            {t('settings.apiKeySave')}
                        </button>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs" style={{ color: 'var(--text-heading)', fontWeight: 500 }}>{t('settings.systemToken')}</label>
                    <input
                        type="password"
                        value={systemToken}
                        onChange={(e) => setSystemToken(e.target.value)}
                        placeholder={t('settings.systemTokenPlaceholder')}
                        className="w-full h-8 p-1.5 rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-xs" style={{ color: 'var(--text-heading)', fontWeight: 500 }}>{t('settings.userId')}</label>
                    <input
                        type="text"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        placeholder={t('settings.userIdPlaceholder')}
                        className="w-full h-8 p-1.5 rounded-md bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500"
                    />
                    <div className="flex items-center gap-1 mt-1">
                        <button onClick={handleCheckBalance} className="pod-chip text-sm">
                            {balanceLoading ? (language === 'zho' ? '查询中...' : 'Checking...') : t('settings.checkBalance')}
                        </button>
                    </div>
                    {balanceData && (
                        <div className="mt-1 space-y-1">
                            <div className="text-xs" style={{ color: 'var(--text-primary)' }}>
                                {t('settings.siteBalancePrefix')}{new Intl.NumberFormat(language === 'zho' ? 'zh-CN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(balanceData.quota / 500000)}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-primary)' }}>
                                {t('settings.siteUsedPrefix')}{new Intl.NumberFormat(language === 'zho' ? 'zh-CN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(balanceData.used / 500000)}
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="text-xs" style={{ color: 'var(--text-heading)', fontWeight: 500 }}>{language === 'zho' ? '图像模型' : 'Image Model'}</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => handleSetModel('gemini-2.5-flash-image')}
                            className={`rounded-md border p-2 text-left bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-yellow-300 ${imageModel === 'gemini-2.5-flash-image' ? 'ring-1 ring-yellow-400 bg-gray-900 border-yellow-500' : 'border-gray-700'}`}
                        >
                            <div className="text-[10px] text-gray-400 h-3 flex items-end">{language === 'zho' ? '模型' : 'Model'}</div>
                            <div className="text-xs font-semibold break-all text-gray-100 leading-snug h-10">gemini-2.5-flash-image</div>
                            <div className="mt-1 text-[10px] text-gray-400 h-3 flex items-end">{language === 'zho' ? '价格' : 'Price'}</div>
                            <div className="text-xs font-semibold text-gray-100 h-4">{language === 'zho' ? '¥0.08/次' : '¥0.08/call'}</div>
                        </button>
                        <button
                            onClick={() => handleSetModel('gemini-3-pro-image-preview')}
                            className={`rounded-md border p-2 text-left bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-yellow-300 ${imageModel === 'gemini-3-pro-image-preview' ? 'ring-1 ring-yellow-400 bg-gray-900 border-yellow-500' : 'border-gray-700'}`}
                        >
                            <div className="text-[10px] text-gray-400 h-3 flex items-end">{language === 'zho' ? '模型' : 'Model'}</div>
                            <div className="text-xs font-semibold break-all text-gray-100 leading-snug h-10">gemini-3-pro-image-preview</div>
                            <div className="mt-1 text-[10px] text-gray-400 h-3 flex items-end">{language === 'zho' ? '价格' : 'Price'}</div>
                            <div className="text-xs font-semibold text-gray-100 h-4">{language === 'zho' ? '¥0.2/次' : '¥0.2/call'}</div>
                        </button>
                        <button
                            onClick={() => handleSetModel('nano-banana')}
                            className={`rounded-md border p-2 text-left bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-yellow-300 ${imageModel === 'nano-banana' ? 'ring-1 ring-yellow-400 bg-gray-900 border-yellow-500' : 'border-gray-700'}`}
                        >
                            <div className="text-[10px] text-gray-400 h-3 flex items-end">{language === 'zho' ? '模型' : 'Model'}</div>
                            <div className="text-xs font-semibold break-all text-gray-100 leading-snug h-10">nano-banana</div>
                            <div className="mt-1 text-[10px] text-gray-400 h-3 flex items-end">{language === 'zho' ? '价格' : 'Price'}</div>
                            <div className="text-xs font-semibold text-gray-100 h-4">{language === 'zho' ? '¥0.16/次' : '¥0.16/call'}</div>
                        </button>
                        <button
                            onClick={() => handleSetModel('nano-banana-2')}
                            className={`rounded-md border p-2 text-left bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-yellow-300 ${imageModel === 'nano-banana-2' ? 'ring-1 ring-yellow-400 bg-gray-900 border-yellow-500' : 'border-gray-700'}`}
                        >
                            <div className="text-[10px] text-gray-400 h-3 flex items-end">{language === 'zho' ? '模型' : 'Model'}</div>
                            <div className="text-xs font-semibold break-all text-gray-100 leading-snug h-10">nano-banana-2</div>
                            <div className="mt-1 text-[10px] text-gray-400 h-3 flex items-end">{language === 'zho' ? '价格' : 'Price'}</div>
                            <div className="text-xs font-semibold text-gray-100 h-4">{language === 'zho' ? '¥0.4/次' : '¥0.4/call'}</div>
                        </button>
                    </div>
                </div>

                {/* Language Settings */}
                <div className="space-y-2">
                    <label className="text-sm" style={{ color: 'var(--text-heading)', fontWeight: 500 }}>{t('settings.language')}</label>
                    <div className="flex items-center gap-2 p-1 rounded-md">
                        <button 
                            onClick={() => setLanguage('en')}
                            className={`flex-1 text-sm pod-chip ${language === 'en' ? 'active' : ''}`}
                        >
                            English
                        </button>
                        <button 
                            onClick={() => setLanguage('zho')}
                            className={`flex-1 text-sm pod-chip ${language === 'zho' ? 'active' : ''}`}
                        >
                            中文
                        </button>
                    </div>
                </div>

                

                
                
                {/* Mouse Wheel Settings */}
                <div className="space-y-2">
                    <label className="text-sm" style={{ color: 'var(--text-heading)', fontWeight: 500 }}>{t('settings.mouseWheel')}</label>
                    <div className="flex items-center gap-2 p-1 rounded-md">
                        <button 
                            onClick={() => setWheelAction('zoom')}
                            className={`flex-1 text-sm pod-chip ${wheelAction === 'zoom' ? 'active' : ''}`}
                        >
                            {t('settings.zoom')}
                        </button>
                        <button 
                            onClick={() => setWheelAction('pan')}
                            className={`flex-1 text-sm pod-chip ${wheelAction === 'pan' ? 'active' : ''}`}
                        >
                            {t('settings.scroll')}
                        </button>
                    </div>
                </div>


                {/* Canvas Settings */}
                <div className="space-y-3">
                     <h4 className="text-sm" style={{ color: 'var(--text-heading)', fontWeight: 500 }}>{t('settings.canvas')}</h4>
                    <div className="flex items-center justify-between">
                        <label htmlFor="bg-color" className="text-sm" style={{ color: 'var(--text-primary)' }}>{t('settings.backgroundColor')}</label>
                        <input
                            id="bg-color"
                            type="color"
                            value={canvasBackgroundColor}
                            onChange={(e) => onCanvasBackgroundColorChange(e.target.value)}
                            className="w-8 h-8 p-0 border-none rounded-md cursor-pointer bg-transparent"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
