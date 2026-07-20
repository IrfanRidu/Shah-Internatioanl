// Shared, provider-agnostic LIVE exchange-rate fetcher.
//
// Why this file exists: the site must never show a fixed/hardcoded currency rate (e.g. a permanent
// "110 BDT = 1 USD"). This module tries several independent, real market-rate sources in order and
// always returns the first one that actually answers, so the site keeps updating dynamically even if
// any single provider is down, rate-limited, or not configured with an API key.
//
// Order of providers:
//   1. openexchangerates.org — used only if OPEN_EXCHANGE_RATES_APP_ID is configured (most reliable,
//      paid/free-tier key required).
//   2. open.er-api.com       — free, no API key required, ~160 currencies, refreshed daily upstream.
//   3. api.exchangerate-api.com/v4 — free, no API key required, second independent fallback.
//
// If every live provider fails (e.g. fully offline), the CALLER is expected to fall back to the last
// successfully-cached rate document in the database (which itself came from one of these providers at
// some point) — see app/api/currency/route.js. STATIC_FALLBACK below is only a last-last resort for the
// (very unlikely) case a fresh install has never once successfully reached the internet.

const SYMBOLS = ['BDT', 'EUR', 'INR', 'PKR', 'GBP', 'AED', 'SAR', 'JPY', 'CAD', 'AUD'];

// Emergency-only default, approximate rates as of early 2026. Not meant to be relied on — every code
// path above this tries hard to avoid ever reaching it. Never presented to the user as "live".
export const STATIC_FALLBACK = {
  USD: 1, BDT: 110, EUR: 0.92, GBP: 0.79, INR: 83.5, PKR: 278, AED: 3.67, SAR: 3.75, JPY: 150, CAD: 1.36, AUD: 1.52,
};

async function fetchJson(url, options) {
  const res = await fetch(url, { cache: 'no-store', ...options });
  if (!res.ok) return null;
  try { return await res.json(); } catch { return null; }
}

async function tryOpenExchangeRates() {
  const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID;
  if (!appId) return null;
  try {
    const data = await fetchJson(`https://openexchangerates.org/api/latest.json?app_id=${appId}&base=USD&symbols=${SYMBOLS.join(',')}`);
    if (!data?.rates) return null;
    return { rates: { ...data.rates, USD: 1 }, source: 'openexchangerates.org' };
  } catch {
    return null;
  }
}

async function tryOpenErApi() {
  try {
    const data = await fetchJson('https://open.er-api.com/v6/latest/USD');
    if (data?.result !== 'success' || !data?.rates) return null;
    const rates = { USD: 1 };
    for (const sym of SYMBOLS) if (typeof data.rates[sym] === 'number') rates[sym] = data.rates[sym];
    return { rates, source: 'open.er-api.com' };
  } catch {
    return null;
  }
}

async function tryExchangerateApiV4() {
  try {
    const data = await fetchJson('https://api.exchangerate-api.com/v4/latest/USD');
    if (!data?.rates) return null;
    const rates = { USD: 1 };
    for (const sym of SYMBOLS) if (typeof data.rates[sym] === 'number') rates[sym] = data.rates[sym];
    return { rates, source: 'exchangerate-api.com' };
  } catch {
    return null;
  }
}

/**
 * Attempts each live provider in order and returns the first success as
 * `{ rates: { USD:1, BDT, EUR, ... }, source: string }`.
 * Returns `null` only if every provider fails — callers should fall back to their own cached value.
 * Never throws.
 */
export async function fetchLiveRates() {
  const providers = [tryOpenExchangeRates, tryOpenErApi, tryExchangerateApiV4];
  for (const provider of providers) {
    const result = await provider();
    if (result && result.rates && result.rates.BDT) return result;
  }
  return null;
}
