import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  CONNECTION_STORAGE_KEYS as SESSION_KEYS,
  getConnectionItem,
  removeConnectionItem,
  setConnectionItem,
} from '@/lib/connection-storage';
import { DEFAULT_LMSTUDIO_URL, normalizeLmstudioUrl } from '@/lib/lmstudio';

export type Provider = 'zen' | 'google' | 'huggingface' | 'nvidia' | 'lmstudio';

export type ModelOption = {
  id: string;
  label: string;
  provider: Provider;
};

type UseCharacterConnectionsArgs = {
  model: string;
  setModel: (value: string) => void;
  activeProvider: Provider;
  setActiveProvider: (value: Provider) => void;
};

function mapModelOptions(rawModels: any[], provider: Provider): ModelOption[] {
  return rawModels
    .map((m: any) => {
      const id =
        (typeof m?.id === 'string' && m.id) ||
        (typeof m?.model_id === 'string' && m.model_id) ||
        (typeof m?.name === 'string' && m.name);
      if (!id) return null;
      const label =
        (typeof m?.display_name === 'string' && m.display_name) ||
        (typeof m?.name === 'string' && m.name) ||
        id;
      return { id, label, provider };
    })
    .filter((m): m is ModelOption => Boolean(m));
}

function providerLabel(provider: Provider) {
  switch (provider) {
    case 'zen':
      return 'OpenCode';
    case 'google':
      return 'Google Gemini';
    case 'huggingface':
      return 'Hugging Face';
    case 'nvidia':
      return 'NVIDIA';
    case 'lmstudio':
      return 'LM Studio';
    default:
      return provider;
  }
}

