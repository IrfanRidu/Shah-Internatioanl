'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Loader from '@/components/ui/Loader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { ArrowLeft, Send, Phone, Mail, Globe, Building2, CheckCircle, XCircle, Paperclip, X, FileText, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { uploadAttachmentDirect, validateAttachment } from '@/lib/clientDirectUpload';

// Batch 19 (R33-7): same component as app/(shop)/messages/[id]/page.jsx's — kept as a small
// duplicate rather than a shared import, matching how this codebase already keeps the customer
// and admin chat pages as independent (if parallel) implementations rather than sharing components
// across the /admin and /(shop) route groups.
function AttachmentView({ a }) {
  const isImage = a.type?.startsWith('image/');
  const sizeLabel = a.size ? `${(a.size / (1024 * 1024)).toFixed(a.size > 1024 * 1024 ? 1 : 2)} MB` : '';
  if (isImage) {
    return (
      <a href={a.url} target="_blank" rel="noreferrer" className="block mt-1.5 max-w-[220px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.url} alt={a.name || 'Attachment'} className="rounded-xl max-h-48 w-auto object-cover border border-black/5" />
      </a>
    );
  }
  return (
    <a href={a.url} target="_blank" rel="noreferrer" className="mt-1.5 flex items-center gap-2 bg-black/5 dark:bg-white/5 rounded-xl px-3 py-2 hover:bg-black/10 dark:hover:bg-white/10 transition-colors max-w-[220px]">
      <FileText className="w-4 h-4 flex-shrink-0 opacity-70" />
      <span className="text-xs truncate flex-1">{a.name || 'File'}</span>
      {sizeLabel && <span className="text-xs opacity-60 flex-shrink-0">{sizeLabel}</span>}
      <Download className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
    </a>
  );
}

export default function AdminConversationPage() {
  const { id } = useParams();
  const router = useRouter();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchThread = async () => {
    const res = await fetch(`/api/messages/${id}`);
    const data = await res.json();
    if (data.success) { setConversation(data.conversation); setMessages(data.messages); }
    setLoading(false);
  };

  useEffect(() => { fetchThread(); }, [id]);

  // Poll every 4 seconds so customer replies appear instantly without refresh
  useEffect(() => {
    const pollId = setInterval(async () => {
      const res = await fetch(`/api/messages/${id}`);
      const data = await res.json();
      if (data.success) setMessages(data.messages);
    }, 4000);
    return () => clearInterval(pollId);
  }, [id]);
  // Batch 19 (R33-7): see the customer-facing page's identical comment (app/(shop)/messages/
  // [id]/page.jsx) for the full root-cause explanation — same bug, same fix, on the admin side.
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const error = validateAttachment(file);
    if (error) { toast.error(error); return; }
    setUploading(true);
    setUploadProgress(0);
    try {
      const attachment = await uploadAttachmentDirect(file, { onProgress: setUploadProgress });
      setPendingAttachment(attachment);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!reply.trim() && !pendingAttachment) return;
    const attachmentsToSend = pendingAttachment ? [pendingAttachment] : [];
    const tempMsg = { _id: `temp-${Date.now()}`, senderRole: 'admin', body: reply, attachments: attachmentsToSend, createdAt: new Date().toISOString() };
    setMessages(p => [...p, tempMsg]);
    const prev = reply;
    setReply('');
    setPendingAttachment(null);
    setSending(true);
    const res = await fetch(`/api/messages/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: prev, attachments: attachmentsToSend }) });
    const data = await res.json();
    setSending(false);
    if (data.success) {
      setMessages(p => p.map(m => m._id === tempMsg._id ? data.message : m));
    } else {
      setMessages(p => p.filter(m => m._id !== tempMsg._id));
      setReply(prev);
      setPendingAttachment(attachmentsToSend[0] || null);
      toast.error(data.message);
    }
  };

  const toggleStatus = async () => {
    const newStatus = conversation.status === 'open' ? 'closed' : 'open';
    const res = await fetch(`/api/messages/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    const data = await res.json();
    if (data.success) { setConversation(data.conversation); toast.success(`Conversation ${newStatus}`); }
  };

  if (loading) return <div className="py-20"><Loader /></div>;
  if (!conversation) return <div className="py-20 text-center text-gray-400">Conversation not found</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={() => router.push('/admin/messages')} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Messages
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Thread */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col h-[620px]">
          <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white">{conversation.subject}</h1>
              {conversation.product && <p className="text-xs text-gray-400 mt-0.5">Re: {conversation.product.name}</p>}
            </div>
            <Button variant={conversation.status === 'open' ? 'outline' : 'primary'} size="sm" onClick={toggleStatus} icon={conversation.status === 'open' ? XCircle : CheckCircle}>
              {conversation.status === 'open' ? 'Close' : 'Reopen'}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/50 dark:bg-gray-950/30">
            {messages.map(m => {
              const isAdmin = m.senderRole === 'admin';
              return (
                <div key={m._id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[75%]">
                    {!isAdmin && <p className="text-xs text-gray-400 mb-1 ml-1">{conversation.user?.name}</p>}
                    {m.body && (
                      <div className={`rounded-2xl px-4 py-2.5 text-sm ${isAdmin ? 'text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-bl-sm border border-gray-100 dark:border-gray-700'}`} style={isAdmin ? { backgroundColor: 'var(--color-primary)' } : {}}>
                        {m.body}
                      </div>
                    )}
                    {m.attachments?.map((a, i) => <AttachmentView key={i} a={a} />)}
                    <p className={`text-xs text-gray-400 mt-1 ${isAdmin ? 'text-right mr-1' : 'ml-1'}`}>{format(new Date(m.createdAt), 'dd MMM, hh:mm a')}</p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="p-4 border-t border-gray-100 dark:border-gray-800">
            {(uploading || pendingAttachment) && (
              <div className="mb-2 flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2 max-w-xs">
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin text-gray-400" />
                    <span className="text-xs text-gray-500 flex-1">Uploading… {Math.round(uploadProgress * 100)}%</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 flex-shrink-0 text-gray-400" />
                    <span className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1">{pendingAttachment.name}</span>
                    <button onClick={() => setPendingAttachment(null)} className="text-gray-400 hover:text-red-500 flex-shrink-0" aria-label="Remove attachment">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all disabled:opacity-50 flex-shrink-0"
                aria-label="Attach a file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                rows={1}
                placeholder="Type your reply..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300"
              />
              <button onClick={handleSend} disabled={sending || uploading || (!reply.trim() && !pendingAttachment)} className="p-2.5 rounded-xl text-white transition-all disabled:opacity-50 flex-shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Customer info sidebar */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 h-fit">
          <h2 className="font-bold text-gray-900 dark:text-white mb-4">Customer Info</h2>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: 'var(--color-primary)' }}>
              {conversation.user?.name?.[0]}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{conversation.user?.name}</p>
              <Badge variant={conversation.user?.buyerType === 'international' ? 'info' : 'success'} className="text-xs mt-1">
                {conversation.user?.buyerType === 'international' ? '🌍 International' : '🇧🇩 Local'}
              </Badge>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
              <Mail className="w-4 h-4 text-gray-400" /> <a href={`mailto:${conversation.user?.email}`} className="hover:text-brand">{conversation.user?.email}</a>
            </div>
            {conversation.user?.phone && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <Phone className="w-4 h-4 text-gray-400" /> <a href={`tel:${conversation.user.phone}`} className="hover:text-brand">{conversation.user.phone}</a>
              </div>
            )}
            {conversation.user?.company && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <Building2 className="w-4 h-4 text-gray-400" /> {conversation.user.company}
              </div>
            )}
            {conversation.user?.country && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <Globe className="w-4 h-4 text-gray-400" /> {conversation.user.country}
              </div>
            )}
          </div>
          {conversation.user?.phone && (
            <a href={`https://wa.me/${conversation.user.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-all w-full">
              💬 WhatsApp Customer
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
