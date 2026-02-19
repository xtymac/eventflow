/**
 * Temporary Mantine-to-Tailwind shims.
 * These accept Mantine-like props and render Tailwind-based markup.
 * Used during migration to reduce per-file refactor effort.
 * TODO: Remove in Phase 5 — inline all shim usage with plain Tailwind divs.
 */
import React, { forwardRef, type HTMLAttributes, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

// --- Spacing / Size Maps ---

const gapMap: Record<string, string> = {
  '0': 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
};

const paddingMap: Record<string, string> = {
  '0': 'p-0',
  xs: 'p-1.5',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
};

const pxMap: Record<string, string> = {
  xs: 'px-1.5',
  sm: 'px-2',
  md: 'px-4',
  lg: 'px-6',
  xl: 'px-8',
};

const pyMap: Record<string, string> = {
  xs: 'py-1.5',
  sm: 'py-2',
  md: 'py-4',
  lg: 'py-6',
  xl: 'py-8',
};

const mtMap: Record<string, string> = {
  xs: 'mt-1.5',
  sm: 'mt-2',
  md: 'mt-4',
  lg: 'mt-6',
  xl: 'mt-8',
};

const mbMap: Record<string, string> = {
  xs: 'mb-1.5',
  sm: 'mb-2',
  md: 'mb-4',
  lg: 'mb-6',
  xl: 'mb-8',
};

const sizeTextMap: Record<string, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

const fwMap: Record<string | number, string> = {
  400: 'font-normal',
  500: 'font-medium',
  600: 'font-semibold',
  700: 'font-bold',
};

const colorMap: Record<string, string> = {
  dimmed: 'text-muted-foreground',
  'gray.6': 'text-muted-foreground',
  'gray.7': 'text-gray-600',
  'gray.8': 'text-gray-700',
  red: 'text-red-600',
  'red.6': 'text-red-600',
  green: 'text-green-600',
  'green.6': 'text-green-600',
  blue: 'text-blue-600',
  'blue.6': 'text-blue-600',
  orange: 'text-orange-500',
  'orange.6': 'text-orange-500',
  white: 'text-white',
};

function resolveGap(gap: string | number | undefined): string {
  if (gap === undefined) return '';
  if (typeof gap === 'number') return `gap-[${gap}px]`;
  return gapMap[gap] || '';
}

function resolveSpacing(value: string | undefined, map: Record<string, string>): string {
  if (!value) return '';
  return map[value] || '';
}

// --- Stack ---

interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: string | number;
  align?: string;
  justify?: string;
  mb?: string;
  mt?: string;
  p?: string;
  px?: string;
  py?: string;
  h?: number | string;
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(
  { gap = 'md', align, justify, mb, mt, p, px, py, h, className, style, children, ...props },
  ref
) {
  const alignMap: Record<string, string> = {
    center: 'items-center',
    start: 'items-start',
    end: 'items-end',
    stretch: 'items-stretch',
  };
  const justifyMap: Record<string, string> = {
    center: 'justify-center',
    'space-between': 'justify-between',
    'flex-start': 'justify-start',
    'flex-end': 'justify-end',
  };

  const heightStyle = h ? { ...style, height: typeof h === 'number' ? `${h}px` : h } : style;

  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col',
        resolveGap(gap),
        align && alignMap[align],
        justify && justifyMap[justify],
        mb && resolveSpacing(mb, mbMap),
        mt && resolveSpacing(mt, mtMap),
        p && resolveSpacing(p, paddingMap),
        px && resolveSpacing(px, pxMap),
        py && resolveSpacing(py, pyMap),
        className
      )}
      style={heightStyle}
      {...props}
    >
      {children}
    </div>
  );
});

// --- Group ---

interface GroupProps extends HTMLAttributes<HTMLDivElement> {
  gap?: string | number;
  justify?: string;
  align?: string;
  wrap?: string;
  mb?: string | number;
  mt?: string | number;
  h?: number | string;
  p?: string;
  px?: string;
  py?: string | number;
  c?: string;
  grow?: boolean;
}

