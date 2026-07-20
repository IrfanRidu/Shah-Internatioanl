'use client';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { BuyerTypeProvider } from '@/contexts/BuyerTypeContext';
import { CartProvider } from '@/contexts/CartContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { Toaster } from 'react-hot-toast';

export default function Providers({ children, session }) {
  return (
    <SessionProvider session={session}>
      <SettingsProvider>
        <ThemeProvider>
          <LanguageProvider>
            <CurrencyProvider>
              <BuyerTypeProvider>
                <CartProvider>
                  {children}
                  <Toaster
                    position="top-right"
                    toastOptions={{
                      duration: 3000,
                      style: { borderRadius: '10px', fontFamily: 'Inter, sans-serif', fontSize: '14px' },
                      success: { iconTheme: { primary: '#2d6a4f', secondary: '#fff' } },
                    }}
                  />
                </CartProvider>
              </BuyerTypeProvider>
            </CurrencyProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SettingsProvider>
    </SessionProvider>
  );
}
