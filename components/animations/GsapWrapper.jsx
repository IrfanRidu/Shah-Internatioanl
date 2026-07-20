'use client';
import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function FadeIn({ children, delay = 0, duration = 0.6, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration, delay, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 85%' } });
    });
    return () => ctx.revert();
  }, [delay, duration]);
  return <div ref={ref} className={className}>{children}</div>;
}

export function SlideIn({ children, direction = 'left', delay = 0, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const from = { opacity: 0, x: direction === 'left' ? -40 : direction === 'right' ? 40 : 0, y: direction === 'up' ? 40 : 0 };
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, from, { opacity: 1, x: 0, y: 0, duration: 0.7, delay, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 85%' } });
    });
    return () => ctx.revert();
  }, [direction, delay]);
  return <div ref={ref} className={className}>{children}</div>;
}

export function StaggerChildren({ children, stagger = 0.1, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current?.children, { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger, duration: 0.5, ease: 'power3.out', scrollTrigger: { trigger: ref.current, start: 'top 85%' } });
    });
    return () => ctx.revert();
  }, [stagger]);
  return <div ref={ref} className={className}>{children}</div>;
}

export function TextReveal({ text, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1, ease: 'power4.out', scrollTrigger: { trigger: ref.current, start: 'top 80%' } });
    });
    return () => ctx.revert();
  }, []);
  return <span ref={ref} className={`inline-block ${className}`}>{text}</span>;
}
