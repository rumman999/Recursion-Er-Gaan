import { useStore } from '../state/store';
import { Modal } from './Modal';

const SHORTCUTS: [string, string][] = [
  ['Space', 'Play or pause'],
  ['N', 'New plant (random seed)'],
  ['C', 'Show or hide controls'],
  ['F', 'Focus mode: only the plant'],
  ['E', 'Download'],
  ['?', 'This help'],
  ['Esc', 'Leave focus mode or close a dialog'],
];

const MAPPING: [string, string][] = [
  ['Each call to grow()', 'One melody note, in the order the calls happen'],
  ['Turning left or right', 'The note steps up or down the scale'],
  ['How deep the call is', 'Higher register, lighter sound'],
  ['Branch length', 'How long and how loud the note is'],
  ['A leaf (the base case)', 'A soft chime, panned to where the leaf is'],
  ['Returning from a big branch', 'A low note that settles the phrase'],
  ['Each grandchild of the trunk', 'A new chord under everything'],
  ['Many calls at once', 'More wind'],
];

export function HelpDialog() {
  const open = useStore((s) => s.helpOpen);
  const setOpen = useStore((s) => s.setHelpOpen);
  return (
    <Modal open={open} onOpenChange={setOpen} title="How it works" wide>
      <div className="space-y-6 text-[14px] leading-relaxed text-paper-dim">
        <p>
          The plant is drawn by one recursive function. <code className="font-mono text-paper">grow()</code> draws a
          branch, then calls itself for each child branch, shorter and turned a little. When a call is deep enough it
          stops and draws a leaf. That stopping point is the base case.
        </p>
        <p>
          Nothing here is pre-composed. The music is the recursion played back in the order it ran, so a different
          shape is a different piece.
        </p>

        <table className="w-full border-collapse text-left text-[13px]">
          <caption className="mb-2 text-left font-display text-[16px] italic text-paper">What you hear</caption>
          <tbody>
            {MAPPING.map(([a, b]) => (
              <tr key={a} className="border-t border-line align-top">
                <th scope="row" className="w-[45%] py-2 pr-4 font-normal text-paper">
                  {a}
                </th>
                <td className="py-2">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div>
          <h3 className="mb-2 font-display text-[16px] italic text-paper">Keys</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-[13px]">
            {SHORTCUTS.map(([k, v]) => (
              <div key={k} className="contents">
                <dt>
                  <kbd className="rounded border border-line bg-ink-2 px-1.5 py-0.5 font-mono text-[12px] text-paper">{k}</kbd>
                </dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-[12.5px] text-paper-faint">
          Made for Hub's Quest, Epoch 1, by UIU Developers Hub. All sound is synthesised in the browser with Tone.js.
          Headphones help.
        </p>
      </div>
    </Modal>
  );
}
