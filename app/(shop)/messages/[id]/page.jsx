'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Loader from '@/components/ui/Loader';
import Badge from '@/components/ui/Badge';
import { ArrowLeft, Send, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function ConversationThreadPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const fetchThread = async () => {
    const res = await fetch(`/api/messages/${id}`);
    const data = await res.json();
    if (data.success) { setConversation(data.conversation); setMessages(data.messages); }
    setLoading(false);
  };

  useEffect(() => { fetchThread(); }, [id]);

  // Poll every 4 seconds so new messages from admin appear without refreshing
  useEffect(() => {
    const pollId = setInterval(async () => {
      const res = await fetch(`/api/messages/${id}`);
      const data = await res.json();
      if (data.success) setMessages(data.messages);
    }, 4000);
    return () => clearInterval(pollId);
  }, [id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!reply.trim()) return;
    const tempMsg = { _id: `temp-${Date.now()}`, senderRole: 'user', body: reply, createdAt: new Date().toISOString() };
    setMessages(p => [...p, tempMsg]); // optimistic
    const prev = reply;
    setReply('');
    setSending(true);
    const res = await fetch(`/api/messages/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: prev }) });
    const data = await res.json();
    setSending(false);
    if (data.success) {
      setMessages(p => p.map(m => m._id === tempMsg._id ? data.message : m));
    } else {
      setMessages(p => p.filter(m => m._id !== tempMsg._id));
      setReply(prev);
      toast.error(data.message);
    }
  };

  if (loading) return <div className="py-20"><Loader /></div>;
  if (!conversation) return <div className="py-20 text-center text-gray-400">Conversation not found</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => router.push('/messages')} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Messages
      </button>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col h-[600px]">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white">{conversation.subject}</h1>
            {conversation.product && <p className="text-xs text-gray-400 mt-0.5">Re: {conversation.product.name}</p>}
          </div>
          <Badge variant={conversation.status === 'open' ? 'success' : 'default'}>{conversation.status}</Badge>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/50 dark:bg-gray-950/30">
          {messages.map(m => {
            const isMe = m.senderRole === 'user';
            return (
              <div key={m._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] ${isMe ? 'order-2' : ''}`}>
                  {!isMe && <p className="text-xs text-gray-400 mb-1 ml-1">🌿 Shah International</p>}
                  <div className={`rounded-2xl px-4 py-2.5 text-sm ${isMe ? 'text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-bl-sm border border-gray-100 dark:border-gray-700'}`} style={isMe ? { backgroundColor: 'var(--color-primary)' } : {}}>
                    {m.body}
                  </div>
                  <p className={`text-xs text-gray-400 mt-1 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>{format(new Date(m.createdAt), 'hh:mm a')}</p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Reply box */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex items-end gap-2">
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            rows={1}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300"
          />
          <button onClick={handleSend} disabled={sending || !reply.trim()} className="p-2.5 rounded-xl text-white transition-all disabled:opacity-50" style={{ backgroundColor: 'var(--color-primary)' }}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
