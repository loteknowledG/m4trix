'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type StoryState = 'setup' | 'scene' | 'conflict' | 'climax' | 'resolution' | 'end';

type Agent = { id: string; name: string; role: string; color: string };

type Beat = { step: number; agent: string; state: StoryState; text: string };

const AGENTS: Agent[] = [
  { id: 'narrator', name: 'Narrator', role: 'frames the scene', color: 'bg-sky-500' },
  { id: 'hero', name: 'Hero', role: 'acts/decides', color: 'bg-emerald-500' },
  { id: 'antagonist', name: 'Antagonist', role: 'opposes/conflicts', color: 'bg-rose-500' },
];

const STATE_FLOW: Record<StoryState, StoryState[]> = {
  setup: ['scene'],
  scene: ['conflict', 'scene'],
  conflict: ['climax', 'scene'],
  climax: ['resolution'],
  resolution: ['end', 'scene'],
  end: ['setup'],
};

const TEMPLATES: Record<StoryState, string[]> = {
  setup: [
    'In a quiet town, {hero} wakes to an unusual silence.',
    'A rumor spreads: {antagonist} has returned to the valley.',
    'Once upon a dusk, {narrator} notes that something has shifted in the air.',
  ],
  scene: [
    '{hero} wanders through the marketplace and meets an old friend.',
    'The town prepares for the festival; banners snap in the wind.',
    '{antagonist} watches from a distance, calculating a move.',
  ],
  conflict: [
    'A theft is discovered and fingers point at {hero}.',
    '{antagonist} confronts {hero} with a challenge: surrender or fight.',
    'Tensions flare as secrets about the mayor are whispered.',
  ],
  climax: [
    'At the bridge, {hero} faces {antagonist} — a single decision will change everything.',
    'A hidden truth is revealed and the crowd gasps.',
    'Lightning cracks as allies choose sides and fate is decided.',
  ],
  resolution: [
    'With dust settled, {narrator} explains the new order that will hold for now.',
    'The town rebuilds; wounds begin to heal and old songs return.',
    '{hero} reflects on choices made, wiser and changed.',
  ],
  end: [
    'And so the tale closes — for now.',
    'The caravan leaves as dawn breaks; the valley remembers.',
  ],
};

function pickTemplate(state: StoryState, rnd: () => number) {
  const list = TEMPLATES[state];
  return list[Math.floor(rnd() * list.length)];
}

function renderTemplate(t: string) {
  return t
    .replace(/\{hero\}/g, 'the hero')
    .replace(/\{antagonist\}/g, 'the antagonist')
    .replace(/\{narrator\}/g, 'the narrator');
}

export type StoryBeat = Beat;

export type AgenticStoryMachineProps = {
  onBeforeBeat?: (beat: Beat) => Promise<Beat | null> | (Beat | null);
  onAfterBeat?: (beat: Beat) => void;
  /** Optional named action handlers that beats can request (whitelisted) */
  actionHandlers?: Record<string, (payload?: any) => void | Promise<void>>;
  /** Opt-in: allow beats to request DOM selector clicks (unsafe; requires confirm) */
  allowDomClicks?: boolean;
};

