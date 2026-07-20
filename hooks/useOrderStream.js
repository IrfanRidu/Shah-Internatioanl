'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Subscribes to /api/admin/orders/stream (Server-Sent Events backed by a
 * MongoDB change stream) for instant "new order" notifications.
 *
 * If the SSE connection fails or the database doesn't support change
 * streams (standalone MongoDB instead of a replica set / Atlas), this
 * automatically falls back to calling `onPoll` every `pollInterval` ms,
 * so the feature degrades gracefully instead of breaking.
 *
 * @param {Object} options
 * @param {(order: object) => void} options.onNewOrder - called for each new order event
 * @param {() => void} [options.onPoll] - fallback callback, called on an interval if SSE is unavailable
 * @param {number} [options.pollInterval] - fallback poll interval in ms (default 30000)
 * @param {boolean} [options.enabled] - set false to disable the subscription entirely
 */
export function useOrderStream({ onNewOrder, onPoll, pollInterval = 30000, enabled = true }) {
  const [live, setLive] = useState(false); // true once SSE is confirmed connected
  const sourceRef = useRef(null);
  const pollRef = useRef(null);
  const callbacksRef = useRef({ onNewOrder, onPoll });
  callbacksRef.current = { onNewOrder, onPoll };

  useEffect(() => {
    if (!enabled) return;

    const startPolling = () => {
      if (pollRef.current) return;
      callbacksRef.current.onPoll?.();
      pollRef.current = setInterval(() => callbacksRef.current.onPoll?.(), pollInterval);
    };
    const stopPolling = () => { clearInterval(pollRef.current); pollRef.current = null; };

    let es;
    try {
      es = new EventSource('/api/admin/orders/stream');
      sourceRef.current = es;

      es.addEventListener('connected', () => { setLive(true); stopPolling(); });

      es.addEventListener('order:new', (e) => {
        try { callbacksRef.current.onNewOrder?.(JSON.parse(e.data)); } catch {}
      });
      es.addEventListener('order:updated', (e) => {
        try { callbacksRef.current.onNewOrder?.(JSON.parse(e.data)); } catch {}
      });

      es.addEventListener('stream:unsupported', () => { setLive(false); startPolling(); });

      es.onerror = () => { setLive(false); es.close(); startPolling(); };
    } catch {
      setLive(false);
      startPolling();
    }

    return () => {
      sourceRef.current?.close();
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pollInterval]);

  return { live };
}
