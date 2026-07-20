'use client';
import { useState, useEffect } from 'react';

function TimeBlock({ value, label }) {
  return (
    <div className="flex flex-col items-center bg-white/20 backdrop-blur-sm rounded-xl px-3 py-2 min-w-[60px]">
      <span className="text-2xl md:text-3xl font-bold text-white tabular-nums">{String(value).padStart(2, '0')}</span>
      <span className="text-white/80 text-xs mt-0.5 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export default function CountdownTimer({ endTime, onExpire, className = '' }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const end = new Date(endTime).getTime();
      const diff = end - now;
      if (diff <= 0) { setExpired(true); onExpire?.(); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ days, hours, minutes, seconds });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime, onExpire]);

  if (expired) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {timeLeft.days > 0 && <TimeBlock value={timeLeft.days} label="Days" />}
      <TimeBlock value={timeLeft.hours} label="Hours" />
      <span className="text-white/70 font-bold text-2xl -mt-3">:</span>
      <TimeBlock value={timeLeft.minutes} label="Mins" />
      <span className="text-white/70 font-bold text-2xl -mt-3">:</span>
      <TimeBlock value={timeLeft.seconds} label="Secs" />
    </div>
  );
}
