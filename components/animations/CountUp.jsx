'use client';
import { useRef, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function CountUp({ end, prefix = '', suffix = '', duration = 2, className = '' }) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const obj = { val: 0 };
      ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          gsap.to(obj, {
            val: end,
            duration,
            ease: 'power2.out',
            onUpdate: () => setValue(Math.round(obj.val)),
          });
        },
      });
    });
    return () => ctx.revert();
  }, [end, duration]);
  return (
    <span ref={ref} className={className}>
      {prefix}{value.toLocaleString()}{suffix}
    </span>
  );
}
