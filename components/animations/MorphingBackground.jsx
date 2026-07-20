'use client';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export default function MorphingBackground({ className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const shapes = ref.current?.querySelectorAll('.morph-shape');
    if (!shapes?.length) return;
    const ctx = gsap.context(() => {
      shapes.forEach((shape, i) => {
        gsap.to(shape, {
          x: `${(i % 2 === 0 ? 1 : -1) * 30}`,
          y: `${(i < 2 ? 1 : -1) * 20}`,
          scale: 1.1 + i * 0.05,
          repeat: -1,
          yoyo: true,
          duration: 4 + i * 1.2,
          ease: 'sine.inOut',
          delay: i * 0.8,
        });
      });
    });
    return () => ctx.revert();
  }, []);
  return (
    <div ref={ref} className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {[
        { top: '10%', left: '-5%', size: 300, color: 'rgba(74,222,128,0.08)' },
        { top: '60%', right: '-8%', size: 250, color: 'rgba(45,106,79,0.06)' },
        { top: '30%', right: '10%', size: 180, color: 'rgba(134,239,172,0.07)' },
        { top: '75%', left: '5%', size: 200, color: 'rgba(245,158,11,0.05)' },
      ].map((s, i) => (
        <div key={i} className="morph-shape absolute rounded-full blur-3xl" style={{ width: s.size, height: s.size, top: s.top, left: s.left, right: s.right, background: s.color }} />
      ))}
    </div>
  );
}
