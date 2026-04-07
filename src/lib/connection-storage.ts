'use client';

export const CONNECTION_STORAGE_KEYS = {
  activeModel: 'ACTIVE_MODEL_SESSION',
  activeModelProvider: 'ACTIVE_MODEL_PROVIDER_SESSION',
  activeProvider: 'ACTIVE_PROVIDER_SESSION',
  googleKey: 'GOOGLE_API_KEY_SESSION',
  hfKey: 'HF_API_KEY_SESSION',
  lmstudioConnected: 'LMSTUDIO_CONNECTED',
  lmstudioUrl: 'LMSTUDIO_URL_SESSION',
  nvidiaKey: 'NVIDIA_API_KEY_SESSION',
  zenKey: 'ZEN_API_KEY_SESSION',
  gameConnectionModel: 'game-connection-model',
} as const;

function getStores() {
  if (typeof window === 'undefined') return null;
  return [window.localStorage, window.sessionStorage] as const;
}

export function getConnectionItem(key: string) {
  const stores = getStores();
  if (!stores) return null;

  for (const store of stores) {
    const value = store.getItem(key);
    if (value !== null) return value;
  }

  return null;
}

export function setConnectionItem(key: string, value: string) {
  const stores = getStores();
  if (!stores) return;

  for (const store of stores) {
    store.setItem(key, value);
  }
}

export function removeConnectionItem(key: string) {
  const stores = getStores();
  if (!stores) return;

  for (const store of stores) {
    store.removeItem(key);
  }
}
