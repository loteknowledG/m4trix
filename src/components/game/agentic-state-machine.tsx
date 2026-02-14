'use client';

import { useEffect, useRef, useState } from 'react';

type StateId = 'idle' | 'exploring' | 'decision' | 'completed';

type Agent = {
  id: string;
  name: string;
  color: string;
};

type LogEntry = {
  step: number;
  agent: string;
  action: string;
  from: StateId;
  to: StateId;
};

const AGENTS: Agent[] = [
  { id: 'scout', name: 'Scout', color: 'bg-sky-500' },
  { id: 'planner', name: 'Planner', color: 'bg-emerald-500' },
  { id: 'critic', name: 'Critic', color: 'bg-rose-500' },
];

const TRANSITIONS: Record<StateId, { action: string; to: StateId }[]> = {
  idle: [
    { action: 'start_explore', to: 'exploring' },
    { action: 'skip', to: 'completed' },
  ],
  exploring: [
    { action: 'gather_info', to: 'exploring' },
    { action: 'move_to_decision', to: 'decision' },
  ],
  decision: [
    { action: 'propose_solution', to: 'completed' },
    { action: 'request_more_info', to: 'exploring' },
  ],
  completed: [{ action: 'reset', to: 'idle' }],
};

function pickTransition(state: StateId, rnd: () => number) {
  const options = TRANSITIONS[state];
  // simple random pick (can be replaced by agent policy)
  return options[Math.floor(rnd() * options.length)];
}

export default function AgenticStateMachine() {
  const [state, setState] = useState<StateId>('idle');
  const [running, setRunning] = useState(false);
  const [stepCount, setStepCount] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [currentAgent, setCurrentAgent] = useState(0);
  const rng = useRef(() => Math.random());
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = window.setInterval(() => runStep(), 800);
      return () => {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      };
    }
  }, [running, state, currentAgent]);

  function applyTransition(agent: Agent, action: string, from: StateId, to: StateId) {
    setState(to);
    setStepCount(s => s + 1);
    setLog(l => [{ step: stepCount + 1, agent: agent.name, action, from, to }, ...l]);
    setCurrentAgent(i => (i + 1) % AGENTS.length);
  }

  function runStep() {
    const agent = AGENTS[currentAgent];
    const trans = pickTransition(state, rng.current);
    applyTransition(agent, trans.action, state, trans.to);
  }

  function manualAction(action: string, to: StateId) {
    const agent = AGENTS[currentAgent];
    applyTransition(agent, action, state, to);
  }

  function reset() {
    setRunning(false);
    setState('idle');
    setStepCount(0);
    setLog([]);
    setCurrentAgent(0);
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white/50 p-6 shadow-sm text-zinc-900">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Agentic State Machine (prototype)</h3>
          <p className="text-sm text-zinc-500">
            Multiple agents take turns driving state transitions.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="text-sm text-zinc-600">State</div>
          <div className="px-3 py-1 rounded-md bg-zinc-100 font-mono text-sm">{state}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2">
          <div className="flex gap-3 mb-3">
            <button
              className="rounded-md bg-sky-600 px-3 py-1 text-white text-sm hover:bg-sky-700"
              onClick={() => setRunning(r => !r)}
            >
              {running ? 'Pause' : 'Start'}
            </button>
            <button
              className="rounded-md border px-3 py-1 text-sm hover:bg-zinc-50"
              onClick={() => runStep()}
            >
              Step
            </button>
            <button
              className="rounded-md border px-3 py-1 text-sm hover:bg-zinc-50"
              onClick={() => reset()}
            >
              Reset
            </button>
            <div className="ml-3 text-sm text-zinc-500">Steps: {stepCount}</div>
          </div>

          <div className="rounded-md border border-zinc-100 p-3 bg-zinc-50">
            <div className="flex gap-2 items-center mb-2">
              {AGENTS.map((a, i) => (
                <div key={a.id} className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${a.color} ${
                      i === currentAgent ? 'ring-2 ring-offset-1 ring-sky-300' : ''
                    }`}
                  />
                  <div className="text-sm">{a.name}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {TRANSITIONS[state].map(t => (
                <button
                  key={t.action}
                  className="text-sm rounded-md border px-2 py-1 hover:bg-white"
                  onClick={() => manualAction(t.action, t.to)}
                >
                  {t.action} → {t.to}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Trace / Log</h4>
            <div className="max-h-40 overflow-auto rounded-md border bg-white p-2 text-sm">
              {log.length === 0 ? (
                <div className="text-zinc-400">No actions yet — press Start or Step.</div>
              ) : (
                <ul className="space-y-2">
                  {log.map(e => (
                    <li key={e.step} className="flex justify-between items-center gap-2">
                      <div>
                        <span className="font-mono text-xs text-zinc-500">#{e.step}</span>{' '}
                        <strong>{e.agent}</strong> <span className="text-zinc-600">{e.action}</span>
                        <span className="text-zinc-400">
                          {' '}
                          — {e.from} → {e.to}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-md border border-zinc-100 p-3 bg-white">
            <h5 className="text-sm font-medium mb-2">State Machine</h5>
            <div className="text-xs text-zinc-600 space-y-2">
              <div>idle → exploring : start_explore</div>
              <div>exploring → decision : move_to_decision</div>
              <div>decision → completed : propose_solution</div>
              <div>decision → exploring : request_more_info</div>
              <div>completed → idle : reset</div>
            </div>

            <div className="mt-4 text-sm">
              <div className="font-medium">Current driver</div>
              <div className="mt-2">
                <div className="flex gap-2 items-center">
                  <div className={`w-3 h-3 rounded-full ${AGENTS[currentAgent].color}`} />
                  <div className="text-sm">{AGENTS[currentAgent].name}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 text-sm text-zinc-500">
              Tip: use <strong>Step</strong> to observe agent decisions, or click transition buttons
              to override.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
