
import React from 'react';
import { LANGUAGES } from '../types';

interface LanguageSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({ value, onChange, label }) => {
  const selectId = `lang-select-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label 
        htmlFor={selectId}
        className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Select ${label} language`}
          className="w-full bg-slate-800/50 border border-slate-700/50 text-slate-100 rounded-2xl px-4 py-3 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer hover:bg-slate-800 focus:bg-slate-800"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;
