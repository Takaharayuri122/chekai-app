'use client';

import type { ReactNode } from 'react';
import {
  Tooltip as TooltipRaiz,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

/**
 * Tooltip padrão do Design System (Radix via shadcn), mantendo a API anterior.
 *
 * @example
 * <Tooltip content="Explicação do item">
 *   <span>Item</span>
 * </Tooltip>
 */
export function Tooltip({ content, children, position = 'top', className = '' }: TooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <TooltipRaiz>
        <TooltipTrigger asChild>
          <span className={`inline-flex ${className}`}>{children}</span>
        </TooltipTrigger>
        <TooltipContent side={position}>{content}</TooltipContent>
      </TooltipRaiz>
    </TooltipProvider>
  );
}
