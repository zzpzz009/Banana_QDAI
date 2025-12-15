import React, { useEffect, useRef, useState } from 'react';

interface BananaSidebarProps {
  t: (key: string, ...args: unknown[]) => unknown;
  setPrompt: (prompt: string) => void;
  onGenerate: () => void;
  disabled?: boolean;
  /** 从 PromptBar 中心到香蕉按钮的水平偏移（px），用于让面板按 PromptBar 轴居中 */
  promptBarOffsetPx?: number;
  buttonSize?: number;
}

// Base URL helper to support dev ("/") and electron build ("./")
const BASE_URL = ((import.meta as unknown as { env?: { BASE_URL?: string } })?.env?.BASE_URL) || '/';
const withBase = (p: string) => {
  const normalized = p.startsWith('/') ? p.slice(1) : p;
  return `${BASE_URL}${normalized}`;
};

const LEADERAI_URL = 'https://www.leaderai.top/mid-api/lab/image_prompt/index.html';

const BananaIcon: React.FC<{ size?: number }> = ({ size = 40 }) => {
  const primary = withBase('logo/icons8-banana-100.png');
  const fallback = withBase('logo/BA-color.png');
  const svgFallback = withBase('logo/OpenMoji-color_1F34C.svg');
  return (
    <img
      src={primary}
      width={size}
      height={size}
      alt="banana"
      style={{ display: 'block' }}
      onError={(e) => {
        const t = e.currentTarget;
        t.onerror = null;
        t.src = fallback;
        setTimeout(() => { if (t.naturalWidth === 0) t.src = svgFallback; }, 0);
      }}
    />
  );
};

const getCssVar = (name: string, fallback: string) => {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
};

