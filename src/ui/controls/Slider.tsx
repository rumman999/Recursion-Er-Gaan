import * as RSlider from '@radix-ui/react-slider';
import { useId } from 'react';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  hint?: string;
}

export function Slider({ label, value, min, max, step, onChange, format = String, hint }: Props) {
  const id = useId();
  return (
    <div className="py-2">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label id={id} className="text-[13px] text-paper">
          {label}
        </label>
        <span className="font-mono text-[12px] tabular-nums text-paper-dim">{format(value)}</span>
      </div>
      <RSlider.Root
        className="relative flex h-5 w-full touch-none select-none items-center"
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        aria-labelledby={id}
      >
        <RSlider.Track className="relative h-[3px] grow rounded-full bg-line">
          <RSlider.Range className="absolute h-full rounded-full bg-paper-dim" />
        </RSlider.Track>
        <RSlider.Thumb
          aria-labelledby={id}
          aria-valuetext={format(value)}
          className="block h-4 w-4 rounded-full border border-ink bg-paper shadow-[0_0_0_3px_rgba(232,220,196,0.12)] transition-shadow hover:shadow-[0_0_0_5px_rgba(232,220,196,0.16)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_#e9a86b]"
        />
      </RSlider.Root>
      {hint && <p className="mt-1 text-[11.5px] leading-snug text-paper-faint">{hint}</p>}
    </div>
  );
}