export function useCharacterConnections({
  model,
  setModel,
  activeProvider,
  setActiveProvider,
}: UseCharacterConnectionsArgs) {
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [zenApiKey, setZenApiKey] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [hfApiKey, setHfApiKey] = useState('');
  const [nvidiaApiKey, setNvidiaApiKey] = useState('');
  const [lmstudioUrl, setLmstudioUrl] = useState(DEFAULT_LMSTUDIO_URL);
  const [lmstudioConnected, setLmstudioConnected] = useState(false);
  const [zenConnected, setZenConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [hfConnected, setHfConnected] = useState(false);
  const [nvidiaConnected, setNvidiaConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const hasKeyForActiveProvider =
    (activeProvider === 'zen'
      ? zenApiKey
      : activeProvider === 'google'
      ? googleApiKey
      : activeProvider === 'nvidia'
      ? nvidiaApiKey
      : activeProvider === 'lmstudio'
      ? normalizeLmstudioUrl(lmstudioUrl)
      : hfApiKey || ''
    ).trim().length > 0;

  const activeProviderConnected =
    activeProvider === 'zen'
      ? zenConnected
      : activeProvider === 'google'
      ? googleConnected
      : activeProvider === 'nvidia'
      ? nvidiaConnected
      : activeProvider === 'lmstudio'
      ? lmstudioConnected
      : hfConnected;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedModel = getConnectionItem(SESSION_KEYS.activeModel);
    const storedProvider = getConnectionItem(SESSION_KEYS.activeProvider) as
      | Provider
      | null;
    const storedModelProvider = getConnectionItem(SESSION_KEYS.activeModelProvider) as
      | Provider
      | null;
    const storedZen = getConnectionItem(SESSION_KEYS.zenKey);
    const storedGoogle = getConnectionItem(SESSION_KEYS.googleKey);
    const storedHf = getConnectionItem(SESSION_KEYS.hfKey);
    const storedNvidia = getConnectionItem(SESSION_KEYS.nvidiaKey);
    const storedLmstudioUrl = getConnectionItem(SESSION_KEYS.lmstudioUrl);
    const storedLmstudioConnected = getConnectionItem(SESSION_KEYS.lmstudioConnected);

    if (storedModel) setModel(storedModel);
    if (storedModelProvider) setActiveProvider(storedModelProvider);
    else if (storedProvider) setActiveProvider(storedProvider);
    if (storedZen) setZenApiKey(storedZen);
    if (storedGoogle) setGoogleApiKey(storedGoogle);
    if (storedHf) setHfApiKey(storedHf);
    if (storedNvidia) setNvidiaApiKey(storedNvidia);
    if (storedLmstudioUrl) setLmstudioUrl(normalizeLmstudioUrl(storedLmstudioUrl));
    if (storedLmstudioConnected === '1') setLmstudioConnected(true);

    hasLoadedRef.current = true;

    if (storedZen) void validateAndFetchModels('zen', storedZen);
    if (storedGoogle) void validateAndFetchModels('google', storedGoogle);
    if (storedHf) void validateAndFetchModels('huggingface', storedHf);
    if (storedNvidia) void validateAndFetchModels('nvidia', storedNvidia);
    if (storedLmstudioUrl || storedLmstudioConnected === '1') {
      void validateAndFetchModels('lmstudio', '', storedLmstudioUrl || DEFAULT_LMSTUDIO_URL);
    }
  }, [setActiveProvider, setModel]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasLoadedRef.current) return;

    if (zenApiKey) setConnectionItem(SESSION_KEYS.zenKey, zenApiKey);
    else removeConnectionItem(SESSION_KEYS.zenKey);

    if (googleApiKey) setConnectionItem(SESSION_KEYS.googleKey, googleApiKey);
    else removeConnectionItem(SESSION_KEYS.googleKey);

    if (hfApiKey) setConnectionItem(SESSION_KEYS.hfKey, hfApiKey);
    else removeConnectionItem(SESSION_KEYS.hfKey);

    if (nvidiaApiKey) setConnectionItem(SESSION_KEYS.nvidiaKey, nvidiaApiKey);
    else removeConnectionItem(SESSION_KEYS.nvidiaKey);

    if (model) setConnectionItem(SESSION_KEYS.activeModel, model);
    else removeConnectionItem(SESSION_KEYS.activeModel);

    const selectedModel = modelOptions.find(option => option.id === model);
    if (selectedModel) setConnectionItem(SESSION_KEYS.activeModelProvider, selectedModel.provider);
    else removeConnectionItem(SESSION_KEYS.activeModelProvider);

    setConnectionItem(SESSION_KEYS.activeProvider, activeProvider);

    if (lmstudioConnected) setConnectionItem(SESSION_KEYS.lmstudioConnected, '1');
    else removeConnectionItem(SESSION_KEYS.lmstudioConnected);

    if (lmstudioUrl.trim()) {
      setConnectionItem(SESSION_KEYS.lmstudioUrl, normalizeLmstudioUrl(lmstudioUrl));
    } else {
      removeConnectionItem(SESSION_KEYS.lmstudioUrl);
    }
  }, [
    activeProvider,
    googleApiKey,
    hfApiKey,
    isConnecting,
    lmstudioConnected,
    lmstudioUrl,
    model,
    nvidiaApiKey,
    zenApiKey,
  ]);

  useEffect(() => {
    if (!modelOptions.length) return;

    const validModels = modelOptions.filter(option => option.provider === activeProvider);
    if (validModels.length === 0) {
      setModel('');
      return;
    }

    if (!validModels.some(option => option.id === model)) {
      setModel(validModels[0]!.id);
    }
  }, [activeProvider, model, modelOptions, setModel]);

  useEffect(() => {
    const selectedModel = modelOptions.find(option => option.id === model);
    if (selectedModel && selectedModel.provider !== activeProvider) {
      setActiveProvider(selectedModel.provider);
    }
  }, [activeProvider, model, modelOptions, setActiveProvider]);

  async function validateAndFetchModels(
    provider: Provider,
    keyToUse: string,
    lmstudioUrlOverride?: string
  ) {
    const trimmedKey = keyToUse.trim();
    if (provider !== 'lmstudio' && !trimmedKey) return;

    setConnectionError(null);
    setIsConnecting(true);

    try {
      if (provider === 'lmstudio') {
        const urlParam = encodeURIComponent(
          normalizeLmstudioUrl(lmstudioUrlOverride || lmstudioUrl || DEFAULT_LMSTUDIO_URL)
        );
        const res = await fetch(`/api/models?provider=lmstudio&lmstudio_url=${urlParam}`);
        if (!res.ok) throw new Error('Failed to fetch LM Studio models');

        const payload = (await res.json().catch(() => null)) as any;
        const rawModels: any[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.models)
          ? payload.models
          : [];

        const options = mapModelOptions(rawModels, provider);
        setModelOptions(prev => [...prev.filter(option => option.provider !== provider), ...options]);
        setLmstudioConnected(true);
        setActiveProvider('lmstudio');
        if (options.length && (!model || activeProvider === provider)) {
          setModel(options[0]!.id);
        }
        toast.success(
          `${providerLabel(provider)} connected — ${options.length} model${
            options.length === 1 ? '' : 's'
          } loaded`
        );
        return;
      }

      const headers: Record<string, string> = {};
      if (provider === 'zen') headers['x-zen-api-key'] = trimmedKey;
      else if (provider === 'google') headers['x-google-api-key'] = trimmedKey;
      else if (provider === 'nvidia') headers['x-nvidia-api-key'] = trimmedKey;
      else headers['x-hf-api-key'] = trimmedKey;

      const res = await fetch('/api/models', {
        method: 'GET',
        headers,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to validate key (status ${res.status})`);
      }

      const payload = (await res.json().catch(() => null)) as any;
      const rawModels: any[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.models)
        ? payload.models
        : [];

      const options = mapModelOptions(rawModels, provider);
      setModelOptions(prev => [...prev.filter(option => option.provider !== provider), ...options]);
      if (options.length && (!model || activeProvider === provider)) {
        setModel(options[0]!.id);
      }

      if (provider === 'zen') setZenConnected(true);
      else if (provider === 'google') setGoogleConnected(true);
      else if (provider === 'nvidia') setNvidiaConnected(true);
      else setHfConnected(true);

      toast.success(
        `${providerLabel(provider)} connected — ${options.length} model${
          options.length === 1 ? '' : 's'
        } loaded`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to validate ${provider}.`;
      setConnectionError(message);
      toast.error(message);
      if (provider === 'zen') setZenConnected(false);
      else if (provider === 'google') setGoogleConnected(false);
      else if (provider === 'nvidia') setNvidiaConnected(false);
      else if (provider === 'huggingface') setHfConnected(false);
      else if (provider === 'lmstudio') setLmstudioConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }

  async function connectWithKey(event?: React.FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();

    const validModels = modelOptions.filter(option => option.provider === activeProvider);
    if (validModels.length && !validModels.some(option => option.id === model)) {
      setModel(validModels[0]!.id);
      setTimeout(() => {
        void connectWithKey(event);
      }, 0);
      return;
    }

    if (activeProvider === 'lmstudio') {
      await validateAndFetchModels('lmstudio', '');
      return;
    }

    const key =
      activeProvider === 'zen'
        ? zenApiKey
        : activeProvider === 'google'
        ? googleApiKey
        : activeProvider === 'nvidia'
        ? nvidiaApiKey
        : hfApiKey;

    await validateAndFetchModels(activeProvider, key);
  }

  return {
    activeProviderConnected,
    connectWithKey,
    connectionError,
    googleApiKey,
    googleConnected,
    hasKeyForActiveProvider,
    hfApiKey,
    hfConnected,
    isConnecting,
    lmstudioConnected,
    lmstudioUrl,
    modelOptions,
    nvidiaApiKey,
    nvidiaConnected,
    setGoogleConnected,
    setGoogleApiKey,
    setHfConnected,
    setHfApiKey,
    setIsConnecting,
    setLmstudioConnected,
    setLmstudioUrl,
    setModelOptions,
    setNvidiaConnected,
    setNvidiaApiKey,
    setZenConnected,
    setZenApiKey,
    validateAndFetchModels,
    zenApiKey,
    zenConnected,
  };
}
