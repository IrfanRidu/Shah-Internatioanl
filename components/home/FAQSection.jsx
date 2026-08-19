'use client';
import { useState, useEffect } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

export default function FAQSection() {
  const [faqs, setFaqs] = useState([]);
  // `open` holds the index of the currently open FAQ, or null if all closed.
  // Clicking an open FAQ closes it; clicking a different one opens it.
  const [open, setOpen] = useState(null);
  // Batch 19 (R33-13): mobile-only — shows just the first 2 FAQs until expanded. Desktop's
  // 3-column layout below is untouched and unaffected by this.
  const [showAllMobile, setShowAllMobile] = useState(false);

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        const active = (d.settings?.faqs || []).filter(f => f.isActive);
        setFaqs(active.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      })
      .catch(() => {});
  }, []);

  if (faqs.length === 0) return null;

  const toggle = (i) => setOpen(prev => (prev === i ? null : i));

  // Split into three columns for a more compact display (was 2)
  const perCol = Math.ceil(faqs.length / 3);
  const col1 = faqs.slice(0, perCol);
  const col2 = faqs.slice(perCol, perCol * 2);
  const col3 = faqs.slice(perCol * 2);

  const FaqItem = ({ faq, globalIndex }) => (
    <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => toggle(globalIndex)}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors gap-3"
      >
        <span className="text-sm font-medium text-gray-800 dark:text-white leading-snug">{faq.question}</span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${open === globalIndex ? 'rotate-180' : ''}`}
        />
      </button>
      {/* Answer — only rendered when open; animate height with max-height trick */}
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: open === globalIndex ? '400px' : '0px' }}
      >
        <div className="px-4 pb-3 pt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed border-t border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          {faq.answer}
        </div>
      </div>
    </div>
  );

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Section header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-2" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
          <HelpCircle className="w-4 h-4" /> FAQs
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
          Frequently Asked Questions
        </h2>
        <p className="text-gray-400 text-sm mt-1">Click a question to read the answer. Click again to close.</p>
      </div>

      {/* Batch 19 (R33-13): mobile-only flat list — shows the first 2 FAQs (in original order, not
          split into thirds the way the desktop columns below are), with an expand/collapse toggle
          for the rest. Hidden from md up, where the existing 3-column grid takes over instead. */}
      <div className="md:hidden space-y-2">
        {(showAllMobile ? faqs : faqs.slice(0, 2)).map((faq, i) => (
          <FaqItem key={i} faq={faq} globalIndex={i} />
        ))}
        {faqs.length > 2 && (
          <button
            type="button"
            onClick={() => setShowAllMobile(v => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-brand hover:text-green-700 transition-colors"
          >
            {showAllMobile ? 'Show Less' : `Show All ${faqs.length} FAQs`}
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showAllMobile ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Three-column compact grid — desktop only now (was shown on mobile as 3 stacked full-length
          groups before batch 19, which is what made the mobile FAQ section so long). */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="space-y-2">
          {col1.map((faq, i) => (
            <FaqItem key={i} faq={faq} globalIndex={i} />
          ))}
        </div>
        <div className="space-y-2">
          {col2.map((faq, i) => (
            <FaqItem key={i + perCol} faq={faq} globalIndex={i + perCol} />
          ))}
        </div>
        <div className="space-y-2">
          {col3.map((faq, i) => (
            <FaqItem key={i + perCol * 2} faq={faq} globalIndex={i + perCol * 2} />
          ))}
        </div>
      </div>
    </section>
  );
}
