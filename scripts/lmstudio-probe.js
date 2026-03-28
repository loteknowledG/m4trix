#!/usr/bin/env node

const DEFAULT_BASE_URL = process.env.LMSTUDIO_URL || 'http://192.168.12.48:1234';
const baseUrl = (process.argv[2] || DEFAULT_BASE_URL).replace(/\/$/, '');
const prompt = process.argv[3] || 'Hello';

async function main() {
  const modelsUrl = `${baseUrl}/v1/models`;
  const modelsRes = await fetch(modelsUrl, { method: 'GET' });
  const modelsText = await modelsRes.text();

  console.log(`[lmstudio-probe] GET ${modelsUrl}`);
  console.log(`[lmstudio-probe] status: ${modelsRes.status} ${modelsRes.statusText}`);

  let modelId = '';
  try {
    const modelsJson = JSON.parse(modelsText);
    const rawModels = Array.isArray(modelsJson)
      ? modelsJson
      : Array.isArray(modelsJson?.data)
      ? modelsJson.data
      : Array.isArray(modelsJson?.models)
      ? modelsJson.models
      : [];

    const first = rawModels.find(m => m && (m.id || m.model_id || m.name));
    modelId = first?.id || first?.model_id || first?.name || '';

    console.log(
      '[lmstudio-probe] models:',
      rawModels.map(m => m?.id || m?.model_id || m?.name).filter(Boolean)
    );
  } catch {
    console.log('[lmstudio-probe] models response (raw):');
    console.log(modelsText);
  }

  if (!modelsRes.ok) {
    process.exitCode = 1;
    return;
  }

  if (!modelId) {
    console.log('[lmstudio-probe] No model id found, skipping chat probe.');
    return;
  }

  const chatUrl = `${baseUrl}/v1/chat/completions`;
  const chatRes = await fetch(chatUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 64,
      temperature: 0.2,
    }),
  });
  const chatText = await chatRes.text();

  console.log(`[lmstudio-probe] POST ${chatUrl}`);
  console.log(`[lmstudio-probe] status: ${chatRes.status} ${chatRes.statusText}`);

  try {
    const chatJson = JSON.parse(chatText);
    const content = chatJson?.choices?.[0]?.message?.content;
    console.log('[lmstudio-probe] chat content:');
    console.log(typeof content === 'string' ? content : JSON.stringify(chatJson, null, 2));
  } catch {
    console.log('[lmstudio-probe] chat response (raw):');
    console.log(chatText);
  }

  if (!chatRes.ok) {
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('[lmstudio-probe] failed:', err?.message || String(err));
  process.exitCode = 1;
});
