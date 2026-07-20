'use client';
import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, size = 'md', footer, hideClose = false }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={`relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] flex flex-col animate-slide-up`}
        onClick={e => e.stopPropagation()}
      >
        {(title || !hideClose) && (
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
            {title && <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>}
            {!hideClose && (
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-auto">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <div className="p-6 border-t border-gray-100 dark:border-gray-800">{footer}</div>}
      </div>
    </div>
  );
}
