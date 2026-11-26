import * as RSelect from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useId } from 'react';

interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  placeholder?: string;
  compact?: boolean;
}

export function Select({ label, value, options, onChange, placeholder, compact }: Props) {
  const id = useId();
  return (
    <div className={compact ? '' : 'py-2'}>
      {!compact && (
        <label id={id} className="mb-1.5 block text-[13px] text-paper">
          {label}
        </label>
      )}
      <RSelect.Root value={value} onValueChange={onChange}>
        <RSelect.Trigger
          aria-labelledby={compact ? undefined : id}
          aria-label={compact ? label : undefined}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-line bg-ink-2 px-3 text-left text-[13px] text-paper hover:border-paper-faint"
        >
          <RSelect.Value placeholder={placeholder} />
          <RSelect.Icon>
            <ChevronDown size={14} className="text-paper-dim" aria-hidden />
          </RSelect.Icon>
        </RSelect.Trigger>
        <RSelect.Portal>
          <RSelect.Content
            position="popper"
            sideOffset={4}
            className="z-50 max-h-[min(60vh,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-line bg-ink-2 shadow-xl"
          >
            <RSelect.Viewport className="p-1">
              {options.map((o) => (
                <RSelect.Item
                  key={o.value}
                  value={o.value}
                  className="relative flex cursor-default select-none items-center rounded px-7 py-1.5 text-[13px] text-paper outline-none data-[highlighted]:bg-ink-3 data-[state=checked]:text-apricot"
                >
                  <RSelect.ItemIndicator className="absolute left-2">
                    <Check size={13} aria-hidden />
                  </RSelect.ItemIndicator>
                  <RSelect.ItemText>{o.label}</RSelect.ItemText>
                </RSelect.Item>
              ))}
            </RSelect.Viewport>
          </RSelect.Content>
        </RSelect.Portal>
      </RSelect.Root>
    </div>
  );
}