const makeSvgDataUrl = (label: string) => {
  const safe = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const c1 = getCssVar('--brand-primary', '#14b8a6');
  const c2 = getCssVar('--bg-component-solid', '#0f172a');
  const svg = `<?xml version='1.0' encoding='UTF-8'?>\n` +
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80'>\n` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='${c1}'/><stop offset='100%' stop-color='${c2}'/></linearGradient></defs>\n` +
    `<rect width='100%' height='100%' rx='8' ry='8' fill='url(#g)'/>\n` +
    `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='"Montserrat Alternates", sans-serif' font-size='12' fill='#FFFFFF'>${safe}</text>\n` +
    `</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
};

// Photo URLs for weather cards (optimized Unsplash sizes)
const PHOTO_URLS: Record<string, string> = {
  // Chinese
  '晴天': 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=360&q=80',
  '清晨': 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=360&q=80',
  '黄昏': 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=360&q=80',
  '夜景': 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=360&q=80',
  '阴天': 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=360&q=80',
  '雨天': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=360&q=80',
  '雪景': 'https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=360&q=80',
  // English
  'Sunny': 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=360&q=80',
  'Morning': 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=360&q=80',
  'Dusk': 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=360&q=80',
  'Night Scene': 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=360&q=80',
  'Overcast': 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=360&q=80',
  'Rainy': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=360&q=80',
  'Snowy': 'https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=360&q=80',
};

// Normalize label for robust matching (trim, lowercase, remove spaces)
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');

// Try resolve photo url by normalized comparison across keys
const resolvePhotoUrl = (label: string): string | null => {
  const n = normalize(label);
  for (const key in PHOTO_URLS) {
    if (normalize(key) === n) return PHOTO_URLS[key];
  }
  return null;
};

// Map localized card names to local weather icon assets
const ICON_MAP: Record<string, string> = {
  // Chinese
  '晴天': withBase('weather/sun.svg'),
  '清晨': withBase('weather/sunrise.svg'),
  '黄昏': withBase('weather/sunset.svg'),
  '夜景': withBase('weather/night_city.svg'),
  '阴天': withBase('weather/cloud.svg'),
  '雨天': withBase('weather/rain.svg'),
  '雪景': withBase('weather/snow.svg'),
  // English
  'Sunny': withBase('weather/sun.svg'),
  'Morning': withBase('weather/sunrise.svg'),
  'Dusk': withBase('weather/sunset.svg'),
  'Night Scene': withBase('weather/night_city.svg'),
  'Overcast': withBase('weather/cloud.svg'),
  'Rainy': withBase('weather/rain.svg'),
  'Snowy': withBase('weather/snow.svg'),
};

const resolveIconUrl = (label: string): string | null => {
  const n = normalize(label);
  for (const key in ICON_MAP) {
    if (normalize(key) === n) return ICON_MAP[key];
  }
  return null;
};

const getCardImageSrc = (label: string) => {
  const photo = resolvePhotoUrl(label);
  if (photo) return photo;
  const icon = resolveIconUrl(label);
  if (icon) return icon;
  return makeSvgDataUrl(label);
};

const getLocalIconSrc = (label: string): string | null => resolveIconUrl(label);

const extractPromptFromData = (data: unknown): string | null => {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return null;
  const visited = new Set<unknown>();
  const queue: unknown[] = [data];
  const preferredKeys = ['prompt', 'value', 'text', 'content', 'message', 'msg', 'payload'];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);
    if (Array.isArray(current)) {
      for (const item of current) {
        if (typeof item === 'string' && item.trim()) return item;
        queue.push(item);
      }
      continue;
    }
    const obj = current as Record<string, unknown>;
    for (const key of preferredKeys) {
      const v = obj[key];
      if (typeof v === 'string' && v.trim()) return v;
    }
    for (const key in obj) {
      const v = obj[key];
      if (typeof v === 'string' && v.trim()) return v;
      queue.push(v);
    }
  }
  return null;
};

export const BananaSidebar: React.FC<BananaSidebarProps> = ({ t, setPrompt, onGenerate, disabled = false, promptBarOffsetPx = 0, buttonSize }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [cardsCollapsed, setCardsCollapsed] = useState(false);
  const [clipboardSyncActive, setClipboardSyncActive] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const builtInPrompts = t('bananaCards') as { name: string; value: string }[];
  void onGenerate;

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    const handler = () => {
      setIsOpen(false);
    };
    window.addEventListener('banana:promptbar-click', handler);
    return () => {
      window.removeEventListener('banana:promptbar-click', handler);
    };
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e || typeof e !== 'object') return;
      const text = extractPromptFromData(e.data);
      if (!text) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      setPrompt(trimmed);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setPrompt]);

  useEffect(() => {
    if (!isOpen || !clipboardSyncActive) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.readText !== 'function') return;
    let last = '';
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        if (typeof document !== 'undefined') {
          if (document.visibilityState !== 'visible' || !document.hasFocus()) {
            window.setTimeout(tick, 800);
            return;
          }
        }
        const text = await navigator.clipboard.readText();
        if (typeof text === 'string') {
          const trimmed = text.trim();
          if (trimmed && trimmed !== last) {
            last = trimmed;
            setPrompt(trimmed);
          }
        }
      } catch (error) {
        void error;
      } finally {
        if (!stopped) {
          window.setTimeout(tick, 800);
        }
      }
    };
    tick();
    return () => {
      stopped = true;
    };
  }, [clipboardSyncActive, isOpen, setPrompt]);

  const handleSelect = (value: string) => {
    if (disabled) return;
    setPrompt(value);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        disabled={disabled}
        aria-label="Banana Presets"
        title="Banana Presets"
        className={`flex items-center justify-center pod-rounded-base transition-all duration-300 shadow-lg group ${
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:scale-105 hover:shadow-[var(--shadow-glow)]'
        }`}
        style={{
          width: typeof buttonSize === 'number' ? buttonSize : 36,
          height: typeof buttonSize === 'number' ? buttonSize : 36,
          background: 'var(--brand-primary)',
          color: 'var(--bg-page)',
        }}
      >
        <div className="transform transition-transform duration-300 group-hover:rotate-12">
          <BananaIcon size={20} />
        </div>
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full mb-3 sm:w-full md:w-[48rem] lg:w-[64rem] max-w-[90vw] pod-panel pod-panel-transparent pod-panel-rounded-xl p-3 overflow-x-auto overflow-y-hidden pod-scrollbar-x"
          style={{
            left: '50%',
            transform: `translateX(calc(-50% + ${Number(promptBarOffsetPx || 0)}px)) translateY(-40px)`
          }}
        >
          <div className="flex flex-col gap-3" style={{ height: 'min(600px, 80vh)' }}>
            <div className="w-full flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  LeaderAI Prompt Lab
                </span>
                <button
                  type="button"
                  onClick={() => setCardsCollapsed(prev => !prev)}
                  className="inline-flex items-center justify-center w-6 h-6 pod-rounded-full text-[var(--text-secondary)] hover:text-[var(--brand-primary)] hover:bg-[var(--bg-component-solid)] transition-colors text-xs"
                  aria-label="Toggle banana cards"
                >
                  {cardsCollapsed ? '▾' : '▴'}
                </button>
              </div>
              <div
                className="w-full flex-1 pod-rounded-lg overflow-hidden border border-[var(--border-color)] bg-[var(--bg-component)]"
                style={{ minHeight: 0 }}
                onMouseEnter={() => setClipboardSyncActive(true)}
                onMouseLeave={() => setClipboardSyncActive(false)}
              >
                <iframe
                  src={LEADERAI_URL}
                  title="LeaderAI Prompt Lab"
                  className="w-full h-full border-0"
                  loading="lazy"
                  allow="clipboard-read; clipboard-write"
                  referrerPolicy="no-referrer"
                  style={{
                    width: '125%',
                    height: '125%',
                    transform: 'scale(0.8)',
                    transformOrigin: 'top left',
                  }}
                />
              </div>
            </div>
            {!cardsCollapsed && (
              <div className="w-full">
                <div className="flex flex-row gap-2 justify-center flex-wrap md:flex-nowrap mt-2">
                  {(builtInPrompts || []).slice(0, 7).map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelect(item.value)}
                      title={item.name}
                      className="group relative cursor-pointer transform transition-all duration-500 hover:scale-105 hover:-translate-y-1 flex-shrink-0 w-32"
                      style={{ padding: 0 }}
                    >
                      <div className="pod-card-glass pod-rounded-lg overflow-hidden">
                        <div className="aspect-square relative overflow-hidden">
                          <img
                            src={getCardImageSrc(item.name)}
                            alt={item.name}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            onError={(e) => {
                              const fb = getLocalIconSrc(item.name);
                              e.currentTarget.src = fb ?? makeSvgDataUrl(item.name);
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <h3
                              className="font-semibold text-white text-base leading-tight drop-shadow-md text-center px-2"
                              style={{
                                fontFamily:
                                  "'Montserrat Alternates', sans-serif",
                                fontSize: '1.2em',
                                textShadow:
                                  '0 2px 6px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.35)',
                                letterSpacing: '0.06em'
                              }}
                              title={item.name}
                            >
                              {item.name}
                            </h3>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 bg-white/40 pod-rounded-full"/>
                                <span className="w-1.5 h-1.5 bg-white/30 pod-rounded-full"/>
                                <span className="w-1.5 h-1.5 bg-white/20 pod-rounded-full"/>
                                <span className="w-1.5 h-1.5 bg-white/10 pod-rounded-full"/>
                                <span className="w-1.5 h-1.5 bg-white/5 pod-rounded-full"/>
                              </div>
                              <span className="text-[10px] text-white/80 bg-white/15 backdrop-blur-xl px-1.5 py-0.5 pod-rounded-lg">
                                {t('bananaSidebar.presetLabel')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BananaSidebar;
