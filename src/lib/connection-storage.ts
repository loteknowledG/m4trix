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
  return [window.sessionStorage, window.localStorage] as const;
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

const PERSIST_KEYS: Record<string, true> = {
  [CONNECTION_STORAGE_KEYS.activeModel]: true,
  [CONNECTION_STORAGE_KEYS.activeModelProvider]: true,
  [CONNECTION_STORAGE_KEYS.activeProvider]: true,
  [CONNECTION_STORAGE_KEYS.googleKey]: true,
  [CONNECTION_STORAGE_KEYS.hfKey]: true,
  [CONNECTION_STORAGE_KEYS.lmstudioUrl]: true,
  [CONNECTION_STORAGE_KEYS.nvidiaKey]: true,
  [CONNECTION_STORAGE_KEYS.zenKey]: true,
  [CONNECTION_STORAGE_KEYS.gameConnectionModel]: true,
};

export function setConnectionItem(key: string, value: string) {
  const stores = getStores();
  if (!stores) return;

  const useLocal = PERSIST_KEYS[key] === true;
  if (useLocal) {
    window.localStorage.setItem(key, value);
    window.sessionStorage.removeItem(key);
  } else {
    window.sessionStorage.setItem(key, value);
    if (key !== CONNECTION_STORAGE_KEYS.lmstudioConnected) {
      window.localStorage.removeItem(key);
    }
  }
}

export function removeConnectionItem(key: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
  window.sessionStorage.removeItem(key);
}