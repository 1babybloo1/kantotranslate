
import React, { useState, useEffect, useMemo, useId, useRef } from 'react';
import { translateWithSlangStream, speakText } from './services/geminiService';
import { TranslationResult, LANGUAGES, SlangDetail, THEMES, ThemeType, ThemeConfig, HistoryItem, VibeMode, LanguageCode } from './types';
import LanguageSelector from './components/LanguageSelector';

const STORAGE_KEY = 'kanto_history';
const SETTINGS_KEY_SOURCE = 'kanto_setting_source_lang';
const SETTINGS_KEY_TARGET = 'kanto_setting_target_lang';
const SETTINGS_KEY_VIBE = 'kanto_setting_vibe_mode';

const SlangChip: React.FC<{ detail: SlangDetail, theme: ThemeConfig, lowPerf?: boolean }> = ({ detail, theme, lowPerf }) => {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  return (
    <div className="flex flex-col w-full sm:w-auto">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className={`group relative px-4 py-2 rounded-2xl text-xs font-mono transition-all text-left flex items-center justify-between gap-3 border overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 ${
          isOpen 
            ? `bg-${theme.id}-500/20 text-${theme.accent} border-${theme.id}-500/40 shadow-xl shadow-${theme.id}-500/10 scale-[1.02] focus:ring-${theme.primary}` 
            : `bg-slate-800/40 text-slate-400 border-slate-800/80 hover:bg-slate-800 hover:border-slate-700 hover:text-slate-200 focus:ring-slate-500`
        }`}
      >
        <span className="relative z-10 font-bold">{detail.term}</span>
        <svg 
          className={`relative z-10 w-3 h-3 transition-transform duration-500 ease-out ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
        {isOpen && !lowPerf && (
          <div className={`absolute inset-0 bg-gradient-to-r from-${theme.id}-500/5 to-transparent animate-pulse`} aria-hidden="true" />
        )}
      </button>
      <div 
        id={contentId}
        className={`grid-transition ${isOpen ? 'expanded' : ''}`}
        aria-hidden={!isOpen}
      >
        <div className="grid-content">
          <div className="mt-2 p-4 glass rounded-2xl border border-white/5 shadow-inner">
            <p className={`text-[12px] text-slate-200 font-medium mb-2 leading-relaxed selection:bg-${theme.id}-500/40`}>
              {detail.meaning}
            </p>
            <div className="flex items-start gap-2 pt-2 border-t border-white/5">
              <span className={`text-[10px] font-black text-${theme.accent} uppercase tracking-tighter shrink-0 mt-0.5 opacity-80`}>Context:</span>
              <p className="text-[11px] text-slate-400 italic leading-snug">
                {detail.context}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ErrorState: React.FC<{ errorKey: string; onRetry: () => void; theme: ThemeConfig }> = ({ errorKey, onRetry, theme }) => {
  const errorMap: Record<string, { title: string, message: string }> = {
    'QUOTA_EXCEEDED': {
      title: "Vibe overload",
      message: "Our AI is strictly on a budget right now. Take a quick break and try again in a few minutes."
    },
    'SAFETY_BLOCK': {
      title: "Content filter triggered",
      message: "The vibe check failed. This specific text might contain words or concepts flagged by safety filters."
    },
    'CONFIG_ERROR': {
      title: "System misalignment",
      message: "There's an issue with the AI configuration."
    },
    'PARSE_ERROR': {
      title: "Linguistic hiccup",
      message: "The AI stuttered while processing that. Try simplifying the text slightly."
    },
    'OFFLINE': {
      title: "Vibe signal lost",
      message: "You're floating in offline space. Check your connection to get new translations."
    },
    'EMPTY_RESPONSE': {
      title: "Silence from the void",
      message: "The AI gave us nothing. Literally. Try entering more text!"
    },
    'UNKNOWN_ERROR': {
      title: "Glitched in the matrix",
      message: "Something went wrong. Re-vibe and try again?"
    }
  };

  const { title, message } = errorMap[errorKey] || errorMap['UNKNOWN_ERROR'];

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-500" role="alert">
      <div className="bg-red-500/10 border border-red-500/20 rounded-[2rem] p-6 text-center">
        <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4" aria-hidden="true">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-red-200 font-bold mb-1 uppercase tracking-wider text-xs">{title}</h3>
        <p className="text-red-400/80 text-sm mb-4 leading-relaxed">{message}</p>
        <button 
          onClick={onRetry}
          className="px-6 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          Try to Re-vibe
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  
  // Persistent state initializers
  const [sourceLang, setSourceLang] = useState<LanguageCode>(() => (localStorage.getItem(SETTINGS_KEY_SOURCE) as LanguageCode) || 'auto');
  const [targetLang, setTargetLang] = useState<LanguageCode>(() => (localStorage.getItem(SETTINGS_KEY_TARGET) as LanguageCode) || 'tl');
  const [vibeMode, setVibeMode] = useState<VibeMode>(() => (localStorage.getItem(SETTINGS_KEY_VIBE) as VibeMode) || 'casual');
  
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [activeThemeId, setActiveThemeId] = useState<ThemeType>('indigo');
  const [lowPerf, setLowPerf] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [showPhonetic, setShowPhonetic] = useState(true);

  const lastTranslatedState = useRef<{
    text: string;
    source: string;
    target: string;
    vibe: VibeMode;
  } | null>(null);

  const theme = useMemo(() => THEMES.find(t => t.id === activeThemeId) || THEMES[0], [activeThemeId]);
  const inputAreaId = useId();

  const isTargetSymbolBased = useMemo(() => {
    return LANGUAGES.find(l => l.code === targetLang)?.isSymbolBased;
  }, [targetLang]);

  // Save settings when changed
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY_SOURCE, sourceLang);
    localStorage.setItem(SETTINGS_KEY_TARGET, targetLang);
    localStorage.setItem(SETTINGS_KEY_VIBE, vibeMode);
  }, [sourceLang, targetLang, vibeMode]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const updateHistory = (newItem: HistoryItem) => {
    const newHistory = [newItem, ...history].slice(0, 20);
    setHistory(newHistory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    lastTranslatedState.current = null;
    setIsConfirmingClear(false);
  };

  const handleTranslate = async () => {
    const textToTranslate = inputText.trim();
    if (!textToTranslate) return;

    if (
      lastTranslatedState.current &&
      lastTranslatedState.current.text === textToTranslate &&
      lastTranslatedState.current.source === sourceLang &&
      lastTranslatedState.current.target === targetLang &&
      lastTranslatedState.current.vibe === vibeMode
    ) {
      if (result) return;
    }

    if (!isOnline) {
      setErrorKey('OFFLINE');
      return;
    }
    
    setIsLoading(true);
    setIsStreaming(true);
    setStreamingText('');
    setResult(null);
    setErrorKey(null);

    try {
      const finalResult = await translateWithSlangStream(
        textToTranslate, 
        sourceLang, 
        targetLang, 
        vibeMode,
        (chunk) => {
          setStreamingText(chunk);
          setIsLoading(false);
        }
      );

      setResult(finalResult);
      setStreamingText('');
      
      const newItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        inputText: textToTranslate,
        sourceLang,
        targetLang,
        vibeMode,
        result: finalResult
      };
      
      updateHistory(newItem);
      
      lastTranslatedState.current = {
        text: textToTranslate,
        source: sourceLang,
        target: targetLang,
        vibe: vibeMode
      };
    } catch (err: any) {
      setErrorKey(err.message || 'UNKNOWN_ERROR');
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const restoreFromHistory = (item: HistoryItem) => {
    setInputText(item.inputText);
    setSourceLang(item.sourceLang as LanguageCode);
    setTargetLang(item.targetLang as LanguageCode);
    setVibeMode(item.vibeMode);
    setResult(item.result);
    setStreamingText('');
    setErrorKey(null);
    
    lastTranslatedState.current = {
      text: item.inputText,
      source: item.sourceLang,
      target: item.targetLang,
      vibe: item.vibeMode
    };

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const swapLanguages = () => {
    if (sourceLang === 'auto') return;
    const oldSource = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(oldSource);
  };

  const copyToClipboard = () => {
    if (result) {
      const textToCopy = showPhonetic && result.transliteration 
        ? `${result.translatedText} (${result.transliteration})`
        : result.translatedText;
      navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleSpeak = () => {
    if (result && isOnline) {
      speakText(result.translatedText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTranslate();
    }
  };

  const vibeOptions: { id: VibeMode; label: string; desc: string }[] = [
    { id: 'formal', label: 'Proper', desc: 'Textbook / Formal' },
    { id: 'casual', label: 'Real Talk', desc: 'Fast & Natural' },
    { id: 'taglish', label: 'Urban Mix', desc: 'Manila / Taglish' },
  ];

  const currentAlternatives = useMemo(() => {
    const currentInput = inputText.trim();
    if (!currentInput) return [];
    return history.filter(item => 
      item.inputText.toLowerCase() === currentInput.toLowerCase() && 
      item.sourceLang === sourceLang && 
      item.targetLang === targetLang &&
      item.vibeMode === vibeMode &&
      item.result.translatedText !== result?.translatedText
    );
  }, [inputText, history, sourceLang, targetLang, vibeMode, result]);

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-200 selection:bg-${theme.id}-500/30 transition-colors duration-700 ${lowPerf ? 'low-perf-mode' : ''}`}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className={`absolute -top-24 -left-24 w-[40rem] h-[40rem] ${theme.glow} ${lowPerf ? 'blur-[40px] opacity-20' : 'blur-[140px] opacity-60 animate-pulse'} rounded-full transition-all duration-1000`} />
        <div className={`absolute bottom-[-10rem] right-[-10rem] w-[35rem] h-[35rem] ${theme.glow} ${lowPerf ? 'hidden' : 'blur-[120px] opacity-30'} rounded-full transition-all duration-1000`} />
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 lg:py-16">
        <div className="flex justify-between items-center mb-12 flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-${theme.id}-500/10 border border-${theme.id}-500/20 glass`} aria-label="App version and status">
              {!lowPerf && <span className={`w-2 h-2 rounded-full bg-${theme.accent} animate-pulse`} aria-hidden="true" />}
              <span className={`text-[10px] font-black text-${theme.accent} uppercase tracking-[0.2em]`}>v3.3 / Prefs Active</span>
            </div>
            
            {!isOnline && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-white/5 glass animate-in fade-in zoom-in duration-300">
                <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.828-2.828m-4.243 4.243a9 9 0 01-12.728 0m.707-12.021a9 9 0 0112.728 0M5.636 18.364a9 9 0 010-12.728m12.728 0L5.636 18.364" />
                </svg>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Offline Mode</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setLowPerf(!lowPerf)}
              aria-label="Toggle Low Performance Mode"
              className={`p-2 rounded-xl transition-all border ${
                lowPerf 
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' 
                  : 'bg-slate-800/40 border-white/5 text-slate-400 hover:text-slate-200'
              } glass`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>

            <nav className="flex items-center gap-2 glass p-1.5 rounded-2xl">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveThemeId(t.id)}
                  className={`w-8 h-8 rounded-xl transition-all duration-300 flex items-center justify-center ${
                    activeThemeId === t.id 
                      ? `bg-${t.primary} shadow-lg shadow-${t.id}-500/40 scale-110` 
                      : `bg-slate-800 hover:bg-slate-700`
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full bg-white ${activeThemeId === t.id ? 'opacity-100' : 'opacity-20'}`} />
                </button>
              ))}
            </nav>
          </div>
        </div>

        <header className="text-center mb-12">
          <h1 className={`text-6xl lg:text-8xl font-jakarta font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 tracking-tighter mb-4 ${!lowPerf ? 'animate-float' : ''}`}>
            Kanto
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            The world's first <span className={`text-${theme.accent} font-semibold transition-colors duration-500`}>Real-Time</span> vibe translator. Zero reasoning lag.
          </p>
        </header>

        <div className="grid gap-8">
          <div className={`bg-slate-900/40 ${!lowPerf ? 'backdrop-blur-3xl' : ''} border border-white/5 rounded-[2.5rem] p-6 lg:p-10 shadow-2xl relative overflow-hidden group`}>
            {!lowPerf && (
              <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent skew-x-[-25deg] transition-all duration-1000 group-hover:left-[100%]" aria-hidden="true" />
            )}
            
            <div className="flex flex-col md:flex-row items-center gap-4 mb-10">
              <LanguageSelector label="Translate from" value={sourceLang} onChange={(v) => { setSourceLang(v as LanguageCode); setErrorKey(null); }} />
              <button 
                onClick={swapLanguages}
                disabled={sourceLang === 'auto'}
                aria-label="Swap languages"
                className={`mt-6 md:mt-4 p-4 rounded-2xl bg-slate-800/40 border border-white/5 transition-all group/swap hover:scale-110 active:scale-90 focus:outline-none focus:ring-2 focus:ring-${theme.primary} focus:ring-offset-2 focus:ring-offset-slate-950 ${sourceLang === 'auto' ? 'opacity-20 cursor-not-allowed' : 'hover:bg-slate-700/60'}`}
              >
                <svg className={`w-6 h-6 text-slate-400 group-hover/swap:text-${theme.accent} group-hover/swap:rotate-180 transition-all duration-700`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </button>
              <LanguageSelector label="Translate to" value={targetLang} onChange={(v) => { setTargetLang(v as LanguageCode); setErrorKey(null); }} />
            </div>

            <div className="mb-10">
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Select Vibe</span>
                  <div className={`w-1.5 h-1.5 rounded-full bg-${theme.accent}`} />
                </div>
                
                {isTargetSymbolBased && (
                  <button 
                    onClick={() => setShowPhonetic(!showPhonetic)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all ${showPhonetic ? `bg-${theme.id}-500/10 border-${theme.id}-500/30 text-${theme.accent}` : 'bg-slate-800/40 border-white/5 text-slate-500'}`}
                  >
                    <span className="text-[9px] font-black uppercase tracking-widest">{showPhonetic ? 'Symbols + Phonetic' : 'Symbols Only'}</span>
                    <div className={`w-2 h-2 rounded-full ${showPhonetic ? `bg-${theme.accent}` : 'bg-slate-600'}`} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {vibeOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setVibeMode(opt.id); setErrorKey(null); }}
                    className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all relative overflow-hidden ${
                      vibeMode === opt.id
                        ? `bg-${theme.id}-500/20 border-${theme.id}-500/50 text-white shadow-lg shadow-${theme.id}-500/10`
                        : 'bg-slate-800/40 border-white/5 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <span className="text-xs font-black uppercase tracking-widest mb-1">{opt.label}</span>
                    <span className="text-[9px] font-medium opacity-60 text-center leading-none">{opt.desc}</span>
                    {vibeMode === opt.id && (
                      <div className={`absolute bottom-0 left-0 right-0 h-1 bg-${theme.accent} animate-in slide-in-from-bottom-1 duration-300`} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <textarea
                id={inputAreaId}
                value={inputText}
                onChange={(e) => { setInputText(e.target.value); setErrorKey(null); }}
                onKeyDown={handleKeyDown}
                placeholder="What's on your mind?..."
                className={`w-full bg-slate-950/40 border border-slate-800/50 text-slate-100 rounded-[2rem] p-8 h-48 focus:outline-none focus:ring-2 focus:ring-${theme.id}-500/20 transition-all resize-none text-xl leading-relaxed placeholder:text-slate-700 placeholder:italic`}
              />
              <div className="absolute bottom-6 left-8">
                 <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] opacity-40">Enter to Vibe / Shift+Enter for New Line</p>
              </div>
              <button
                onClick={handleTranslate}
                disabled={isLoading || isStreaming || !inputText.trim() || (!isOnline && vibeMode !== 'formal')}
                className={`absolute bottom-6 right-6 px-10 py-4 rounded-2xl font-black transition-all shadow-2xl flex items-center gap-3 overflow-hidden group/btn ${
                  isLoading || isStreaming || !inputText.trim() 
                    ? 'bg-slate-800 text-slate-600 cursor-not-allowed border-transparent' 
                    : `bg-${theme.primary} hover:bg-${theme.secondary} text-white hover:scale-105 active:scale-95 border-b-4 border-${theme.id}-700`
                }`}
              >
                {isLoading || isStreaming ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="uppercase tracking-widest text-xs">{isStreaming ? "Vibing..." : "Checking..."}</span>
                  </>
                ) : (
                  <>
                    <span className="uppercase tracking-[0.2em] text-xs">Vibe Check</span>
                    <svg className="w-5 h-5 transition-transform group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </>
                )}
              </button>
            </div>
          </div>

          {errorKey && <ErrorState errorKey={errorKey} onRetry={handleTranslate} theme={theme} />}

          {(result || streamingText) && !errorKey && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-700" aria-live="polite">
              <div className={`glass border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl relative`}>
                <div className="absolute top-4 right-8">
                  <span className={`text-[8px] font-black uppercase tracking-[0.3em] ${isStreaming && !lowPerf ? `text-${theme.accent} animate-pulse` : 'text-slate-600'} bg-slate-800/40 px-3 py-1 rounded-full border border-white/5`}>
                    {isStreaming ? "Streaming Live" : "Smart Output Ready"}
                  </span>
                </div>

                <div className="p-8 lg:p-12">
                  <div className="flex justify-between items-start mb-10">
                    <div className="flex flex-col gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-[0.3em] text-${theme.accent} opacity-80`}>Translated Output</span>
                      <div className="flex gap-2 items-center">
                        <div className={`inline-flex items-center gap-2 px-4 py-1.5 bg-${theme.id}-500/10 text-${theme.accent} rounded-full border border-${theme.id}-500/20 text-xs font-bold`}>
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                          Vibe: {result?.vibe || vibeMode}
                        </div>
                        {result?.detectedLanguage && sourceLang === 'auto' && (
                          <div className={`inline-flex items-center gap-2 px-4 py-1.5 bg-slate-800/60 text-slate-400 rounded-full border border-white/5 text-[10px] font-black uppercase tracking-widest`}>
                            Detected: {result.detectedLanguage}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={handleSpeak}
                        disabled={!isOnline || isStreaming}
                        className={`p-4 rounded-2xl transition-all border border-white/5 ${!isOnline || isStreaming ? 'bg-slate-800/20 text-slate-600' : `bg-slate-800/50 hover:bg-slate-700 text-slate-300 hover:scale-110 active:scale-90`}`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                      </button>
                      <button 
                        onClick={copyToClipboard}
                        disabled={isStreaming}
                        className={`p-4 rounded-2xl transition-all border border-white/5 ${isCopied ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : `bg-slate-800/50 hover:bg-slate-700 text-slate-300 hover:scale-110 active:scale-90`}`}
                      >
                        {isCopied ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>}
                      </button>
                    </div>
                  </div>

                  <div className="mb-12">
                    <p className={`text-3xl lg:text-5xl font-jakarta font-bold text-white leading-[1.2] tracking-tight transition-opacity duration-300 ${isStreaming ? 'opacity-90' : 'opacity-100'}`}>
                      {isStreaming ? streamingText : result?.translatedText}
                      {isStreaming && <span className={`inline-block w-1.5 h-8 ml-1 bg-${theme.accent} ${!lowPerf ? 'animate-pulse' : ''} rounded-full`} />}
                    </p>
                    {!isStreaming && showPhonetic && result?.transliteration && (
                      <p className={`mt-4 text-xl lg:text-2xl font-mono font-medium text-slate-500 italic selection:bg-${theme.id}-500/20`}>
                        {result.transliteration}
                      </p>
                    )}
                  </div>

                  {result && (
                    <div className={`${!lowPerf ? 'animate-in fade-in slide-in-from-top-4 duration-700' : ''}`}>
                      <div className="grid md:grid-cols-2 gap-10 pt-10 border-t border-white/5">
                        <section>
                          <h4 className={`text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4 flex items-center gap-2`}>
                            <svg className={`w-4 h-4 text-${theme.accent}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Context Prediction
                          </h4>
                          <div className="glass rounded-2xl p-6 border border-white/5">
                            <p className="text-sm text-slate-300 leading-relaxed font-medium">{result.explanation}</p>
                          </div>
                        </section>
                        <section>
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4 flex items-center gap-2">
                            <svg className={`w-4 h-4 text-${theme.accent}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                            Native Shortcuts
                          </h4>
                          <div className="flex flex-wrap gap-3">
                            {result.slangUsed.map((detail, idx) => (
                              <SlangChip key={idx} detail={detail} theme={theme} lowPerf={lowPerf} />
                            ))}
                          </div>
                        </section>
                      </div>

                      {currentAlternatives.length > 0 && (
                        <div className="mt-10 pt-8 border-t border-white/5">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-4 flex items-center gap-2">Alternative Vibing</h4>
                          <div className="flex flex-col gap-2">
                            {currentAlternatives.slice(0, 3).map((alt) => (
                              <button key={alt.id} onClick={() => restoreFromHistory(alt)} className="text-left p-4 rounded-2xl bg-slate-800/30 border border-white/5 hover:bg-slate-800/60 transition-all flex items-center justify-between group/alt">
                                <span className="text-sm text-slate-400 font-medium italic">"{alt.result.translatedText}"</span>
                                <span className={`text-[9px] font-black uppercase tracking-widest text-${theme.accent} opacity-40 group-hover/alt:opacity-100`}>Switch View</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div className={`mt-12 ${!lowPerf ? 'animate-in fade-in slide-in-from-bottom-8 duration-700' : ''}`}>
              <div className="flex justify-between items-center mb-6 px-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Recently Translated</h3>
                <div className="flex items-center gap-4">
                  {isConfirmingClear ? (
                    <div className={`flex items-center gap-2 ${!lowPerf ? 'animate-in slide-in-from-right-2 duration-300' : ''}`}>
                      <span className="text-[9px] font-bold uppercase text-red-400 tracking-tighter">Are you sure?</span>
                      <button 
                        onClick={handleClearHistory}
                        className="text-[10px] font-black uppercase text-red-500 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-colors border border-red-500/20"
                      >
                        Yes, Delete
                      </button>
                      <button 
                        onClick={() => setIsConfirmingClear(false)}
                        className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setIsConfirmingClear(true)} 
                      className="text-[10px] font-bold uppercase text-slate-600 hover:text-red-400 transition-colors tracking-widest"
                    >
                      Clear history
                    </button>
                  )}
                </div>
              </div>
              <div className="grid gap-3">
                {history.map((item) => {
                  const isMatch = lastTranslatedState.current && lastTranslatedState.current.text === item.inputText && lastTranslatedState.current.vibe === item.vibeMode;
                  return (
                    <button key={item.id} onClick={() => restoreFromHistory(item)} className={`group w-full text-left glass border rounded-2xl p-4 flex items-center justify-between hover:bg-white/5 transition-all focus:outline-none focus:ring-2 focus:ring-slate-800 ${isMatch && item.result.translatedText === result?.translatedText ? `border-${theme.accent}/40 bg-${theme.id}-500/5` : 'border-white/5'}`}>
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            {LANGUAGES.find(l => l.code === item.sourceLang)?.flag} → {LANGUAGES.find(l => l.code === item.targetLang)?.flag}
                          </span>
                          <span className={`text-[10px] font-black uppercase tracking-tighter text-${theme.accent} opacity-60`}>{item.vibeMode}</span>
                          {item.result.detectedLanguage && item.sourceLang === 'auto' && (
                            <span className="text-[9px] font-black uppercase text-slate-600 tracking-tighter">({item.result.detectedLanguage})</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-100 font-bold truncate mb-0.5">{item.result.translatedText} {showPhonetic && item.result.transliteration ? `(${item.result.transliteration})` : ''}</p>
                        <p className="text-[10px] text-slate-500 truncate italic">"{item.inputText}"</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-3">
                        <span className="text-[9px] font-bold text-slate-700">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <svg className="w-4 h-4 text-slate-700 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-20 py-16 border-t border-white/5 text-center relative z-10">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all cursor-default" aria-hidden="true">
             <span className="text-xs font-black uppercase tracking-[0.5em] text-slate-400">Gemini Flash AI</span>
          </div>
          <p className="text-slate-600 text-xs font-medium max-w-xs mx-auto">Dynamic vibe engine for Proper, Real Talk, and Urban Mix. Turbo-charged streaming active.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
