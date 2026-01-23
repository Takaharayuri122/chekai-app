'use client';

import { renderEmoji } from '@/lib/emoji';

interface EmojiProps {
  code: string | null | undefined;
  className?: string;
}

/**
 * Componente React para renderizar emojis.
 * Pode ser usado diretamente em JSX.
 * 
 * @example
 * <Emoji code="emoji_like" />
 * <Emoji code="👍" />
 * <Emoji code="Gostei emoji_like" />
 */
export function Emoji({ code, className }: EmojiProps) {
  return <span className={className}>{renderEmoji(code)}</span>;
}
