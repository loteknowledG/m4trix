import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

const DEFAULT_CODEROBO_API_URL = 'https://tts-api.coderobo.org';
const DEFAULT_CODEROBO_JWT =
  'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiZGVmYXVsdF93ZWJfY2xpZW50IiwgInJvbGUiOiAidXNlciJ9.eSHTiqjO5QItqrB7UCKbW2zrYW5AFoFTwYMQ8gJa4AY';
const DEFAULT_LANGUAGE = 'en-US';
const DEFAULT_VOICE = 'JennyNeural';
const REQUEST_TIMEOUT_MS = 120_000;

function getCoderoboApiUrl() {
  const raw = (process.env.CODEROBO_TTS_API_URL || DEFAULT_CODEROBO_API_URL).trim();
  try {
    const url = new URL(raw);
    // Allow users to paste UI pages like /new-tts.html, but always call API endpoints from origin.
    return url.origin.replace(/\/$/, '');
  } catch {
    return raw.replace(/\/$/, '');
  }
}

function getCoderoboJwt() {
  return process.env.CODEROBO_TTS_JWT || DEFAULT_CODEROBO_JWT;
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const realIp = request.headers.get('x-real-ip') || '';
  const ip = forwardedFor.split(',')[0]?.trim() || realIp.trim();
  return ip || 'unknown';
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as any;
  } catch {
    return { detail: text || 'Invalid JSON response' };
  }
}

function normalizeAudioUrl(apiUrl: string, audioUrl: string) {
  if (!audioUrl) return '';
  if (/^https?:\/\//i.test(audioUrl)) return audioUrl;
  return `${apiUrl}${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`;
}

async function pollCoderoboAudioUrl(apiUrl: string, taskId: string, jwtToken: string) {
  const startedAt = Date.now();
  let status: string | null = null;

  while (Date.now() - startedAt < REQUEST_TIMEOUT_MS) {
    const taskResponse = await fetch(`${apiUrl}/task-status/${taskId}`, {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
      cache: 'no-store',
    });

    if (!taskResponse.ok) {
      if (taskResponse.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 4000));
        continue;
      }
      const taskError = await readJson(taskResponse);
      throw new Error(taskError.detail || `Task status request failed with status ${taskResponse.status}`);
    }

    const taskData = await readJson(taskResponse);
    status = taskData.status ?? null;

    if (status === 'completed') {
      const statusResponse = await fetch(`${apiUrl}/status/${taskId}`, {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
        cache: 'no-store',
      });

      if (!statusResponse.ok) {
        const statusError = await readJson(statusResponse);
        throw new Error(
          statusError.detail || `Status request failed with status ${statusResponse.status}`,
        );
      }

      const statusData = await readJson(statusResponse);
      const audioUrl = normalizeAudioUrl(apiUrl, statusData.audio_url || '');
      if (!audioUrl) {
        throw new Error('Task completed but no audio URL was returned');
      }
      return audioUrl;
    }

    if (status === 'failed' || status === 'cancelled' || status === 'expired') {
      const statusResponse = await fetch(`${apiUrl}/status/${taskId}`, {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
        cache: 'no-store',
      });

      if (statusResponse.ok) {
        const statusData = await readJson(statusResponse);
        throw new Error(statusData.message || `Task ${status}`);
      }

      throw new Error(`Task ${status}`);
    }

    const delay = status === 'queued' ? 4000 : 2000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error(`Timed out waiting for Coderobo TTS task ${taskId}`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = (body?.text || '').toString().trim();
    const profile = (body?.profile || '').toString().trim().toLowerCase();

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    if (profile === 'muthur' || profile === 'jenny-neural' || profile === 'jenny') {
      const voiceProfile = profile === 'jenny' ? 'jenny-neural' : profile;
      const runner = process.platform === 'win32' ? 'py' : 'python3';
      const scriptPath = 'tools/voice_profile.py';
      const args = [scriptPath, 'speak', voiceProfile, text];

      const result = await new Promise<{ ok: boolean; stderr: string; code: number | null }>((resolve) => {
        const child = spawn(runner, args, {
          cwd: process.cwd(),
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stderr = '';
        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });
        child.on('error', (err) => {
          resolve({ ok: false, stderr: err.message, code: -1 });
        });
        child.on('close', (code) => {
          resolve({ ok: code === 0, stderr, code });
        });
      });

      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: 'VOICE_PROFILE_FAILED', detail: result.stderr || `exit ${result.code}` },
          { status: 200 }
        );
      }

      return NextResponse.json({ ok: true, provider: 'voice-profile', profile: voiceProfile });
    }

    const apiUrl = getCoderoboApiUrl();
    const jwtToken = getCoderoboJwt();
    const language = (body?.language || DEFAULT_LANGUAGE).toString().trim() || DEFAULT_LANGUAGE;
    const voice = (body?.voice || DEFAULT_VOICE).toString().trim() || DEFAULT_VOICE;
    const rate = (body?.rate ?? '0').toString();
    const pitch = (body?.pitch ?? '0').toString();
    const userIp = (body?.user_ip || getClientIp(request)).toString().trim() || 'unknown';

    const formData = new FormData();
    formData.append('text', text);
    formData.append('language', language);
    formData.append('voice', voice);
    formData.append('rate', rate);
    formData.append('pitch', pitch);
    formData.append('user_ip', userIp);

    const candidateApiUrls = Array.from(new Set([apiUrl, 'https://tts-api.coderobo.org']));
    let submitData: any = null;
    let submitErrorMessage = '';
    let selectedApiUrl = apiUrl;

    for (const candidateApiUrl of candidateApiUrls) {
      const submitResponse = await fetch(`${candidateApiUrl}/tts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
        body: formData,
        cache: 'no-store',
      });

      if (submitResponse.ok) {
        submitData = await readJson(submitResponse);
        selectedApiUrl = candidateApiUrl;
        break;
      }

      const submitError = await readJson(submitResponse);
      submitErrorMessage =
        submitError?.detail ||
        submitError?.error ||
        `TTS request failed with status ${submitResponse.status}`;
    }

    if (!submitData) {
      throw new Error(submitErrorMessage || 'TTS request failed on all configured endpoints');
    }

    const taskId = submitData.task_id;
    if (!taskId) {
      throw new Error('TTS API did not return a task_id');
    }

    const audioUrl = await pollCoderoboAudioUrl(selectedApiUrl, taskId, jwtToken);
    return NextResponse.json({
      ok: true,
      audioUrl,
      taskId,
      provider: 'coderobo',
    });
  } catch (error) {
    console.error('[tts] failed', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Unknown error' },
      { status: 500 }
    );
  }
}
