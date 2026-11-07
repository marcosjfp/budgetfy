import React from 'react';
import { Utensils, Home, Zap, Car, Film, ShoppingBag, HeartPulse, Plane, Tag, type LucideIcon } from 'lucide-react';
import { cn } from './ui/cn';

interface CategoryStyle {
  icon: LucideIcon;
  /** Icon/text colour (≥ 3:1 on its background in both themes). */
  color: string;
  bg: string;
}

export const CATEGORY_CONFIG: Record<string, CategoryStyle> = {
  Food: { icon: Utensils, color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-50 dark:bg-orange-500/15' },
  Rent: { icon: Home, color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-500/15' },
  Utilities: { icon: Zap, color: 'text-yellow-800 dark:text-yellow-300', bg: 'bg-yellow-50 dark:bg-yellow-500/15' },
  Transport: { icon: Car, color: 'text-purple-700 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-500/15' },
  Entertainment: { icon: Film, color: 'text-pink-700 dark:text-pink-300', bg: 'bg-pink-50 dark:bg-pink-500/15' },
  Shopping: { icon: ShoppingBag, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-500/15' },
  Health: { icon: HeartPulse, color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-500/15' },
  Travel: { icon: Plane, color: 'text-cyan-800 dark:text-cyan-300', bg: 'bg-cyan-50 dark:bg-cyan-500/15' },
  Other: { icon: Tag, color: 'text-zinc-700 dark:text-zinc-300', bg: 'bg-zinc-100 dark:bg-zinc-500/15' },
};

export function categoryStyle(category: string): CategoryStyle {
  return CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.Other;
}

export function CategoryIcon({ category, size = 'md', className, children }: { category: string; size?: 'sm' | 'md'; className?: string; children?: React.ReactNode }) {
  const { icon: Icon, color, bg } = categoryStyle(category);
  return (
    <span
      aria-hidden="true"
      className={cn('relative inline-flex items-center justify-center shrink-0', bg, color, size === 'sm' ? 'size-9 rounded-lg' : 'size-11 rounded-xl', className)}
    >
      <Icon className={size === 'sm' ? 'size-4' : 'size-5'} />
      {children}
    </span>
  );
}

/** Coloured dot for a group (theme colour or type fallback). */
export function GroupDot({ type, color, className }: { type: string; color?: string; className?: string }) {
  const fallback = type === 'personal' ? 'bg-blue-500' : type === 'household' ? 'bg-emerald-500' : 'bg-orange-500';
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2.5 rounded-full shrink-0', !color && fallback, className)}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}
