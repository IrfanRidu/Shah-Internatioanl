'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CURRENCIES = ['BDT', 'USD', 'EUR', 'INR', 'PKR', 'GBP', 'AED'];
const CURRENCY_SYMBOLS = { BDT: '৳', USD: '$', EUR: '€', GBP: '£', INR: '₹', PKR: '₨', AED: 'د.إ' };

const CurrencyContext = createContext({});

// IMPORTANT — basis of `rates`: this always mirrors exactly what GET /api/currency returns, which is
// "how many units of X equal 1 USD" (e.g. rates.BDT ≈ 110 means 110 BDT = 1 USD, rates.USD is always 1).
// This is the live, real-market-rate basis (see lib/exchangeRates.js) — every conversion below must
// treat `rates[cur]` as "cur per 1 USD", never as "cur per 1 BDT". Getting this basis wrong silently
// makes every non-BDT price on the site wrong, not just stale.
export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState('BDT');
  // Placeholder ONLY, used for the brief moment before the first live fetch resolves. Same per-USD
  // basis as the real API so math is consistent even before real numbers load.
  const [rates, setRates] = useState({ USD: 1, BDT: 110, EUR: 0.92, GBP: 0.79, INR: 83.5, PKR: 278, AED: 3.67 });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchRates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/currency');
      if (res.ok) {
        const data = await res.json();
        if (data.rates) setRates(data.rates);
        if (data.lastUpdated) setLastUpdated(data.lastUpdated);
      }
    } catch (e) {
      console.error('Failed to fetch rates', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('si-currency');
    if (saved && CURRENCIES.includes(saved)) setCurrency(saved);
    fetchRates();
    // Keep refreshing periodically so a long-lived tab picks up newly-updated live rates without
    // needing a full page reload — "keeps updating dynamically" per the real-time-rate requirement.
    const id = setInterval(fetchRates, 30 * 60 * 1000); // 30 min, matches the API's own cache window
    return () => clearInterval(id);
  }, [fetchRates]);

  const changeCurrency = (cur) => {
    if (CURRENCIES.includes(cur)) {
      setCurrency(cur);
      localStorage.setItem('si-currency', cur);
    }
  };

  // amountBDT is a BDT-denominated price (how local-buyer prices are stored) → convert to targetCurrency.
  // Basis: rates[cur] = cur per 1 USD, so we first go BDT -> USD -> targetCurrency.
  const convert = (amountBDT, targetCurrency = currency) => {
    if (!amountBDT) return 0;
    if (targetCurrency === 'BDT') return amountBDT;
    const bdtPerUsd = rates['BDT'] || 110;
    const amountUSD = amountBDT / bdtPerUsd;
    if (targetCurrency === 'USD') return amountUSD;
    const targetPerUsd = rates[targetCurrency];
    return targetPerUsd ? amountUSD * targetPerUsd : amountUSD;
  };

  const format = (amountBDT, targetCurrency = currency) => {
    const converted = convert(amountBDT, targetCurrency);
    const symbol = CURRENCY_SYMBOLS[targetCurrency] || targetCurrency;
    return `${symbol}${Number(converted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // amountUSD is already USD-denominated (how international-buyer prices are stored) → convert to
  // targetCurrency. Basis: rates[cur] = cur per 1 USD, so this is a direct single-step multiply.
  const formatUSD = (amountUSD) => {
    if (currency === 'USD') return `$${Number(amountUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const targetPerUsd = rates[currency] || 1;
    const amountInCurrency = amountUSD * targetPerUsd;
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    return `${symbol}${Number(amountInCurrency).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency: changeCurrency, rates, convert, format, formatUSD, CURRENCIES, CURRENCY_SYMBOLS, loading, lastUpdated, refreshRates: fetchRates }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => useContext(CurrencyContext);
