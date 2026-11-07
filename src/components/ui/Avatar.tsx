import React from 'react';
import { cn } from './cn';

const PALETTE = [
  'bg-brand-100 text-brand-800 dark:bg-brand-500/20 dark:text-brand-200',
  'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
  'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  'bg-cyan-100 text-cyan-900 dark:bg-cyan-500/20 dark:text-cyan-200',
  'bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200',
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '')).toUpperCase();
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: 'size-8 text-xs rounded-lg', md: 'size-10 text-sm rounded-xl', lg: 'size-12 text-base rounded-xl' };

/** User avatar: photo when available, otherwise coloured initials. Decorative (name is shown next to it). */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const label = name || '?';
  if (src) {
    return <img src={src} alt="" referrerPolicy="no-referrer" className={cn('object-cover shrink-0 border border-line', SIZES[size], className)} />;
  }
  return (
    <span aria-hidden="true" className={cn('inline-flex items-center justify-center font-semibold shrink-0', SIZES[size], PALETTE[hash(label) % PALETTE.length], className)}>
      {initials(label)}
    </span>
  );
}
