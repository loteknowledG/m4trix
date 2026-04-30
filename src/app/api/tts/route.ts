import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

const DEFAULT_VOICE_PROFILE = 'jeeny-neural';

export const dynamic = 'force-static';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = (body?.text || '').toString().trim();
    const voiceProfile = (body?.profile || DEFAULT_VOICE_PROFILE).toString().trim();

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    // Use the local voice profile helper copied from samus-manus.
    const runner = 'python';
    const scriptPath = 'tools/voice_profile.py';

    const child = spawn(runner, [scriptPath, 'speak', voiceProfile || DEFAULT_VOICE_PROFILE, text], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });

    child.unref();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[tts] failed', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Unknown error' },
      { status: 500 }
    );
  }
}
