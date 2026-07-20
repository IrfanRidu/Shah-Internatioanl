'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import en from '@/translations/en';
import bn from '@/translations/bn';
import ar from '@/translations/ar';

const translations = { en, bn, ar };
const RTL_LANGS = ['ar'];

const LanguageContext = createContext({});

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    const saved = localStorage.getItem('si-language');
    if (saved && translations[saved]) setLanguage(saved);
  }, []);

  useEffect(() => {
    const isRTL = RTL_LANGS.includes(language);
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const changeLanguage = (lang) => {
    if (translations[lang]) {
      setLanguage(lang);
      localStorage.setItem('si-language', lang);
    }
  };

  const t = (key) => {
    const keys = key.split('.');
    let value = translations[language];
    for (const k of keys) value = value?.[k];
    if (value) return value;
    let fallback = translations['en'];
    for (const k of keys) fallback = fallback?.[k];
    return fallback || key;
  };

  const isRTL = RTL_LANGS.includes(language);

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t, languages: Object.keys(translations), isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
