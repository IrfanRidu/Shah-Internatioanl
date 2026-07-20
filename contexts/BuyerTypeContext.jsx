'use client';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

const BuyerTypeContext = createContext({});

export function BuyerTypeProvider({ children }) {
  const { data: session, status } = useSession();
  const [buyerType, setBuyerTypeState] = useState('local');
  const [showModal, setShowModal] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const sessionReadRef = useRef(false); // only read session ONCE

  useEffect(() => {
    // Always check localStorage first — this is the source of truth.
    // We only fall back to session.user.buyerType if there is NO saved local value.
    // We NEVER overwrite a saved localStorage value with the session value, because
    // that was the root cause of buyer type resetting (session re-render wiped the choice).
    const saved = typeof window !== 'undefined' ? localStorage.getItem('si-buyerType') : null;

    if (saved) {
      setBuyerTypeState(saved);
      setInitialized(true);
      return; // localStorage wins — don't touch it again
    }

    // No saved preference: read from session (runs only once after session loads)
    if (status === 'loading') return;
    if (sessionReadRef.current) return;
    sessionReadRef.current = true;

    if (session?.user?.buyerType) {
      setBuyerTypeState(session.user.buyerType);
      localStorage.setItem('si-buyerType', session.user.buyerType);
      setInitialized(true);
    } else {
      // Fresh visitor with no preference — show the picker modal
      setShowModal(true);
    }
  }, [status, session]);

  const setBuyerType = async (type) => {
    setBuyerTypeState(type);
    localStorage.setItem('si-buyerType', type);
    setShowModal(false);
    setInitialized(true);
    // Persist to user account in background (best-effort, never blocks UX)
    if (session?.user?.id) {
      fetch('/api/users/buyer-type', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerType: type }),
      }).catch(() => {});
    }
  };

  return (
    <BuyerTypeContext.Provider value={{
      buyerType, setBuyerType,
      showModal, setShowModal,
      initialized,
      isLocal: buyerType === 'local',
      isInternational: buyerType === 'international',
    }}>
      {children}
    </BuyerTypeContext.Provider>
  );
}

export const useBuyerType = () => useContext(BuyerTypeContext);
