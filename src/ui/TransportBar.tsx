import * as RSlider from '@radix-ui/react-slider';
import { Download, Eye, LoaderCircle, Pause, Play, Shuffle, SlidersHorizontal, Volume1 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStore } from '../state/store';
import { IconButton } from './controls/IconButton';
import { Select } from './controls/Select';
import { Switch } from './controls/Switch';

function useSleepLeft(endsAt: number | null): string | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endsAt) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, [endsAt]);
  if (!endsAt) return null;
  return `${Math.max(1, Math.ceil((endsAt - now) / 60_000))} min`;
}

export function TransportBar() {
  const status = useStore((s) => s.status);
  const endless = useStore((s) => s.endless);
  const sleep = useStore((s) => s.sleep);
  const sleepEndsAt = useStore((s) => s.sleepEndsAt);
  const volume = useStore((s) => s.volume);
  const drawerOpen = useStore((s) => s.drawerOpen);
  const s = useStore.getState();
  const sleepLeft = useSleepLeft(sleepEndsAt);

  const playing = status === 'playing';
  return (
    <div
      role="toolbar"
      aria-label="Playback"
      className="panel flex items-center gap-1.5 rounded-2xl px-2 py-2 sm:gap-2 sm:px-3"
    >
      <IconButton
        tone="primary"
        label={playing ? 'Pause' : 'Play'}
        shortcut="Space"
        onClick={s.togglePlay}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? (
          <LoaderCircle size={20} className="animate-spin" aria-hidden />
        ) : playing ? (
          <Pause size={20} aria-hidden />
        ) : (
          <Play size={20} className="translate-x-[1px]" aria-hidden />
        )}
      </IconButton>

      <IconButton label="New plant" shortcut="N" onClick={s.newSeed}>
        <Shuffle size={17} aria-hidden />
      </IconButton>

      <div className="mx-1 hidden h-6 w-px bg-line sm:block" />

      <div className="hidden sm:block">
        <Switch label="Endless" checked={endless} onChange={s.setEndless} />
      </div>

      <div className="hidden w-[118px] md:block">
        <Select
          compact
          label="Sleep timer"
          value={String(sleep)}
          onChange={(v) => s.setSleep(Number(v))}
          options={[
            { value: '0', label: 'Sleep: off' },
            { value: '15', label: '15 minutes' },
            { value: '30', label: '30 minutes' },
            { value: '60', label: '60 minutes' },
          ].map((o) => (o.value === String(sleep) && sleep ? { ...o, label: `Sleep ${sleepLeft}` } : o))}
        />
      </div>

      <div className="hidden items-center gap-2 pl-1 lg:flex">
        <Volume1 size={16} className="text-paper-dim" aria-hidden />
        <RSlider.Root
          className="relative flex h-5 w-24 touch-none select-none items-center"
          value={[volume]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={([v]) => s.setVolume(v)}
        >
          <RSlider.Track className="relative h-[3px] grow rounded-full bg-line">
            <RSlider.Range className="absolute h-full rounded-full bg-paper-dim" />
          </RSlider.Track>
          <RSlider.Thumb
            aria-label="Volume"
            aria-valuetext={`${Math.round(volume * 100)}%`}
            className="block h-3.5 w-3.5 rounded-full bg-paper focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_#e9a86b]"
          />
        </RSlider.Root>
      </div>

      <div className="mx-1 h-6 w-px bg-line" />

      <IconButton label={drawerOpen ? 'Hide controls' : 'Show controls'} shortcut="C" aria-pressed={drawerOpen} onClick={() => s.setDrawer(!drawerOpen)}>
        <SlidersHorizontal size={17} aria-hidden />
      </IconButton>
      <IconButton label="Download" shortcut="E" onClick={() => s.setExportOpen(true)}>
        <Download size={17} aria-hidden />
      </IconButton>
      <IconButton label="Focus mode" shortcut="F" onClick={() => s.setFocus(true)}>
        <Eye size={17} aria-hidden />
      </IconButton>
    </div>
  );
}
