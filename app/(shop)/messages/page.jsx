'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Loader from '@/components/ui/Loader';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { MessageSquare, Plus, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function MessagesPage() {
  const { data: session } = useSession();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newModal, setNewModal] = useState(false);
  const [form, setForm] = useState({ subject: '', body: '' });
  const [sending, setSending] = useState(false);

  const fetchConvos = async () => {
    setLoading(true);
    const res = await fetch('/api/messages');
    const data = await res.json();
    setConversations(data.conversations || []);
    setLoading(false);
  };

  useEffect(() => { if (session) fetchConvos(); }, [session]);

  const handleSend = async () => {
    if (!form.subject || !form.body) { toast.error('Fill all fields'); return; }
    setSending(true);
    const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    setSending(false);
    if (data.success) { toast.success('Message sent!'); setNewModal(false); setForm({ subject: '', body: '' }); fetchConvos(); }
    else toast.error(data.message);
  };

  if (loading) return <div className="py-20"><Loader /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>Messages</h1>
          <p className="text-gray-500 text-sm mt-1">Direct conversations with our team</p>
        </div>
        <Button variant="primary" size="sm" icon={Plus} onClick={() => setNewModal(true)}>New Message</Button>
      </div>

      {conversations.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No conversations yet" description="Start a conversation with our team for quotations, support, or general inquiries." actionLabel="Send a Message" onAction={() => setNewModal(true)} />
      ) : (
        <div className="space-y-3">
          {conversations.map(c => (
            <Link key={c._id} href={`/messages/${c._id}`} className="block bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.unreadByUser ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-semibold text-sm ${c.unreadByUser ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>{c.subject}</p>
                      {c.unreadByUser && <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />}
                      <Badge variant={c.status === 'open' ? 'success' : 'default'} className="text-xs">{c.status}</Badge>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-0.5">{c.lastSenderRole === 'admin' ? '🌿 Shah International: ' : 'You: '}{c.lastMessage}</p>
                    {c.product && <p className="text-xs text-gray-400 mt-1">Re: {c.product.name}</p>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400">{format(new Date(c.lastMessageAt), 'dd MMM, hh:mm a')}</p>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-auto mt-2" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal isOpen={newModal} onClose={() => setNewModal(false)} title="New Message to Shah International" size="md"
        footer={<div className="flex gap-3"><Button onClick={handleSend} loading={sending} variant="primary">Send Message</Button><Button onClick={() => setNewModal(false)} variant="ghost">Cancel</Button></div>}>
        <div className="space-y-4">
          <Input label="Subject" required value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Bulk order inquiry" />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Message</label>
            <textarea rows={5} value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} className="input-field resize-none" placeholder="Type your message..." />
          </div>
        </div>
      </Modal>
    </div>
  );
}
