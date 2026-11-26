import * as Tooltip from '@radix-ui/react-tooltip';
import { CircleHelp, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useStore } from './state/store';
import { writeHash } from './state/urlSync';
import { ControlDrawer } from './ui/ControlDrawer';
import { ExportDialog } from './ui/ExportDialog';
import { HelpDialog } from './ui/HelpDialog';
import { TransportBar } from './ui/TransportBar';
import { IconButton } from './ui/controls/IconButton';
import { CallStack } from './viz/CallStack';
import { TreeCanvas } from './viz/TreeCanvas';

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable || el.getAttribute('role') === 'combobox');

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      const s = useStore.getState();
      if (s.exportOpen || s.helpOpen) return;
      const target = e.target as HTMLElement | null;
      switch (e.key) {
        case ' ':
          // Let focused buttons and sliders handle Space themselves.
          if (target && (target.tagName === 'BUTTON' || target.getAttribute('role') === 'slider')) return;
          e.preventDefault();
          s.togglePlay();
          break;
        case 'n':
        case 'N':
          s.newSeed();
          break;
        case 'c':
        case 'C':
          s.setDrawer(!s.drawerOpen);
          break;
        case 'f':
        case 'F':
          s.setFocus(!s.focus);
          break;
        case 'e':
        case 'E':
          s.setExportOpen(true);
          break;
        case '?':
          s.setHelpOpen(true);
          break;
        case 'Escape':
          if (s.focus) s.setFocus(false);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function useHashSync() {
  useEffect(() => {
    let t: number | undefined;
    return useStore.subscribe((s, prev) => {
      if (s.grow === prev.grow && s.sound === prev.sound) return;
      window.clearTimeout(t);
      t = window.setTimeout(() => writeHash(s.grow, s.sound), 400);
    });
  }, []);
}

function Intro() {
  const play = useStore((s) => s.play);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[22vh] z-10 flex justify-center px-4">
      <div
        className="pointer-events-auto max-w-[34rem] px-8 py-6 text-center"
        style={{ background: 'radial-gradient(closest-side, rgba(14,21,18,0.92), rgba(14,21,18,0.75) 60%, rgba(14,21,18,0))' }}
      >
        <p className="font-display text-[clamp(26px,4.5vw,40px)] leading-[1.15] text-paper">
          A plant that grows by calling itself.
        </p>
        <p className="mx-auto mt-3 max-w-[26rem] text-[15px] leading-relaxed text-paper-dim">
          Every call plays a note, every leaf rings. Put on headphones and press play.
        </p>
        <button
          type="button"
          onClick={() => void play()}
          className="mt-7 inline-flex h-12 items-center gap-2.5 rounded-full bg-paper pl-5 pr-6 text-[15px] font-medium text-ink transition-colors hover:bg-white"
        >
          <Play size={18} aria-hidden /> Play
        </button>
      </div>
    </div>
  );
}

export function App() {
  const started = useStore((s) => s.started);
  const focus = useStore((s) => s.focus);
  const drawerOpen = useStore((s) => s.drawerOpen);
  const announcement = useStore((s) => s.announcement);
  const setFocus = useStore((s) => s.setFocus);
  const setHelpOpen = useStore((s) => s.setHelpOpen);
  const seed = useStore((s) => s.grow.seed);
  const wide = useMedia('(min-width: 1024px)');
  const xwide = useMedia('(min-width: 1280px)');
  const [focusHint, setFocusHint] = useState(false);

  const chromeRef = useRef<HTMLDivElement>(null);

  useShortcuts();
  useHashSync();

  // Hidden chrome must not take focus or clicks. (React 18 has no typed `inert` prop.)
  useEffect(() => {
    chromeRef.current?.toggleAttribute('inert', focus);
  }, [focus]);

  useEffect(() => {
    if (!focus) return setFocusHint(false);
    setFocusHint(true);
    const id = window.setTimeout(() => setFocusHint(false), 3500);
    return () => window.clearTimeout(id);
  }, [focus]);

  const insets = focus
    ? { top: 24, right: 0, bottom: 24, left: 0 }
    : {
        top: 72,
        bottom: 96,
        left: wide && drawerOpen ? 340 : 0,
        right: xwide ? 300 : 0,
      };

  return (
    <Tooltip.Provider>
      <TreeCanvas insets={insets} />

      {focus && (
        <button
          type="button"
          aria-label="Leave focus mode"
          onClick={() => setFocus(false)}
          className="fixed inset-0 z-20 cursor-default"
        />
      )}
      <p
        aria-hidden={!focusHint}
        className={`chrome pointer-events-none fixed inset-x-0 bottom-8 z-30 text-center text-[13px] text-paper-dim`}
        data-hidden={!focusHint}
      >
        Press F, Esc or tap anywhere to bring the controls back
      </p>

      <div ref={chromeRef} className="chrome" data-hidden={focus}>
        <header className="fixed left-4 right-4 top-4 z-10 flex items-start justify-between sm:left-6 sm:right-6">
          <div>
            <h1 className="font-display text-[21px] font-medium leading-none tracking-[-0.01em] text-paper">
              Recursion Er Gaan
            </h1>
            <p className="mt-1.5 font-mono text-[11.5px] text-paper-faint">seed {seed}</p>
            {!xwide && <CallStack compact />}
          </div>
          <IconButton label="How it works" shortcut="?" onClick={() => setHelpOpen(true)}>
            <CircleHelp size={18} aria-hidden />
          </IconButton>
        </header>

        {!started && <Intro />}

        {drawerOpen && (
          <aside
            aria-label="Controls"
            className={
              wide
                ? 'panel fixed bottom-[92px] left-4 top-[72px] z-10 w-[320px] overflow-hidden rounded-2xl sm:left-6'
                : 'panel fixed inset-x-2 bottom-[80px] z-30 max-h-[58vh] overflow-hidden rounded-2xl'
            }
          >
            <ControlDrawer />
          </aside>
        )}

        {xwide && (
          <aside className="panel fixed right-6 top-[72px] z-10 w-[268px] rounded-2xl p-4">
            <CallStack />
          </aside>
        )}

        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-2">
          <TransportBar />
        </div>
      </div>

      <ExportDialog />
      <HelpDialog />

      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
    </Tooltip.Provider>
  );
}
