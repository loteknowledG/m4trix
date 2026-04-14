import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = (body?.text || '').toString().trim();

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    // Use the local voice profile helper copied from samus-manus.
    const runner = 'python';
    const scriptPath = 'tools/voice_profile.py';

    await execFileAsync(runner, [scriptPath, 'speak', 'jenny-neural', text], {
      cwd: process.cwd(),
      timeout: 60_000,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[tts] failed', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Unknown error' },
      { status: 500 }
    );
  }
}
