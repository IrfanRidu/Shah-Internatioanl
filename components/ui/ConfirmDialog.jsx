'use client';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import Button from './Button';

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', type = 'warning', loading = false }) {
  if (!isOpen) return null;
  const icons = { warning: <AlertTriangle className="w-7 h-7 text-amber-500" />, danger: <AlertTriangle className="w-7 h-7 text-red-500" />, success: <CheckCircle className="w-7 h-7 text-green-500" />, info: <Info className="w-7 h-7 text-blue-500" /> };
  const colors = { warning: 'bg-amber-50 dark:bg-amber-900/20', danger: 'bg-red-50 dark:bg-red-900/20', success: 'bg-green-50 dark:bg-green-900/20', info: 'bg-blue-50 dark:bg-blue-900/20' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full animate-slide-up" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"><X className="w-4 h-4" /></button>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${colors[type]}`}>{icons[type]}</div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">{title}</h2>
        {message && <p className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed mb-6">{message}</p>}
        <div className="flex gap-3">
          <Button onClick={onClose} variant="ghost" className="flex-1">{cancelLabel}</Button>
          <Button onClick={onConfirm} variant={type === 'danger' ? 'danger' : 'primary'} className="flex-1" loading={loading}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
