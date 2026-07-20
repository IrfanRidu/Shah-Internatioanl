import { useState, useEffect } from 'react';

export function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch { return initialValue; }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(stored) : value;
      setStored(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (e) { console.error(e); }
  };

  return [stored, setValue];
}
