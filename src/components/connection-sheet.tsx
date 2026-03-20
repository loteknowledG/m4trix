'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plug } from 'lucide-react';
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
import { cn } from '@/lib/utils';

type Provider = 'zen' | 'google' | 'huggingface' | 'nvidia' | 'kobold';

export interface ConnectionSheetProps {
  /** Side to open the sheet from */
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Optional class applied to the trigger button */
  triggerClassName?: string;
}

export function ConnectionSheet({ side = 'top', triggerClassName }: ConnectionSheetProps) {
  const [activeProvider, setActiveProvider] = useState<Provider>('zen');
  const [zenApiKey, setZenApiKey] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [hfApiKey, setHfApiKey] = useState('');
  const [nvidiaApiKey, setNvidiaApiKey] = useState('');
  const [koboldUrl, setKoboldUrl] = useState('http://localhost:5000');
  const [koboldModel, setKoboldModel] = useState('');
  const [zenConnected, setZenConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [hfConnected, setHfConnected] = useState(false);
  const [nvidiaConnected, setNvidiaConnected] = useState(false);
  const [koboldConnected, setKoboldConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [model, setModel] = useState('');
  const [modelOptions, setModelOptions] = useState<
    Array<{ id: string; label: string; provider: Provider }>
  >([]);

  const connected =
    zenConnected || googleConnected || hfConnected || nvidiaConnected || koboldConnected;

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
      : activeProvider === 'kobold'
      ? koboldUrl
      : hfApiKey || ''
    ).trim().length > 0;

  const activeProviderConnected =
    activeProvider === 'zen'
      ? zenConnected
      : activeProvider === 'google'
      ? googleConnected
      : activeProvider === 'nvidia'
      ? nvidiaConnected
      : activeProvider === 'kobold'
      ? koboldConnected
      : hfConnected;

  const storeSession = () => {
    if (typeof window === 'undefined') return;
    if (zenApiKey) window.sessionStorage.setItem('ZEN_API_KEY_SESSION', zenApiKey);
    else window.sessionStorage.removeItem('ZEN_API_KEY_SESSION');

    if (googleApiKey) window.sessionStorage.setItem('GOOGLE_API_KEY_SESSION', googleApiKey);
    else window.sessionStorage.removeItem('GOOGLE_API_KEY_SESSION');

    if (hfApiKey) window.sessionStorage.setItem('HF_API_KEY_SESSION', hfApiKey);
    else window.sessionStorage.removeItem('HF_API_KEY_SESSION');

    if (nvidiaApiKey) window.sessionStorage.setItem('NVIDIA_API_KEY_SESSION', nvidiaApiKey);
    else window.sessionStorage.removeItem('NVIDIA_API_KEY_SESSION');

    if (koboldUrl) window.sessionStorage.setItem('KOBOLD_URL_SESSION', koboldUrl);
    else window.sessionStorage.removeItem('KOBOLD_URL_SESSION');

    if (koboldModel) window.sessionStorage.setItem('KOBOLD_MODEL_SESSION', koboldModel);
    else window.sessionStorage.removeItem('KOBOLD_MODEL_SESSION');

    if (model) window.sessionStorage.setItem('ACTIVE_MODEL_SESSION', model);
    else window.sessionStorage.removeItem('ACTIVE_MODEL_SESSION');

    window.sessionStorage.setItem('ACTIVE_PROVIDER_SESSION', activeProvider);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedZen = window.sessionStorage.getItem('ZEN_API_KEY_SESSION');
    const storedGoogle = window.sessionStorage.getItem('GOOGLE_API_KEY_SESSION');
    const storedHf = window.sessionStorage.getItem('HF_API_KEY_SESSION');
    const storedNvidia = window.sessionStorage.getItem('NVIDIA_API_KEY_SESSION');
    const storedProvider = window.sessionStorage.getItem(
      'ACTIVE_PROVIDER_SESSION'
    ) as Provider | null;

    const storedModel = window.sessionStorage.getItem('ACTIVE_MODEL_SESSION');
    const storedKoboldUrl = window.sessionStorage.getItem('KOBOLD_URL_SESSION');
    const storedKoboldModel = window.sessionStorage.getItem('KOBOLD_MODEL_SESSION');

    if (storedModel) setModel(storedModel);
    if (storedKoboldModel) setKoboldModel(storedKoboldModel);
    if (storedProvider) setActiveProvider(storedProvider);

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
    if (storedKoboldUrl) {
      setKoboldUrl(storedKoboldUrl);
      setKoboldConnected(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    storeSession();
  }, [zenApiKey, googleApiKey, hfApiKey, nvidiaApiKey, activeProvider, model]);

  const validateAndFetchModels = async (provider: Provider, keyToUse: string) => {
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

    if (activeProvider === 'kobold') {
      // KoboldCPP is an always-available local endpoint; just consider it "connected".
      setKoboldConnected(true);
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

  return (
    <Sheet>
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
                  {!zenConnected && <SelectItem value="zen">OpenCode</SelectItem>}
                  {!googleConnected && <SelectItem value="google">Google Gemini</SelectItem>}
                  {!nvidiaConnected && <SelectItem value="nvidia">NVIDIA</SelectItem>}
                  {!hfConnected && <SelectItem value="huggingface">Hugging Face</SelectItem>}
                  <SelectItem value="kobold">KoboldCPP (local)</SelectItem>
                </SelectContent>
              </Select>

              {(zenConnected ||
                googleConnected ||
                hfConnected ||
                nvidiaConnected ||
                koboldConnected) && (
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

            {(zenConnected ||
              googleConnected ||
              hfConnected ||
              nvidiaConnected ||
              koboldConnected) && (
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
              <Select value={model} onValueChange={setModel}>
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
