'use client';

import React, { ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

/**
 * Componente de tooltip padrão do Design System.
 * 
 * @param content - Texto do tooltip
 * @param children - Elemento que receberá o tooltip
 * @param position - Posição do tooltip (top, bottom, left, right)
 * @param className - Classes CSS adicionais
 * 
 * @example
 * <Tooltip content="Explicação do item">
 *   <span className="badge">Item</span>
 * </Tooltip>
 */
export function Tooltip({ content, children, position = 'top', className = '' }: TooltipProps) {
  const positionClasses = {
    top: 'tooltip-top',
    bottom: 'tooltip-bottom',
    left: 'tooltip-left',
    right: 'tooltip-right',
  };

  return (
    <div
      className={`tooltip ${positionClasses[position]} ${className}`}
      data-tip={content}
    >
      {children}
    </div>
  );
}
