import { Package } from 'lucide-react';
import Button from './Button';
import Link from 'next/link';

export default function EmptyState({ icon: Icon = Package, title = 'Nothing here yet', description = '', actionLabel, actionHref, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-5">
        <Icon className="w-10 h-10 text-gray-300 dark:text-gray-600" />
      </div>
      <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">{title}</h3>
      {description && <p className="text-gray-400 text-sm max-w-sm mb-6">{description}</p>}
      {actionLabel && (actionHref ? (
        <Link href={actionHref}><Button variant="primary" size="sm">{actionLabel}</Button></Link>
      ) : (
        <Button variant="primary" size="sm" onClick={onAction}>{actionLabel}</Button>
      ))}
    </div>
  );
}
