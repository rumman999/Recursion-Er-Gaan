import { Shuffle, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { maxDepthFor } from '../recursion/branch';
import { formatDuration } from '../music/mapping';
import { KEY_NAMES, MODE_IDS, MODES, type ModeId } from '../music/scales';
import { PRESETS } from '../state/presets';
import { useStore } from '../state/store';
import { IconButton } from './controls/IconButton';
import { Select } from './controls/Select';
import { Slider } from './controls/Slider';

function Group({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="border-t border-line px-5 py-4 first:border-t-0">
      <h2 className="font-display text-[15px] italic text-paper">{title}</h2>
      {note && <p className="mt-1 text-[12px] leading-snug text-paper-faint">{note}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function SeedField() {
  const seed = useStore((s) => s.grow.seed);
  const setGrow = useStore((s) => s.setGrow);
  const newSeed = useStore((s) => s.newSeed);
  const [draft, setDraft] = useState(String(seed));
  useEffect(() => setDraft(String(seed)), [seed]);

  const commit = () => {
    const v = Math.round(Number(draft));
    if (Number.isFinite(v) && v >= 1 && v <= 9999) setGrow({ seed: v });
    else setDraft(String(seed));
  };

  return (
    <div className="py-2">
      <label htmlFor="seed" className="mb-1.5 block text-[13px] text-paper">
        Seed
      </label>
      <div className="flex gap-2">
        <input
          id="seed"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="h-9 w-full rounded-md border border-line bg-ink-2 px-3 font-mono text-[13px] tabular-nums text-paper hover:border-paper-faint"
        />
        <button
          type="button"
          onClick={newSeed}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-line px-3 text-[13px] text-paper-dim hover:border-paper-faint hover:text-paper"
        >
          <Shuffle size={14} aria-hidden /> New
        </button>
      </div>
      <p className="mt-1 text-[11.5px] leading-snug text-paper-faint">Same seed, same plant, same song.</p>
    </div>
  );
}

export function ControlDrawer() {
  const grow = useStore((s) => s.grow);
  const sound = useStore((s) => s.sound);
  const mix = useStore((s) => s.mix);
  const comp = useStore((s) => s.comp);
  const setGrow = useStore((s) => s.setGrow);
  const setSound = useStore((s) => s.setSound);
  const setMix = useStore((s) => s.setMix);
  const applyPreset = useStore((s) => s.applyPreset);
  const setDrawer = useStore((s) => s.setDrawer);

  const match = PRESETS.find(
    (p) =>
      p.grow.depth === grow.depth &&
      p.grow.branches === grow.branches &&
      p.grow.spread === grow.spread &&
      p.grow.ratio === grow.ratio &&
      p.grow.wildness === grow.wildness &&
      p.sound.key === sound.key &&
      p.sound.mode === sound.mode &&
      p.sound.tempo === sound.tempo,
  );
  const cap = maxDepthFor(grow.branches);
  const capped = grow.depth > cap;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-1 pt-4">
        <p className="font-mono text-[11.5px] text-paper-faint">
          {comp.tree.nodes.length} calls · {comp.tree.leaves} leaves · {formatDuration(comp.body)}
        </p>
        <IconButton label="Close controls" shortcut="C" onClick={() => setDrawer(false)} className="-mr-2">
          <X size={16} aria-hidden />
        </IconButton>
      </div>

      <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto pb-6">
        <Group title="Start from">
          <Select
            label="Preset"
            value={match?.id ?? 'custom'}
            onChange={(v) => v !== 'custom' && applyPreset(v)}
            options={[
              ...PRESETS.map((p) => ({ value: p.id, label: p.name })),
              ...(match ? [] : [{ value: 'custom', label: 'Your own' }]),
            ]}
          />
          {match && <p className="text-[12px] leading-snug text-paper-faint">{match.note}</p>}
        </Group>

        <Group title="Shape" note="These are the arguments grow() is called with.">
          <Slider
            label="Depth"
            value={grow.depth}
            min={1}
            max={9}
            step={1}
            onChange={(depth) => setGrow({ depth })}
            hint={
              capped
                ? `With three branches the recursion stops at depth ${cap}, to stay under 1,500 calls.`
                : 'How many times grow() may call itself.'
            }
          />
          <Slider
            label="Branches per call"
            value={grow.branches}
            min={2}
            max={3}
            step={1}
            onChange={(b) => setGrow({ branches: b === 3 ? 3 : 2 })}
          />
          <Slider
            label="Spread"
            value={grow.spread}
            min={10}
            max={60}
            step={1}
            format={(v) => `${v}°`}
            onChange={(spread) => setGrow({ spread })}
          />
          <Slider
            label="Length ratio"
            value={grow.ratio}
            min={0.55}
            max={0.85}
            step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={(ratio) => setGrow({ ratio })}
            hint="Each child is this much of its parent. Longer branches hold their notes longer."
          />
          <Slider
            label="Wildness"
            value={grow.wildness}
            min={0}
            max={1}
            step={0.01}
            format={pct}
            onChange={(wildness) => setGrow({ wildness })}
          />
          <SeedField />
        </Group>

        <Group title="Sound">
          <div className="grid grid-cols-[1fr_1.6fr] gap-3">
            <Select
              label="Key"
              value={String(sound.key)}
              onChange={(v) => setSound({ key: Number(v) })}
              options={KEY_NAMES.map((k, i) => ({ value: String(i), label: k }))}
            />
            <Select
              label="Scale"
              value={sound.mode}
              onChange={(v) => setSound({ mode: v as ModeId })}
              options={MODE_IDS.map((m) => ({ value: m, label: MODES[m].label }))}
            />
          </div>
          <Slider
            label="Tempo"
            value={sound.tempo}
            min={48}
            max={84}
            step={1}
            format={(v) => `${v} bpm`}
            onChange={(tempo) => setSound({ tempo })}
          />
        </Group>

        <Group title="Mix">
          <Slider label="Roots" value={mix.roots} min={0} max={1} step={0.01} format={pct} onChange={(roots) => setMix({ roots })} />
          <Slider label="Melody" value={mix.melody} min={0} max={1} step={0.01} format={pct} onChange={(melody) => setMix({ melody })} />
          <Slider label="Leaves" value={mix.chimes} min={0} max={1} step={0.01} format={pct} onChange={(chimes) => setMix({ chimes })} />
          <Slider label="Wind" value={mix.wind} min={0} max={1} step={0.01} format={pct} onChange={(wind) => setMix({ wind })} />
          <Slider label="Space" value={mix.space} min={0} max={1} step={0.01} format={pct} onChange={(space) => setMix({ space })} />
        </Group>
      </div>
    </div>
  );
}