export const Group = forwardRef<HTMLDivElement, GroupProps>(function Group(
  { gap = 'md', justify, align, wrap, mb, mt, h, p, px, py, c, grow, className, style, children, ...props },
  ref
) {
  const justifyMap: Record<string, string> = {
    center: 'justify-center',
    'space-between': 'justify-between',
    'flex-start': 'justify-start',
    'flex-end': 'justify-end',
  };

  const inlineStyle: CSSProperties = { ...style };
  if (h) inlineStyle.height = typeof h === 'number' ? `${h}px` : h;
  if (typeof mt === 'number') inlineStyle.marginTop = `${mt}px`;
  if (typeof mb === 'number') inlineStyle.marginBottom = `${mb}px`;
  if (typeof py === 'number') { inlineStyle.paddingTop = `${py}px`; inlineStyle.paddingBottom = `${py}px`; }

  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center',
        resolveGap(gap),
        justify && justifyMap[justify],
        (align === 'start' || align === 'flex-start') && 'items-start',
        align === 'end' && 'items-end',
        wrap === 'wrap' && 'flex-wrap',
        typeof mb === 'string' && resolveSpacing(mb, mbMap),
        typeof mt === 'string' && resolveSpacing(mt, mtMap),
        p && resolveSpacing(p, paddingMap),
        px && resolveSpacing(px, pxMap),
        typeof py === 'string' && resolveSpacing(py, pyMap),
        c && colorMap[c],
        grow && '[&>*]:flex-1',
        className
      )}
      style={inlineStyle}
      {...props}
    >
      {children}
    </div>
  );
});

// --- Text ---

interface TextProps extends HTMLAttributes<HTMLElement> {
  size?: string;
  c?: string;
  fw?: number | string;
  ff?: string;
  ta?: string;
  truncate?: boolean | string;
  lineClamp?: number;
  span?: boolean;
  mt?: string | number;
  mb?: string;
  px?: string;
  py?: string;
  w?: number | string;
  inherit?: boolean;
  component?: string;
}

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { size, c, fw, ff, ta, truncate, lineClamp, span, mt, mb, px, py, w, className, style, children, ...props },
  ref
) {
  const Tag = span ? 'span' : 'p';

  const taMap: Record<string, string> = {
    center: 'text-center',
    right: 'text-right',
    left: 'text-left',
  };

  const inlineStyle: CSSProperties = { ...style };
  if (typeof mt === 'number') inlineStyle.marginTop = `${mt}px`;
  if (ff) inlineStyle.fontFamily = ff === 'monospace' ? 'monospace' : ff;
  if (w) inlineStyle.width = typeof w === 'number' ? `${w}px` : w;

  return (
    <Tag
      ref={ref as any}
      className={cn(
        size && sizeTextMap[size],
        c && colorMap[c],
        fw && fwMap[fw],
        ff === 'monospace' && 'font-mono',
        ta && taMap[ta],
        truncate && 'truncate',
        lineClamp && `line-clamp-${lineClamp}`,
        typeof mt === 'string' && resolveSpacing(mt, mtMap),
        mb && resolveSpacing(mb as string, mbMap),
        px && resolveSpacing(px, pxMap),
        py && resolveSpacing(py, pyMap),
        className
      )}
      style={inlineStyle}
      {...props}
    >
      {children}
    </Tag>
  );
});

// --- Title ---

interface TitleProps extends HTMLAttributes<HTMLHeadingElement> {
  order?: 1 | 2 | 3 | 4 | 5 | 6;
  fw?: number;
  ta?: string;
  c?: string;
  visibleFrom?: string;
}

const titleSizeMap: Record<number, string> = {
  1: 'text-3xl font-bold',
  2: 'text-2xl font-bold',
  3: 'text-xl font-semibold',
  4: 'text-lg font-semibold',
  5: 'text-base font-semibold',
  6: 'text-sm font-semibold',
};

const visibleFromMap: Record<string, string> = {
  xs: 'hidden xs:block',
  sm: 'hidden sm:block',
  md: 'hidden md:block',
  lg: 'hidden lg:block',
  xl: 'hidden xl:block',
};

