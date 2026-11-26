import * as RSwitch from '@radix-ui/react-switch';
import { useId } from 'react';

interface Props {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function Switch({ label, checked, onChange }: Props) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <RSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        className="relative h-[18px] w-8 shrink-0 rounded-full border border-line bg-ink-3 transition-colors data-[state=checked]:border-moss data-[state=checked]:bg-moss/30"
      >
        <RSwitch.Thumb className="block h-3 w-3 translate-x-[2px] rounded-full bg-paper-dim transition-transform data-[state=checked]:translate-x-[15px] data-[state=checked]:bg-paper" />
      </RSwitch.Root>
      <label htmlFor={id} className="cursor-pointer select-none text-[13px] text-paper">
        {label}
      </label>
    </div>
  );
}
