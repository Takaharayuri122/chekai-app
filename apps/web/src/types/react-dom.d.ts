declare module 'react-dom' {
  import type { ReactElement, ReactNode } from 'react';
  export function createPortal(
    child: ReactNode,
    container: Element | DocumentFragment | null,
    key?: string | null
  ): ReactElement | null;
}