export function Title({ order = 1, fw, ta, c, visibleFrom, className, children, ...props }: TitleProps) {
  const Tag = `h${order}` as React.ElementType;
  const taMap: Record<string, string> = { center: 'text-center', right: 'text-right' };

  return (
    <Tag
      className={cn(
        titleSizeMap[order],
        fw && fwMap[fw],
        ta && taMap[ta],
        c && colorMap[c],
        visibleFrom && visibleFromMap[visibleFrom],
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

// --- Paper ---

interface PaperProps extends HTMLAttributes<HTMLDivElement> {
  withBorder?: boolean;
  shadow?: string;
  p?: string;
  px?: string;
  py?: string;
  radius?: string;
}

export const Paper = forwardRef<HTMLDivElement, PaperProps>(function Paper(
  { withBorder, shadow, p = 'md', px, py, radius, className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-md bg-card',
        withBorder && 'border',
        shadow && 'shadow-sm',
        p && resolveSpacing(p, paddingMap),
        px && resolveSpacing(px, pxMap),
        py && resolveSpacing(py, pyMap),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

// --- Center ---

interface CenterProps extends HTMLAttributes<HTMLDivElement> {
  h?: number | string;
  py?: string;
  inline?: boolean;
}

export function Center({ h, py, inline, className, style, children, ...props }: CenterProps) {
  const heightStyle = h ? { ...style, height: typeof h === 'number' ? `${h}px` : h } : style;

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        inline && 'inline-flex',
        py && resolveSpacing(py, pyMap),
        className
      )}
      style={heightStyle}
      {...props}
    >
      {children}
    </div>
  );
}

// --- Box ---

const ptMap: Record<string, string> = {
  xs: 'pt-1.5',
  sm: 'pt-2',
  md: 'pt-4',
  lg: 'pt-6',
  xl: 'pt-8',
};

interface BoxProps extends HTMLAttributes<HTMLDivElement> {
  p?: string;
  px?: string;
  py?: string;
  pt?: string;
  mt?: string;
  mb?: string;
  component?: string;
}

export const Box = forwardRef<HTMLDivElement, BoxProps>(function Box(
  { p, px, py, pt, mt, mb, className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(
        p && resolveSpacing(p, paddingMap),
        px && resolveSpacing(px, pxMap),
        py && resolveSpacing(py, pyMap),
        pt && resolveSpacing(pt, ptMap),
        mt && resolveSpacing(mt, mtMap),
        mb && resolveSpacing(mb as string, mbMap),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

// --- Divider (Separator) ---

interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  my?: string;
  label?: string;
  labelPosition?: string;
}

export function Divider({ my, label, className, ...props }: DividerProps) {
  const myMap: Record<string, string> = {
    xs: 'my-1.5',
    sm: 'my-2',
    md: 'my-4',
    lg: 'my-6',
    xl: 'my-8',
  };

  if (label) {
    return (
      <div className={cn('flex items-center gap-2', my && myMap[my], className)}>
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }

  return <hr className={cn('border-border', my && myMap[my], className)} {...props} />;
}

// --- SimpleGrid ---

interface SimpleGridProps extends HTMLAttributes<HTMLDivElement> {
  cols?: number | Record<string, number>;
  spacing?: string;
}

export function SimpleGrid({ cols = 1, spacing = 'md', className, children, ...props }: SimpleGridProps) {
  const colCount = typeof cols === 'number' ? cols : cols.base || 1;
  const colClass = `grid-cols-${colCount}`;

  return (
    <div
      className={cn('grid', colClass, resolveGap(spacing), className)}
      {...props}
    >
      {children}
    </div>
  );
}

// --- Loader ---

export function Loader({ size = 'md', className }: { size?: string | number; className?: string }) {
  const sizeMap: Record<string, string> = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-10 w-10',
  };

  const sizeClass = typeof size === 'number' ? undefined : (sizeMap[size] || sizeMap.md);
  const sizeStyle = typeof size === 'number' ? { width: `${size}px`, height: `${size}px` } : undefined;

  return (
    <div className={cn('animate-spin rounded-full border-2 border-muted border-t-primary', sizeClass, className)} style={sizeStyle} />
  );
}
