'use client';
import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function TextSplit({ text, className = '', tag: Tag = 'h2', stagger = 0.05 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const words = el.querySelectorAll('.word');
    const ctx = gsap.context(() => {
      gsap.fromTo(words,
        { opacity: 0, y: 40, rotateX: -40 },
        { opacity: 1, y: 0, rotateX: 0, stagger, duration: 0.6, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%' } }
      );
    });
    return () => ctx.revert();
  }, [stagger]);
  const words = text.split(' ').map((word, i) => (
    <span key={i} className="word inline-block" style={{ perspectiveOrigin: 'center', perspective: '500px' }}>{word}&nbsp;</span>
  ));
  return <Tag ref={ref} className={`overflow-hidden ${className}`}>{words}</Tag>;
}
