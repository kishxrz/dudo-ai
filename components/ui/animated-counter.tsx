"use client";

import { useEffect, useState, useRef } from 'react';

interface AnimatedCounterProps {
  value: string;
  duration?: number; // duration in ms, default 1800
}

export default function AnimatedCounter({ value, duration = 1800 }: AnimatedCounterProps) {
  const [count, setCount] = useState<string>(value);
  const [isInView, setIsInView] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Set initial 0 state with correct format before intersecting
    if (value === "24/7" || !/\d/.test(value)) {
      setCount(value);
      return;
    }

    const match = value.match(/(\d[\d,]*\.?\d*)/);
    if (!match) {
      setCount(value);
      return;
    }

    const rawNumStr = match[1];
    const parts = value.split(rawNumStr);
    const prefix = parts[0] || '';
    const suffix = parts[1] || '';

    if (!isInView) {
      setCount(`${prefix}0${suffix}`);
    }
  }, [value, isInView]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isInView) return;

    // If it's 24/7 or does not contain digits, skip animation
    if (value === "24/7" || !/\d/.test(value)) {
      setCount(value);
      return;
    }

    // Extract digits, commas and decimal point together
    const match = value.match(/(\d[\d,]*\.?\d*)/);
    if (!match) {
      setCount(value);
      return;
    }

    const rawNumStr = match[1];
    const cleanNumStr = rawNumStr.replace(/,/g, '');
    const targetNumber = parseFloat(cleanNumStr);
    const isDecimal = cleanNumStr.includes('.');
    
    // Find suffix/prefix using the raw matched number string (with commas)
    const parts = value.split(rawNumStr);
    const prefix = parts[0] || '';
    const suffix = parts[1] || '';

    let start = 0;
    const startTime = performance.now();
    let animationFrameId: number;

    const updateCount = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing out quadratic: slow down as we approach the end
      const easeProgress = progress * (2 - progress);
      const currentVal = start + easeProgress * (targetNumber - start);

      let formattedVal = "";
      if (isDecimal) {
        formattedVal = currentVal.toFixed(1);
      } else {
        formattedVal = Math.floor(currentVal).toLocaleString();
      }

      setCount(`${prefix}${formattedVal}${suffix}`);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCount);
      }
    };

    animationFrameId = requestAnimationFrame(updateCount);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [value, duration, isInView]);

  return <span ref={containerRef}>{count}</span>;
}
