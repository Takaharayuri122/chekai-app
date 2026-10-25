'use client';

import { useMediaQuery } from '@/hooks/use-media-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/shadcn/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/shadcn/drawer';

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Sobe acima de outro modal já aberto (ex.: seletor dentro de formulário em modal). */
  elevado?: boolean;
}

/** Dialog centralizado no desktop e folha inferior no mobile, com cabeçalho e rodapé fixos e conteúdo rolável. */
export function ResponsiveDialog({ open, onOpenChange, title, description, children, footer, elevado }: ResponsiveDialogProps) {
  const desktop = useMediaQuery('(min-width: 768px)');
  const z = elevado ? 'z-[70]' : undefined;

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent overlayClassName={z} className={`flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-lg ${z ?? ''}`}>
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer && <DialogFooter className="border-t border-border px-6 py-4">{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent overlayClassName={z} className={`flex max-h-[92vh] flex-col ${z ?? ''}`}>
        <DrawerHeader className="border-b border-border text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <DrawerFooter className="flex-row justify-end gap-2 border-t border-border pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
