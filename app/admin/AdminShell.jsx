'use client';
import { useState } from 'react';
import AdminSidebar from '@/components/layout/AdminSidebar';
import AdminTopBar from './AdminTopBar';

// Batch 17 (R8): AdminSidebar (the mobile drawer) and AdminTopBar (the hamburger button that
// opens it) are siblings — this small client wrapper is the one thing that owns the "is the
// mobile nav open" state and passes it to both, so layout.jsx (a server component; it can't hold
// this kind of interactive state itself) can stay focused purely on the server-side session/
// redirect/badge-count work it already did before this batch.
export default function AdminShell({ session, pendingOrders, unreadMessages, children }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <AdminSidebar
        pendingOrders={pendingOrders}
        unreadMessages={unreadMessages}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminTopBar session={session} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
