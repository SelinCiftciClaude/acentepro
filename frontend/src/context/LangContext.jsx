import { createContext, useContext, useState } from 'react';
import { t as translate } from '../i18n';

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'tr');

  function changeLang(code) {
    localStorage.setItem('lang', code);
    setLang(code);
  }

  function t(key, ...args) {
    return translate(lang, key, ...args);
  }

  return (
    <LangContext.Provider value={{ lang, setLang: changeLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
