import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onOpenChange, title, description, children, wide }: Props) {
  // Dialogs open from app state (buttons and shortcuts), not a Radix Trigger,
  // so remember what had focus and give it back on close.
  const returnTo = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/70" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            // Runs just before Radix moves focus into the dialog.
            returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(e) => {
            if (returnTo.current && document.contains(returnTo.current)) {
              e.preventDefault();
              returnTo.current.focus();
            }
          }}
          className={`panel fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl p-6 shadow-2xl scroll-quiet ${
            wide ? 'max-w-[620px]' : 'max-w-[440px]'
          }`}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-[22px] leading-tight text-paper">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-[13px] text-paper-dim">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-mr-2 -mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-paper-dim hover:bg-ink-3 hover:text-paper"
            >
              <X size={16} aria-hidden />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
