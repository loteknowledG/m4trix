'use client';

import { useState } from 'react';
import { SerializedEditorState } from 'lexical';

import AgenticStateMachine from '@/components/game/agentic-state-machine';
import AgenticStoryMachine, { StoryBeat } from '@/components/game/agentic-story-machine';
import { Editor } from '@/components/blocks/editor-00/editor';

const initialValue = {
  root: {
    children: [
      {
        children: [
          {
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text: 'Hello World 🚀',
            type: 'text',
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        type: 'paragraph',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
} as unknown as SerializedEditorState;

export default function EditorPage() {
  const [_editorState, setEditorState] = useState<SerializedEditorState>(initialValue);

  const [intercepted, setIntercepted] = useState<StoryBeat[]>([]);

  // Demo programmatic onBeforeBeat hook
  const [hookEnabled, setHookEnabled] = useState(false);
  const [hookLog, setHookLog] = useState<string[]>([]);

  async function onBeforeBeatDemo(beat: StoryBeat) {
    // simulate async work (LLM call / validation)
    await new Promise(r => setTimeout(r, 400));

    // reject clearly unsafe content
    if (beat.text.toLowerCase().includes('secret')) {
      setHookLog(l => [`Rejected beat #${beat.step} (contains 'secret')`, ...l]);
      return null;
    }

    // simple transformation: emphasize antagonist lines and append a note
    let modified = beat.text;
    if (modified.toLowerCase().includes('antagonist')) {
      modified = modified + ' — (tone: ominous)';
      setHookLog(l => [`Edited beat #${beat.step}: emphasized antagonist`, ...l]);
      return { ...beat, text: modified };
    }

    // small stylistic tweak for the hero
    if (modified.toLowerCase().includes('hero')) {
      modified = modified.replace(/the hero/gi, 'the young hero');
      setHookLog(l => [`Edited beat #${beat.step}: expanded 'hero'`, ...l]);
      return { ...beat, text: modified };
    }

    // otherwise, accept unchanged but log the pass
    setHookLog(l => [`Accepted beat #${beat.step}`, ...l]);
    return beat;
  }

  return (
    <div className="space-y-6">
      <AgenticStateMachine />
      <AgenticStoryMachine
        onBeforeBeat={hookEnabled ? onBeforeBeatDemo : undefined}
        onAfterBeat={b => setIntercepted(s => [b, ...s])}
      />

      <div className="rounded-lg border border-zinc-100 bg-white p-4 text-zinc-900">
        <h4 className="text-sm font-medium mb-2">Editor (kept for reference)</h4>
        <Editor onSerializedChange={value => setEditorState(value)} />
      </div>

      <div className="rounded-lg border border-zinc-100 bg-white p-4 text-zinc-900">
        <h4 className="text-sm font-medium mb-2">Intercepted beats (live)</h4>
        <div className="text-sm text-zinc-500 mb-2">
          Each committed beat triggers <code>onAfterBeat</code> — shown here.
        </div>

        <div className="mb-3 flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="w-4 h-4"
              checked={hookEnabled}
              onChange={e => setHookEnabled(e.target.checked)}
            />
            <span className="text-zinc-500">
              Enable programmatic <code>onBeforeBeat</code> hook
            </span>
          </label>
          <button className="rounded-md border px-3 py-1 text-sm" onClick={() => setHookLog([])}>
            Clear hook log
          </button>
        </div>

        <div className="max-h-40 overflow-auto text-sm">
          {intercepted.length === 0 ? (
            <div className="text-zinc-400">No intercepted beats yet.</div>
          ) : (
            <ol className="list-decimal pl-5 space-y-2">
              {intercepted.map(b => (
                <li key={b.step}>
                  <div className="text-xs text-zinc-500">
                    #{b.step} · {b.agent} · <span className="font-mono">{b.state}</span>
                  </div>
                  <div className="mt-1">{b.text}</div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="mt-4">
          <h5 className="text-sm font-medium mb-2">Hook activity (latest)</h5>
          <div className="max-h-32 overflow-auto rounded-md border bg-white p-2 text-sm text-zinc-500">
            {hookLog.length === 0 ? (
              <div className="text-zinc-400">No hook activity yet.</div>
            ) : (
              <ul className="list-disc pl-5 space-y-1">
                {hookLog.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
