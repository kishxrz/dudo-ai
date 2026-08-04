'use client';

/**
 * Reusable Framer Motion animation primitives for the Resources Hub.
 * 
 * - FadeUp      : fades in + slides up (headings, paragraphs)
 * - FadeIn      : fades in only (search bars, dividers)
 * - SlideUp     : slides up with slight scale (cards, boxes)
 * - StaggerWrap : wraps a list and staggers children
 */

import React from 'react';
import { motion, Variants } from 'framer-motion';

// ─── Variants ────────────────────────────────────────────────────────────────

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay },
  }),
};

const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    transition: { duration: 0.4, ease: 'easeOut', delay },
  }),
};

const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 36, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

// ─── Components ──────────────────────────────────────────────────────────────

interface BaseProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: keyof React.JSX.IntrinsicElements;
}

/** Fades in + slides up — perfect for headings and body text */
export function FadeUp({ children, className, delay = 0, as = 'div' }: BaseProps) {
  const Tag = motion[as as keyof typeof motion] as typeof motion.div;
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
      variants={fadeUpVariants}
      custom={delay}
    >
      {children}
    </Tag>
  );
}

/** Fades in only — for search bars, borders, subtle elements */
export function FadeIn({ children, className, delay = 0, as = 'div' }: BaseProps) {
  const Tag = motion[as as keyof typeof motion] as typeof motion.div;
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-20px' }}
      variants={fadeInVariants}
      custom={delay}
    >
      {children}
    </Tag>
  );
}

/** Slides up with slight scale — perfect for cards and boxes */
export function SlideUp({ children, className }: Omit<BaseProps, 'delay' | 'as'>) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-30px' }}
      variants={slideUpVariants}
    >
      {children}
    </motion.div>
  );
}

/** Wraps a list and staggers children — wrap around a .map() container */
export function StaggerWrap({ children, className }: Omit<BaseProps, 'delay' | 'as'>) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-30px' }}
      variants={staggerContainerVariants}
    >
      {children}
    </motion.div>
  );
}

/** Individual stagger child — wrap each card inside StaggerWrap */
export function StaggerItem({ children, className }: Omit<BaseProps, 'delay' | 'as'>) {
  return (
    <motion.div
      className={className}
      variants={slideUpVariants}
    >
      {children}
    </motion.div>
  );
}