export default function AgenticStoryMachine({
  onBeforeBeat,
  onAfterBeat,
  actionHandlers,
  allowDomClicks = false,
}: AgenticStoryMachineProps = {}) {
  const [state, setState] = useState<StoryState>('setup');
  const [beats, setBeats] = useState<Beat[]>([]);
  const [running, setRunning] = useState(false);
  const [currentAgent, setCurrentAgent] = useState(0);
  const [maxBeats, setMaxBeats] = useState(8);
  const [interceptEnabled, setInterceptEnabled] = useState(false);
  const [pendingBeat, setPendingBeat] = useState<Beat | null>(null);
  const [editText, setEditText] = useState('');
  const pendingRef = useRef<HTMLTextAreaElement | null>(null);
  const rng = useRef(() => Math.random());
  const stepRef = useRef(0);
  const intervalRef = useRef<number | null>(null);

  const canAdvance = useMemo(
    () => beats.length < maxBeats && state !== 'end' && !pendingBeat,
    [beats.length, maxBeats, state, pendingBeat]
  );

  async function commitBeat(beat: Beat | null) {
    // null => rejected
    if (!beat) {
      setCurrentAgent(i => (i + 1) % AGENTS.length);
      return;
    }
    setBeats(b => [beat, ...b]);
    onAfterBeat?.(beat);
  }

  async function prepareBeat(agent: Agent, s: StoryState) {
    stepRef.current += 1;
    const raw = pickTemplate(s, rng.current);
    const text = renderTemplate(raw);
    const beat: Beat = { step: stepRef.current, agent: agent.name, state: s, text };

    // programmatic hook
    if (onBeforeBeat) {
      const result = await onBeforeBeat(beat);
      if (result === null) {
        setCurrentAgent(i => (i + 1) % AGENTS.length);
        return null;
      }
      await commitBeat(result);
      return result;
    }

    // UI interception — pause auto-play, surface pending beat for user action
    if (interceptEnabled) {
      stopAuto();
      setPendingBeat(beat);
      setEditText(beat.text);
      return null;
    }

    // immediate commit
    await commitBeat(beat);
    return beat;
  }

  async function stepOnce() {
    const agent = AGENTS[currentAgent];
    const result = await prepareBeat(agent, state);
    if (result) {
      const options = STATE_FLOW[state];
      let next: StoryState = options[Math.floor(rng.current() * options.length)];
      if (agent.id === 'narrator') next = options[0];
      if (agent.id === 'antagonist' && options.includes('conflict')) next = 'conflict';
      if (agent.id === 'hero' && options.includes('resolution')) next = 'resolution';
      setState(next);
      setCurrentAgent(i => (i + 1) % AGENTS.length);
      if (beats.length + 1 >= maxBeats || next === 'end') setRunning(false);
    }
  }

  function approvePending() {
    if (!pendingBeat) return;
    const beat = { ...pendingBeat, text: editText };
    setPendingBeat(null);
    commitBeat(beat);

    // resume or advance after approval
    const agent = AGENTS[currentAgent];
    const options = STATE_FLOW[state];
    let next: StoryState = options[Math.floor(rng.current() * options.length)];
    if (agent.id === 'narrator') next = options[0];
    if (agent.id === 'antagonist' && options.includes('conflict')) next = 'conflict';
    if (agent.id === 'hero' && options.includes('resolution')) next = 'resolution';
    setState(next);
    setCurrentAgent(i => (i + 1) % AGENTS.length);
  }

  function rejectPending() {
    setPendingBeat(null);
    setEditText('');
    setCurrentAgent(i => (i + 1) % AGENTS.length);
  }

  // focus & scroll pending beat into view for better discoverability
  useEffect(() => {
    if (pendingBeat) {
      // focus textarea
      pendingRef.current?.focus();
      // scroll into view if it's offscreen inside the component
      pendingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [pendingBeat]);

  function startAuto() {
    if (!canAdvance) return;
    setRunning(true);
    intervalRef.current = window.setInterval(() => {
      stepOnce();
    }, 900);
  }

  function stopAuto() {
    setRunning(false);
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function reset() {
    stopAuto();
    setState('setup');
    setBeats([]);
    stepRef.current = 0;
    setCurrentAgent(0);
    setPendingBeat(null);
  }

  // Execute a suggested action embedded in the beat text:
  // - [action:name] -> calls a registered action handler (whitelisted)
  // - [dom:selector] -> clicks the DOM selector only when allowDomClicks is true
  async function runSuggestedAction() {
    if (!pendingBeat) return;
    const text = editText || pendingBeat.text || '';
    const actionMatch = text.match(/\[action:([^\]]+)\]/i);
    const domMatch = text.match(/\[dom:([^\]]+)\]/i);

    if (actionMatch) {
      const name = actionMatch[1];
      const handler = actionHandlers?.[name];
      if (!handler) {
        console.warn('No action handler registered for', name);
        return;
      }
      try {
        await handler({ from: 'beat', beat: pendingBeat });
        console.log('Executed action handler', name);
      } catch (err) {
        console.error('Action handler error', err);
      }
      return;
    }

    if (domMatch) {
      const selector = domMatch[1];
      if (!allowDomClicks) {
        console.warn('DOM clicks not allowed (allowDomClicks=false)');
        return;
      }
      const el = document.querySelector(selector);
      if (!el) {
        console.warn('DOM selector not found for', selector);
        return;
      }
      try {
        (el as HTMLElement).click();
        console.log('Clicked DOM selector', selector);
      } catch (err) {
        console.error('DOM click failed', err);
      }
      return;
    }

    console.info('No suggested action found in beat');
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white/50 p-6 shadow-sm text-zinc-900">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Agentic Story Machine (prototype)</h3>
          <p className="text-sm text-zinc-500">
            Agents take turns contributing story beats and advance the narrative state.
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="text-sm text-zinc-600">State</div>
          <div className="px-3 py-1 rounded-md bg-zinc-100 font-mono text-sm">{state}</div>
          <div className="text-sm text-zinc-600">Beats</div>
          <div className="px-3 py-1 rounded-md bg-zinc-100 font-mono text-sm">
            {beats.length}/{maxBeats}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2">
          <div className="flex gap-3 mb-3">
            <button
              className="rounded-md bg-sky-600 px-3 py-1 text-white text-sm hover:bg-sky-700"
              onClick={() => (running ? stopAuto() : startAuto())}
            >
              {running ? 'Pause' : 'Play'}
            </button>
            <button
              className="rounded-md border px-3 py-1 text-sm hover:bg-zinc-50"
              onClick={() => stepOnce()}
            >
              Step
            </button>
            <button
              className="rounded-md border px-3 py-1 text-sm hover:bg-zinc-50"
              onClick={() => reset()}
            >
              Reset
            </button>
            <div className="ml-3 text-sm text-zinc-500">Max beats</div>
            <input
              className="w-20 rounded-md border px-2 py-1 text-sm"
              type="number"
              value={maxBeats}
              onChange={e => setMaxBeats(Math.max(1, Number(e.target.value)))}
            />
            <label className="ml-4 flex items-center text-sm gap-2">
              <input
                type="checkbox"
                className="w-4 h-4 border-zinc-300 shadow-sm"
                checked={interceptEnabled}
                onChange={e => setInterceptEnabled(e.target.checked)}
                title="When enabled, beats become pending for manual approve/edit/reject"
              />
              <span className="text-zinc-700 font-medium">Intercept beats</span>
              {interceptEnabled && (
                <span className="ml-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 text-xs font-semibold">
                  ⏳ Intercepting
                </span>
              )}
            </label>
          </div>

          <div className="rounded-md border border-zinc-100 p-3 bg-zinc-50 mb-4">
            <div className="flex gap-2 items-center mb-2">
              {AGENTS.map((a, i) => (
                <div key={a.id} className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${a.color} ${
                      i === currentAgent ? 'ring-2 ring-offset-1 ring-sky-300' : ''
                    }`}
                  />
                  <div className="text-sm">
                    {a.name} <span className="text-xs text-zinc-400">— {a.role}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-sm text-zinc-600">
              Next transition options: {STATE_FLOW[state].join(', ')}
            </div>
          </div>

          <div>
            {/* Pending / interception UI */}
            {pendingBeat && (
              <div className="mb-3 rounded-md border border-amber-100 bg-amber-50 p-3">
                <div className="text-xs text-zinc-500 mb-2">
                  Pending · {pendingBeat.agent} ·{' '}
                  <span className="font-mono">{pendingBeat.state}</span>
                </div>
                <textarea
                  className="w-full rounded-md border p-2 text-sm"
                  rows={3}
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    className="rounded-md bg-emerald-600 px-3 py-1 text-white text-sm hover:bg-emerald-700"
                    onClick={() => approvePending()}
                  >
                    Approve
                  </button>
                  <button
                    className="rounded-md border px-3 py-1 text-sm hover:bg-zinc-50"
                    onClick={() => rejectPending()}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            <h4 className="text-sm font-medium mb-2">Story Beats</h4>
            <div className="max-h-56 overflow-auto rounded-md border bg-white p-2 text-sm space-y-3">
              {beats.length === 0 ? (
                <div className="text-zinc-400">
                  No beats yet — press Play or Step to begin the story.
                </div>
              ) : (
                <ol className="list-decimal pl-5">
                  {beats.map(b => (
                    <li key={b.step} className="mb-2">
                      <div className="text-xs text-zinc-500">
                        #{b.step} · {b.agent} · <span className="font-mono">{b.state}</span>
                      </div>
                      <div className="mt-1">{b.text}</div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-md border border-zinc-100 p-3 bg-white">
            <h5 className="text-sm font-medium mb-2">State machine & hints</h5>
            <div className="text-xs text-zinc-600 space-y-2">
              <div>setup → scene</div>
              <div>scene → conflict | scene</div>
              <div>conflict → climax | scene</div>
              <div>climax → resolution</div>
              <div>resolution → end | scene</div>
              <div>end → setup</div>
            </div>

            <div className="mt-4 text-sm">
              <div className="font-medium">Agent policies (prototype)</div>
              <div className="mt-2 text-xs text-zinc-500">
                Narrator nudges the story forward; Antagonist prefers conflict; Hero leans toward
                resolution.
              </div>
            </div>

            <div className="mt-4 text-sm text-zinc-500">
              Tip: increase <strong>Max beats</strong> to let agents improvise longer stories.
            </div>
          </div>
        </div>
      </div>

      {/* Blocking modal for pending beat (ensures visibility) */}
      {pendingBeat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-2xl text-zinc-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold">Pending beat — {pendingBeat.agent}</div>
                <div className="text-xs text-zinc-500 mt-1">
                  State: <span className="font-mono">{pendingBeat.state}</span>
                </div>
              </div>
              <div>
                <button
                  className="rounded-md border px-3 py-1 text-sm"
                  onClick={() => rejectPending()}
                >
                  Reject
                </button>
              </div>
            </div>

            <textarea
              ref={pendingRef}
              className="mt-4 w-full min-h-[120px] rounded-md border p-3 text-sm bg-white"
              value={editText}
              onChange={e => setEditText(e.target.value)}
            />

            <div className="mt-4 flex justify-end gap-3">
              <button
                className="rounded-md border px-3 py-1 text-sm"
                onClick={() => rejectPending()}
              >
                Reject
              </button>
              <button
                className="rounded-md bg-emerald-600 px-3 py-1 text-white text-sm hover:bg-emerald-700"
                onClick={() => approvePending()}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
