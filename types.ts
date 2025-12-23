
export interface SlangDetail {
  term: string;
  meaning: string;
  context: string;
}

export interface TranslationResult {
  translatedText: string;
  explanation: string;
  slangUsed: SlangDetail[];
  vibe: string;
}

export type VibeMode = 'formal' | 'casual' | 'taglish';

export interface HistoryItem {
  id: string;
  timestamp: number;
  inputText: string;
  sourceLang: string;
  targetLang: string;
  vibeMode: VibeMode;
  result: TranslationResult;
}

export type LanguageCode = 'en' | 'tl' | 'es' | 'ja' | 'ko' | 'fr' | 'zh';

export type ThemeType = 'indigo' | 'rose' | 'emerald' | 'amber';

export interface ThemeConfig {
  id: ThemeType;
  primary: string;
  secondary: string;
  accent: string;
  glow: string;
}

export const THEMES: ThemeConfig[] = [
  { id: 'indigo', primary: 'indigo-500', secondary: 'indigo-600', accent: 'indigo-400', glow: 'bg-indigo-600/20' },
  { id: 'rose', primary: 'rose-500', secondary: 'rose-600', accent: 'rose-400', glow: 'bg-rose-600/20' },
  { id: 'emerald', primary: 'emerald-500', secondary: 'emerald-600', accent: 'emerald-400', glow: 'bg-emerald-600/20' },
  { id: 'amber', primary: 'amber-500', secondary: 'amber-600', accent: 'amber-400', glow: 'bg-amber-600/20' },
];

export interface Language {
  code: string;
  name: string;
  flag: string;
}

export const LANGUAGES: Language[] = [
  { code: 'tl', name: 'Tagalog/Filipino', flag: '🇵🇭' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
];
