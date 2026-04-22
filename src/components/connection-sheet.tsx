'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plug } from '@/components/icons';
import { VscDebugDisconnect } from 'react-icons/vsc';
import { PiPlugsConnectedLight } from 'react-icons/pi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  CONNECTION_STORAGE_KEYS,
  getConnectionItem,
  removeConnectionItem,
  setConnectionItem,
} from '@/lib/connection-storage';
import { cn } from '@/lib/utils';
import { DEFAULT_LMSTUDIO_URL, normalizeLmstudioUrl } from '@/lib/lmstudio';

type Provider = 'zen' | 'google' | 'huggingface' | 'nvidia' | 'lmstudio';

export interface ConnectionSheetProps {
  /** Side to open the sheet from */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Optional class applied to the trigger button */
  triggerClassName?: string;
}

export function ConnectionSheet({ side = 'top', triggerClassName }: ConnectionSheetProps) {
  const [open, setOpen] = useState(false);
  const [didExplicitlySelectModel, setDidExplicitlySelectModel] = useState(false);
  const [activeProvider, setActiveProvider] = useState<Provider>('zen');
  const [lmstudioUrl, setLmstudioUrl] = useState('');
  const [lmstudioConnected, setLmstudioConnected] = useState(false);
  const [lmstudioHealth, setLmstudioHealth] = useState<{
    state: 'idle' | 'checking' | 'healthy' | 'error';
    message?: string;
    modelCount?: number;
  }>({ state: 'idle' });
  const [zenApiKey, setZenApiKey] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [hfApiKey, setHfApiKey] = useState('');
  const [nvidiaApiKey, setNvidiaApiKey] = useState('');
  const [zenConnected, setZenConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [hfConnected, setHfConnected] = useState(false);
  const [nvidiaConnected, setNvidiaConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [model, setModel] = useState('');
  const [modelOptions, setModelOptions] = useState<
    Array<{ id: string; label: string; provider: Provider }>
  >([]);

  const connected =
    zenConnected || googleConnected || hfConnected || nvidiaConnected || lmstudioConnected;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('connections:update', {
        detail: { connected, model },
      })
    );
  }, [connected, model]);

  const hasKeyForActiveProvider =
    (activeProvider === 'zen'
      ? zenApiKey
      : activeProvider === 'google'
      ? googleApiKey
      : activeProvider === 'nvidia'
      ? nvidiaApiKey
      : activeProvider === 'lmstudio'
      ? 'local' // LM Studio does not require a key
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

  const validModelsForActiveProvider = modelOptions.filter((option) => option.provider === activeProvider);
  const hasValidSelectedModel = validModelsForActiveProvider.some((option) => option.id === model);

  const probeLmstudioHealth = async (urlOverride?: string) => {
    const targetUrl = normalizeLmstudioUrl(urlOverride || lmstudioUrl || DEFAULT_LMSTUDIO_URL);
    setLmstudioHealth({ state: 'checking' });

    try {
      const res = await fetch(`/api/lmstudio/health?lmstudio_url=${encodeURIComponent(targetUrl)}`);
      const payload = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; modelCount?: number }
        | null;

      if (!res.ok || !payload?.ok) {
        setLmstudioHealth({
          state: 'error',
          message: payload?.error || `Unable to reach ${targetUrl}`,
        });
        return;
      }

      setLmstudioHealth({
        state: 'healthy',
        modelCount: payload.modelCount ?? 0,
      });
    } catch (err) {
      setLmstudioHealth({
        state: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const storeSession = () => {
    if (typeof window === 'undefined') return;
    if (zenApiKey) setConnectionItem(CONNECTION_STORAGE_KEYS.zenKey, zenApiKey);
    else removeConnectionItem(CONNECTION_STORAGE_KEYS.zenKey);

    if (googleApiKey) setConnectionItem(CONNECTION_STORAGE_KEYS.googleKey, googleApiKey);
    else removeConnectionItem(CONNECTION_STORAGE_KEYS.googleKey);

    if (hfApiKey) setConnectionItem(CONNECTION_STORAGE_KEYS.hfKey, hfApiKey);
    else removeConnectionItem(CONNECTION_STORAGE_KEYS.hfKey);

    if (nvidiaApiKey) setConnectionItem(CONNECTION_STORAGE_KEYS.nvidiaKey, nvidiaApiKey);
    else removeConnectionItem(CONNECTION_STORAGE_KEYS.nvidiaKey);

    if (model) setConnectionItem(CONNECTION_STORAGE_KEYS.activeModel, model);
    else removeConnectionItem(CONNECTION_STORAGE_KEYS.activeModel);

    const selectedModel = modelOptions.find((option) => option.id === model);
    if (selectedModel) {
      setConnectionItem(CONNECTION_STORAGE_KEYS.activeModelProvider, selectedModel.provider);
    } else {
      removeConnectionItem(CONNECTION_STORAGE_KEYS.activeModelProvider);
    }

    setConnectionItem(CONNECTION_STORAGE_KEYS.activeProvider, activeProvider);
    setConnectionItem(CONNECTION_STORAGE_KEYS.lmstudioConnected, lmstudioConnected ? '1' : '');
    if (lmstudioUrl.trim()) {
      setConnectionItem(CONNECTION_STORAGE_KEYS.lmstudioUrl, normalizeLmstudioUrl(lmstudioUrl));
    } else {
      removeConnectionItem(CONNECTION_STORAGE_KEYS.lmstudioUrl);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedZen = getConnectionItem(CONNECTION_STORAGE_KEYS.zenKey);
    const storedGoogle = getConnectionItem(CONNECTION_STORAGE_KEYS.googleKey);
    const storedHf = getConnectionItem(CONNECTION_STORAGE_KEYS.hfKey);
    const storedNvidia = getConnectionItem(CONNECTION_STORAGE_KEYS.nvidiaKey);
    const storedProvider = getConnectionItem(CONNECTION_STORAGE_KEYS.activeProvider) as Provider | null;
    const storedModelProvider = getConnectionItem(CONNECTION_STORAGE_KEYS.activeModelProvider) as Provider | null;
    const storedLmstudio = getConnectionItem(CONNECTION_STORAGE_KEYS.lmstudioConnected);
    const storedLmstudioUrl = getConnectionItem(CONNECTION_STORAGE_KEYS.lmstudioUrl);

    const storedModel = getConnectionItem(CONNECTION_STORAGE_KEYS.activeModel);
    if (storedModel) setModel(storedModel);
    if (storedModelProvider) setActiveProvider(storedModelProvider);
    else if (storedLmstudio === '1' && storedModel) setActiveProvider('lmstudio');
    else if (storedProvider) setActiveProvider(storedProvider);
    if (storedLmstudio === '1') setLmstudioConnected(true);
    if (storedLmstudioUrl) setLmstudioUrl(normalizeLmstudioUrl(storedLmstudioUrl));

    if (storedZen) {
      setZenApiKey(storedZen);
      void validateAndFetchModels('zen', storedZen);
    }
    if (storedGoogle) {
      setGoogleApiKey(storedGoogle);
      void validateAndFetchModels('google', storedGoogle);
    }
    if (storedHf) {
      setHfApiKey(storedHf);
      void validateAndFetchModels('huggingface', storedHf);
    }
    if (storedNvidia) {
      setNvidiaApiKey(storedNvidia);
      void validateAndFetchModels('nvidia', storedNvidia);
    }
    if (storedLmstudio === '1' || storedLmstudioUrl) {
      void validateAndFetchModels('lmstudio', '');
    }
  }, []);

  useEffect(() => {
    storeSession();
  }, [zenApiKey, googleApiKey, hfApiKey, nvidiaApiKey, activeProvider, model, lmstudioUrl, lmstudioConnected]);

  useEffect(() => {
    if (!open) return;
    if (!activeProviderConnected) return;
    if (!hasValidSelectedModel) return;
    if (!didExplicitlySelectModel) return;
    setOpen(false);
  }, [open, activeProviderConnected, hasValidSelectedModel, didExplicitlySelectModel]);

  useEffect(() => {
    if (activeProvider !== 'lmstudio') {
      setLmstudioHealth({ state: 'idle' });
      return;
    }

    const timer = setTimeout(() => {
      void probeLmstudioHealth();
    }, 300);

    return () => clearTimeout(timer);
  }, [activeProvider, lmstudioUrl]);

  // When activeProvider changes, auto-select a valid model for that provider
  useEffect(() => {
    if (!modelOptions.length) return;
    // Only allow models from the active provider
    const validModels = modelOptions.filter(o => o.provider === activeProvider);
    if (validModels.length === 0) {
      setModel('');
      return;
    }
    // If current model is not valid for this provider, select the first one
    if (!validModels.some(m => m.id === model)) {
      setModel(validModels[0].id);
    }
  }, [activeProvider, modelOptions]);

  useEffect(() => {
    if (!model) return;
    const selectedModel = modelOptions.find((option) => option.id === model);
    if (!selectedModel) return;
    if (selectedModel.provider !== activeProvider) {
      setActiveProvider(selectedModel.provider);
    }
  }, [activeProvider, model, modelOptions]);

  // Ensure that when sending requests, the selected model is from the active provider
  // (This is enforced by the above effect, but double-check before sending any request)

  const validateAndFetchModels = async (provider: Provider, keyToUse: string) => {
    if (provider === 'lmstudio') {
      // LM Studio is local or remote, no key required, just mark as connected and fetch models
      setLmstudioConnected(true);
      setConnectionError(null);
      setIsConnecting(true);
      try {
        // Default to localhost for LM Studio URL
        const normalizedLmstudioUrl = normalizeLmstudioUrl(lmstudioUrl || DEFAULT_LMSTUDIO_URL);
        const res = await fetch(
          `/api/models?provider=lmstudio&lmstudio_url=${encodeURIComponent(
            normalizedLmstudioUrl
          )}`,
          {
            method: 'GET',
          }
        );
        if (!res.ok) throw new Error('Failed to fetch LM Studio models');
        const payload = (await res.json().catch(() => null)) as any;
        // Debug: log the raw payload from the backend
        setTimeout(() => {
          // eslint-disable-next-line no-console
          console.log('LM Studio raw payload:', payload);
        }, 0);
        // Explicitly handle LM Studio response structure
        let rawModels: any[] = [];
        if (Array.isArray(payload)) {
          rawModels = payload;
        } else if (payload && Array.isArray(payload.data)) {
          rawModels = payload.data;
        } else if (payload && Array.isArray(payload.models)) {
          rawModels = payload.models;
        } else if (payload && payload.object === 'list' && Array.isArray(payload.data)) {
          // LM Studio OpenAI-compatible response
          rawModels = payload.data;
        }
        const options: Array<{ id: string; label: string; provider: Provider }> = rawModels
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
          .filter((m: any): m is any => Boolean(m));
        setModelOptions(prev => {
          // Always remove old lmstudio models and add new ones
          const filtered = prev.filter(p => p.provider !== 'lmstudio');
          const combined = [
            ...filtered,
            ...options.map(o => ({ ...o, provider: 'lmstudio' as Provider })),
          ];
          // Debug: log the model options after update
          setTimeout(() => {
            // eslint-disable-next-line no-console
            console.log('LM Studio modelOptions:', combined);
          }, 0);
          return combined;
        });
        if (options.length && (!model || activeProvider === provider)) {
          setModel(options[0]!.id);
        }
        toast.success(
          `LM Studio connected — ${options.length} model${options.length > 1 ? 's' : ''} loaded`
        );
      } catch (e) {
        setConnectionError('Failed to connect to LM Studio');
        setLmstudioConnected(false);
        toast.error('Failed to connect to LM Studio');
      } finally {
        setIsConnecting(false);
      }
      return;
    }
    const trimmedKey = keyToUse.trim();
    if (!trimmedKey) return;

    setConnectionError(null);
    setIsConnecting(true);
    try {
      const headers: Record<string, string> = {};
      if (provider === 'zen') {
        headers['x-zen-api-key'] = trimmedKey;
      } else if (provider === 'google') {
        headers['x-google-api-key'] = trimmedKey;
      } else if (provider === 'nvidia') {
        headers['x-nvidia-api-key'] = trimmedKey;
      } else {
        headers['x-hf-api-key'] = trimmedKey;
      }

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

      const options: Array<{ id: string; label: string; provider: Provider }> = rawModels
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
        .filter((m: any): m is any => Boolean(m));

      setModelOptions(prev => {
        // Filter out existing models for the same provider to avoid duplicates
        const filtered = prev.filter(p => p.provider !== provider);
        const combined = [...filtered, ...options];
        return combined;
      });

      // Auto-select the first returned model when:
      // - no model is selected yet, OR
      // - the user was actively connecting the same provider (quick UX win)
      if (options.length && (!model || activeProvider === provider)) {
        setModel(options[0]!.id);
      }

      if (provider === 'zen') setZenConnected(true);
      else if (provider === 'google') setGoogleConnected(true);
      else if (provider === 'nvidia') setNvidiaConnected(true);
      else setHfConnected(true);

      const providerLabel =
        provider === 'zen'
          ? 'OpenCode'
          : provider === 'google'
          ? 'Google Gemini'
          : provider === 'nvidia'
          ? 'NVIDIA'
          : 'Hugging Face';

      if (options.length) {
        toast.success(
          `${providerLabel} connected — ${options.length} model${
            options.length > 1 ? 's' : ''
          } loaded`
        );
      } else {
        toast.success(`${providerLabel} connected — no models returned`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Failed to validate ${provider} API key.`;
      setConnectionError(msg);
      toast.error(msg);
      if (provider === 'zen') setZenConnected(false);
      else if (provider === 'google') setGoogleConnected(false);
      else if (provider === 'nvidia') setNvidiaConnected(false);
      else setHfConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const connectWithKey = async (event?: React.FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();

    // Enforce: only allow models from the active provider
    const validModels = modelOptions.filter(o => o.provider === activeProvider);
    if (validModels.length && !validModels.some(m => m.id === model)) {
      setModel(validModels[0].id);
      // Wait for state update before proceeding
      setTimeout(() => connectWithKey(event), 0);
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
  };

  const handleModelChange = (nextModel: string) => {
    setDidExplicitlySelectModel(true);
    setModel(nextModel);
    const selectedModel = modelOptions.find((option) => option.id === nextModel);
    if (selectedModel && selectedModel.provider !== activeProvider) {
      setActiveProvider(selectedModel.provider);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setDidExplicitlySelectModel(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'flex items-center justify-center',
                    connected ? 'text-emerald-400' : 'text-muted-foreground',
                    triggerClassName
                  )}
                  aria-label={connected ? 'Connections — connected' : 'Connections — disconnected'}
                >
                  {connected ? (
                    <PiPlugsConnectedLight className="h-4 w-4" />
                  ) : (
                    <VscDebugDisconnect className="h-4 w-4" />
                  )}
                </Button>
              </SheetTrigger>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            <p>{connected ? 'Connected' : 'Disconnected'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <SheetContent side={side} className="max-h-[60vh] overflow-auto">
        <SheetHeader>
          <SheetTitle>Connections</SheetTitle>
        </SheetHeader>

        {connectionError ? (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {connectionError}
          </div>
        ) : null}

        {!zenConnected || !googleConnected || !hfConnected || !nvidiaConnected ? (
          <form className="grid gap-3 grid-cols-1 sm:grid-cols-4 mb-4" onSubmit={connectWithKey}>
            <div className="w-full sm:col-span-1 flex items-center gap-3">
              <Select value={activeProvider} onValueChange={(v: any) => setActiveProvider(v)}>
                <SelectTrigger className="h-8 w-full sm:w-auto sm:min-w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zen">OpenCode</SelectItem>
                  <SelectItem value="google">Google Gemini</SelectItem>
                  <SelectItem value="nvidia">NVIDIA</SelectItem>
                  <SelectItem value="huggingface">Hugging Face</SelectItem>
                  <SelectItem value="lmstudio">LM Studio (local)</SelectItem>
                </SelectContent>
                {lmstudioConnected && (
                  <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                    <div className="size-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-muted-foreground">LM Studio</span>
                    <button
                      onClick={() => {
                        setLmstudioConnected(false);
                        setModelOptions(m => m.filter(o => o.provider !== 'lmstudio'));
                      }}
                      className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                    >
                      ×
                    </button>
                  </div>
                )}
              </Select>

              {zenConnected || googleConnected || hfConnected || nvidiaConnected || (
                <div className="hidden sm:inline-flex items-center gap-2 px-2 py-1 rounded-md border bg-background/5 text-xs">
                  {zenConnected && (
                    <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-muted-foreground">OpenCode</span>
                      <button
                        onClick={() => {
                          setZenConnected(false);
                          setZenApiKey('');
                          setModelOptions(m => m.filter(o => o.provider !== 'zen'));
                        }}
                        className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {nvidiaConnected && (
                    <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-muted-foreground">NVIDIA</span>
                      <button
                        onClick={() => {
                          setNvidiaConnected(false);
                          setNvidiaApiKey('');
                          setModelOptions(m => m.filter(o => o.provider !== 'nvidia'));
                        }}
                        className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {googleConnected && (
                    <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-muted-foreground">Gemini</span>
                      <button
                        onClick={() => {
                          setGoogleConnected(false);
                          setGoogleApiKey('');
                          setModelOptions(m => m.filter(o => o.provider !== 'google'));
                        }}
                        className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {hfConnected && (
                    <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-muted-foreground">HF</span>
                      <button
                        onClick={() => {
                          setHfConnected(false);
                          setHfApiKey('');
                          setModelOptions(m => m.filter(o => o.provider !== 'huggingface'));
                        }}
                        className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {zenConnected || googleConnected || hfConnected || nvidiaConnected || (
              <div className="w-full sm:col-span-3 sm:col-start-2 sm:row-start-1 flex justify-end sm:hidden">
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md border bg-background/5 text-xs">
                  {zenConnected && (
                    <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-muted-foreground">OpenCode</span>
                      <button
                        onClick={() => {
                          setZenConnected(false);
                          setZenApiKey('');
                          setModelOptions(m => m.filter(o => o.provider !== 'zen'));
                        }}
                        className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {nvidiaConnected && (
                    <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-muted-foreground">NVIDIA</span>
                      <button
                        onClick={() => {
                          setNvidiaConnected(false);
                          setNvidiaApiKey('');
                          setModelOptions(m => m.filter(o => o.provider !== 'nvidia'));
                        }}
                        className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {googleConnected && (
                    <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-muted-foreground">Gemini</span>
                      <button
                        onClick={() => {
                          setGoogleConnected(false);
                          setGoogleApiKey('');
                          setModelOptions(m => m.filter(o => o.provider !== 'google'));
                        }}
                        className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  {hfConnected && (
                    <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] text-muted-foreground">HF</span>
                      <button
                        onClick={() => {
                          setHfConnected(false);
                          setHfApiKey('');
                          setModelOptions(m => m.filter(o => o.provider !== 'huggingface'));
                        }}
                        className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="w-full sm:col-span-3 sm:row-start-2 sm:col-start-1 flex items-start gap-3">
              {activeProvider === 'lmstudio' ? (
                <div className="space-y-1">
                  <Input
                    type="text"
                    disabled={activeProviderConnected}
                    className="h-8 w-full sm:w-auto sm:min-w-[220px] text-xs"
                    placeholder={
                      activeProviderConnected
                        ? 'Connected'
                        : 'Enter LM Studio IP address (e.g. http://192.168.12.48:1234)'
                    }
                    value={lmstudioUrl}
                    onChange={e => setLmstudioUrl(e.target.value)}
                  />
                  <div className="text-[11px] leading-4 text-muted-foreground">
                    {lmstudioHealth.state === 'checking' ? (
                      'Checking LM Studio...'
                    ) : lmstudioHealth.state === 'healthy' ? (
                      <>
                        LM Studio reachable{lmstudioHealth.modelCount !== undefined
                          ? `, ${lmstudioHealth.modelCount} model${
                              lmstudioHealth.modelCount === 1 ? '' : 's'
                            } found`
                          : ''}
                      </>
                    ) : lmstudioHealth.state === 'error' ? (
                      <span className="text-rose-400">
                        LM Studio not reachable{lmstudioHealth.message ? `: ${lmstudioHealth.message}` : ''}
                      </span>
                    ) : (
                      'LM Studio health will appear here'
                    )}
                  </div>
                </div>
              ) : (
                <Input
                  type="password"
                  disabled={activeProviderConnected}
                  className="h-8 w-full sm:w-auto sm:min-w-[220px] text-xs"
                  placeholder={
                    activeProviderConnected
                      ? 'Connected'
                      : `Paste ${
                          activeProvider === 'zen'
                            ? 'OpenCode'
                            : activeProvider === 'google'
                            ? 'Google'
                            : activeProvider === 'nvidia'
                            ? 'NVIDIA'
                            : 'Hugging Face'
                        } key`
                  }
                  value={
                    activeProvider === 'zen'
                      ? zenApiKey
                      : activeProvider === 'google'
                      ? googleApiKey
                      : activeProvider === 'nvidia'
                      ? nvidiaApiKey
                      : hfApiKey
                  }
                  onChange={e => {
                    const val = e.target.value;
                    if (activeProvider === 'zen') setZenApiKey(val);
                    else if (activeProvider === 'google') setGoogleApiKey(val);
                    else if (activeProvider === 'nvidia') setNvidiaApiKey(val);
                    else setHfApiKey(val);
                  }}
                />
              )}

              <Button
                disabled={isConnecting || !hasKeyForActiveProvider || activeProviderConnected}
                size="sm"
                type="submit"
                className="h-8 w-8 p-0 inline-flex items-center justify-center"
                aria-label="Connect"
                title={
                  activeProviderConnected
                    ? 'Provider connected — change provider to edit'
                    : 'Connect'
                }
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="w-full sm:col-span-4 sm:row-start-3">
              <Select value={model} onValueChange={handleModelChange}>
                <SelectTrigger className="h-8 w-full sm:w-auto sm:min-w-[160px] text-xs">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {modelOptions.length ? (
                    <>
                      {modelOptions.some(o => o.provider === 'zen') && (
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">
                          OpenCode
                        </div>
                      )}
                      {modelOptions
                        .filter(o => o.provider === 'zen')
                        .map(option => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}

                      {modelOptions.some(o => o.provider === 'google') && (
                        <div className="mt-2 px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-t">
                          Google Gemini
                        </div>
                      )}
                      {modelOptions
                        .filter(o => o.provider === 'google')
                        .map(option => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}

                      {modelOptions.some(o => o.provider === 'nvidia') && (
                        <div className="mt-2 px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-t">
                          NVIDIA
                        </div>
                      )}
                      {modelOptions
                        .filter(o => o.provider === 'nvidia')
                        .map(option => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}

                      {modelOptions.some(o => o.provider === 'huggingface') && (
                        <div className="mt-2 px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-t">
                          Hugging Face
                        </div>
                      )}
                      {modelOptions
                        .filter(o => o.provider === 'huggingface')
                        .map(option => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}

                      {modelOptions.some(o => o.provider === 'lmstudio') && (
                        <div className="mt-2 px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-t">
                          LM Studio
                        </div>
                      )}
                      {modelOptions
                        .filter(o => o.provider === 'lmstudio')
                        .map(option => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                    </>
                  ) : (
                    <SelectItem value="__no-models__" disabled>
                      No models available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </form>
        ) : null}

        {connected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {zenConnected && (
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[11px] font-medium text-muted-foreground">OpenCode</span>
                  <button
                    onClick={() => {
                      setZenConnected(false);
                      setZenApiKey('');
                      setModelOptions(m => m.filter(o => o.provider !== 'zen'));
                    }}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
              )}

              {googleConnected && (
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[11px] font-medium text-muted-foreground">Gemini</span>
                  <button
                    onClick={() => {
                      setGoogleConnected(false);
                      setGoogleApiKey('');
                      setModelOptions(m => m.filter(o => o.provider !== 'google'));
                    }}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
              )}

              {nvidiaConnected && (
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[11px] font-medium text-muted-foreground">NVIDIA</span>
                  <button
                    onClick={() => {
                      setNvidiaConnected(false);
                      setNvidiaApiKey('');
                      setModelOptions(m => m.filter(o => o.provider !== 'nvidia'));
                    }}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
              )}

              {hfConnected && (
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[11px] font-medium text-muted-foreground">HF</span>
                  <button
                    onClick={() => {
                      setHfConnected(false);
                      setHfApiKey('');
                      setModelOptions(m => m.filter(o => o.provider !== 'huggingface'));
                    }}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
