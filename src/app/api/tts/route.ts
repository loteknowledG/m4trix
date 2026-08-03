export const dynamic = "force-dynamic";
import { spawn } from 'child_process';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';

function spawnVoiceProfileRender(profile: string, text: string) {
  const runner = process.platform === 'win32' ? 'py' : 'python3';
  const scriptPath = path.join(process.cwd(), 'tools', 'voice_profile.py');
  return new Promise<{ ok: boolean; audioBase64?: string; error?: string }>((resolve) => {
    const child = spawn(runner, [scriptPath, 'render', profile], {
      cwd: process.cwd(),
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => resolve({ ok: false, error: error.message }));
    child.on('close', (code) => {
      const audioBase64 = stdout.trim();
      resolve(
        code === 0 && audioBase64
          ? { ok: true, audioBase64 }
          : { ok: false, error: stderr.trim() || `exit ${code ?? 'unknown'}` },
      );
    });
    child.stdin.write(text);
    child.stdin.end();
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = String(body?.text || '').trim();
    const profileRaw = String(body?.profile || body?.profileId || 'jenny-neural').trim().toLowerCase();
    const voiceProfile = profileRaw === 'jenny' ? 'jenny-neural' : profileRaw || 'jenny-neural';

    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

    const result = await spawnVoiceProfileRender(voiceProfile, text);
    if (!result.ok || !result.audioBase64) {
      return NextResponse.json(
        { ok: false, error: 'VOICE_PROFILE_FAILED', detail: result.error || 'No audio returned' },
        { status: 200 },
      );
    }

    return NextResponse.json({
      ok: true,
      provider: 'voice-profile',
      profile: voiceProfile,
      audioBase64: result.audioBase64,
      contentType: 'audio/mpeg',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[tts] failed', error);
    return NextResponse.json(
      { ok: false, error: 'TTS_FAILED', detail: message },
      { status: 200 },
    );
  }
}
