import * as Tooltip from '@radix-ui/react-tooltip';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  shortcut?: string;
  children: ReactNode;
  tone?: 'plain' | 'primary';
}

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { label, shortcut, children, tone = 'plain', className = '', ...rest },
  ref,
) {
  const base =
    tone === 'primary'
      ? 'h-11 w-11 bg-paper text-ink hover:bg-white'
      : 'h-9 w-9 text-paper-dim hover:bg-ink-3 hover:text-paper aria-pressed:text-moss';
  return (
    <Tooltip.Root delayDuration={350}>
      <Tooltip.Trigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          aria-keyshortcuts={shortcut}
          className={`inline-flex shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${base} ${className}`}
          {...rest}
        >
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={8}
          className="z-50 rounded border border-line bg-ink-2 px-2 py-1 text-[12px] text-paper"
        >
          {label}
          {shortcut && <kbd className="ml-2 font-mono text-[11px] text-paper-faint">{shortcut}</kbd>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
});
