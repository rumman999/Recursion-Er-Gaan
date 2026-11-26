import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { compose, formatDuration, type Composition } from '../music/mapping';
import { KEY_NAMES, MODES } from '../music/scales';
import { download } from '../export/download';
import { renderPoster } from '../viz/draw';
import { useStore } from '../state/store';
import { Modal } from './Modal';

type Format = 'wav' | 'midi' | 'png';
type Length = 'tree' | '60' | '180' | '300';

const FORMATS: { id: Format; label: string; note: string }[] = [
  { id: 'wav', label: 'Audio', note: 'WAV, 44.1 kHz stereo. Rendered offline with the same sounds you hear.' },
  { id: 'midi', label: 'MIDI', note: 'One track per layer, to open in any DAW.' },
  { id: 'png', label: 'Picture', note: 'The finished plant, 2048 × 2048.' },
];

function Toggle<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  items: { id: T; label: string }[];
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      className="grid gap-1 rounded-lg border border-line bg-ink-2 p-1"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it) => (
        <ToggleGroup.Item
          key={it.id}
          value={it.id}
          className="h-9 rounded-md text-[13px] text-paper-dim hover:text-paper data-[state=on]:bg-ink-3 data-[state=on]:text-paper"
        >
          {it.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

/** Enough plants, seed after seed, to fill the requested length. */
function plantsFor(first: Composition, seconds: number | null): Composition[] {
  const list = [first];
  if (seconds === null) return list;
  let total = first.body;
  let seed = first.tree.params.seed;
  while (total < seconds && list.length < 40) {
    seed = (seed % 9999) + 1;
    const next = compose({ ...first.tree.params, seed }, first.sound);
    list.push(next);
    total += next.body + 1.5;
  }
  return list;
}

export function ExportDialog() {
  const open = useStore((s) => s.exportOpen);
  const setOpen = useStore((s) => s.setExportOpen);
  const comp = useStore((s) => s.comp);
  const mix = useStore((s) => s.mix);
  const [format, setFormat] = useState<Format>('wav');
  const [length, setLength] = useState<Length>('tree');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!busy) return;
    const t0 = Date.now();
    setElapsed(0);
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [busy]);

  const seed = comp.tree.params.seed;
  const name = `recursion-er-gaan-${seed}`;
  const seconds = length === 'tree' ? null : Number(length);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      if (format === 'png') {
        const caption = `seed ${seed} · depth ${comp.tree.depth} · ${KEY_NAMES[comp.sound.key]} ${MODES[comp.sound.mode].label.toLowerCase()}`;
        const canvas = renderPoster(comp, caption);
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
        if (!blob) throw new Error('Could not draw the picture.');
        download(blob, `${name}.png`);
      } else {
        const plants = plantsFor(comp, seconds);
        // The render code (and the MIDI writer) loads only when someone downloads.
        const { renderMidi, renderWav } = await import('../export/render');
        if (format === 'midi') download(renderMidi(plants, seconds ?? undefined), `${name}.mid`);
        else {
          const s = useStore.getState();
          if (s.status === 'playing') s.pause();
          download(await renderWav(plants, mix, seconds ?? undefined), `${name}.wav`);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong while rendering.');
    } finally {
      setBusy(false);
    }
  };

  const fmt = FORMATS.find((f) => f.id === format)!;

  return (
    <Modal open={open} onOpenChange={(o) => !busy && setOpen(o)} title="Download" description={`Seed ${seed}. Anyone with the same settings gets the same piece.`}>
      <div className="space-y-4">
        <Toggle label="Format" value={format} onChange={setFormat} items={FORMATS} />
        <p className="text-[13px] leading-snug text-paper-dim">{fmt.note}</p>

        {format !== 'png' && (
          <div>
            <p className="mb-2 text-[13px] text-paper">Length</p>
            <Toggle
              label="Length"
              value={length}
              onChange={setLength}
              items={[
                { id: 'tree', label: `This plant ${formatDuration(comp.body)}` },
                { id: '60', label: '1 min' },
                { id: '180', label: '3 min' },
                { id: '300', label: '5 min' },
              ]}
            />
            {length !== 'tree' && (
              <p className="mt-2 text-[12px] leading-snug text-paper-faint">
                Longer pieces grow the next seeds one after another, the way endless mode does.
              </p>
            )}
          </div>
        )}

        {format === 'wav' && (
          <p className="text-[12px] leading-snug text-paper-faint">
            Audio renders faster than real time, but a long piece can still take a minute. Playback pauses while it
            works.
          </p>
        )}

        {error && (
          <p role="alert" className="text-[13px] text-rose">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-paper text-[14px] font-medium text-ink hover:bg-white disabled:opacity-60"
        >
          {busy ? (
            <>
              <LoaderCircle size={16} className="animate-spin" aria-hidden />
              <span className="tabular-nums">{format === 'wav' ? `Rendering audio · ${formatDuration(elapsed)}` : 'Preparing'}</span>
            </>
          ) : (
            `Download ${format === 'wav' ? '.wav' : format === 'midi' ? '.mid' : '.png'}`
          )}
        </button>
        <p aria-live="polite" className="sr-only">
          {busy ? 'Rendering' : ''}
        </p>
      </div>
    </Modal>
  );
}
