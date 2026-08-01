'use client';

import { useEffect, useState } from 'react';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2 } from '@/components/icons';
import { MdMonitor, MdSmartphone, MdLaptop } from 'react-icons/md';
import {
  checkForAppUpdate,
  fetchAppReleaseVersion,
  getDesktopBridge,
  type AppUpdateCheckResult,
} from '@/lib/app-update-client';

function getAppType(): string {
  const desktop = getDesktopBridge();
  if (desktop?.isElectron) return 'Electron';
  if (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    navigator.serviceWorker.controller
  )
    return 'PWA';
  return 'Webpage';
}

function AppTypeIcon({ type }: { type: string }) {
  if (type === 'Electron') return <MdLaptop size={48} />;
  if (type === 'PWA') return <MdSmartphone size={48} />;
  return <MdMonitor size={48} />;
}

export default function AboutPage() {
  const [version, setVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [updateResult, setUpdateResult] = useState<AppUpdateCheckResult | null>(null);
  const appType = getAppType();

  useEffect(() => {
    void (async () => {
      const v = await fetchAppReleaseVersion();
      setVersion(v);
      setLoading(false);
    })();
  }, []);

  const handleCheckUpdate = async () => {
    setChecking(true);
    setUpdateResult(null);
    try {
      const result = await checkForAppUpdate({ manual: true });
      setUpdateResult(result);
    } finally {
      setChecking(false);
    }
  };

  return (
    <ContentLayout title="About" navLeft={null} navRight={null}>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--app-header-height,56px))] gap-8 p-8">
        <Card className="pushable-effect w-full max-w-md p-8 flex flex-col items-center gap-6">
          <pre className="font-mono text-[10px] font-bold leading-[0.9] tracking-[-0.06em] drop-shadow-[0_0_10px_rgba(236,72,153,0.28)] text-fuchsia-200 text-center">
{`≈≈≈≈≈≈≈≈≈≈≈≈[ m4trix ]≈≈≈≈≈≈≈≈≈≈≈≈≈
≈≈≈███╗≈≈███╗≈██╗≈████████╗██████╗≈██╗≈██╗≈≈██╗
≈≈≈████╗≈████║≈███║≈╚══██╔══╝██╔══██╗██║≈╚██╗██╔╝
≈≈≈██╔████╔██║≈██╔██║≈≈≈≈██║≈≈≈██████╔╝██║≈≈╚███╔╝
≈≈≈██║╚██╔╝██║≈███████║≈≈≈██║≈≈≈██╔══██╗██║≈≈██╔██╗
≈≈≈██║≈╚═╝≈██║≈╚════██║≈≈≈██║≈≈≈██║≈≈██║██║≈██╔╝╚██╗
≈≈≈╚═╝≈≈≈≈≈╚═╝≈≈≈≈≈╚═╝≈≈≈╚═╝≈≈≈╚═╝≈≈╚═╝╚═╝≈╚═╝≈≈╚═╝`}
          </pre>

          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-3 text-2xl font-semibold">
              <AppTypeIcon type={appType} />
              <span>{appType}</span>
            </div>
            <div className="text-muted-foreground">
              {loading ? (
                <span className="animate-pulse">Loading version...</span>
              ) : (
                <span>Version {version || 'unknown'}</span>
              )}
            </div>
          </div>

          <Button
            onClick={handleCheckUpdate}
            disabled={checking}
            className="pushable-effect min-w-[180px]"
          >
            {checking ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                Checking...
              </>
            ) : (
              'Check for Update'
            )}
          </Button>

          {updateResult && (
            <div className="text-sm text-center">
              {updateResult.status === 'up-to-date' && (
                <p className="text-green-500">You are up to date!</p>
              )}
              {updateResult.status === 'update-available' && (
                <p className="text-yellow-500">
                  Update available: {updateResult.latest}
                </p>
              )}
              {updateResult.status === 'unavailable' && (
                <p className="text-muted-foreground">
                  {updateResult.message || 'Update check unavailable'}
                </p>
              )}
              {updateResult.status === 'local-dev' && (
                <p className="text-muted-foreground">
                  {updateResult.message}
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </ContentLayout>
  );
}
