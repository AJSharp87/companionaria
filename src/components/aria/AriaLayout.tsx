import { useEffect } from 'react';
import { useAria, useAriaOptional } from '@/contexts/AriaContext';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AriaSidebar } from './AriaSidebar';
import { ChatPanel } from './ChatPanel';
import { ProfilePanel } from './ProfilePanel';
import { MemoryPanel } from './MemoryPanel';
import { SettingsPanel } from './SettingsPanel';
import { FilesPanel } from './FilesPanel';
import { BackupPanel } from './BackupPanel';
import { SetupOverlay } from './SetupOverlay';
import { WebIngestionPanel } from './WebIngestionPanel';
import { VisionPanel } from './VisionPanel';
import { useAriaLive2DSync } from '@/hooks/useAriaLive2DSync';
import { getAriaStateRGB } from '@/lib/ariaLive2DParams';
import { useAuth } from '@/hooks/useAuth';

const panels: Record<string, React.FC> = {
  chat: ChatPanel,
  vision: VisionPanel,
  profile: ProfilePanel,
  memory: MemoryPanel,
  settings: SettingsPanel,
  files: FilesPanel,
  backup: BackupPanel,
  web: WebIngestionPanel,
};

export const AriaLayout = () => {
  const ctx = useAriaOptional();
  if (!ctx) return null;
  return <AriaLayoutInner />;
};

const AriaLayoutInner = () => {
  const ctx = useAria();
  const { isSetupComplete, activePanel, toastMsg, syncStatus, orbState, emotionState } = ctx;
  const PanelComponent = panels[activePanel] || ChatPanel;

  // Single app-level Live2D Supabase sync
  useAriaLive2DSync({ devMode: true, modelUrl: '/models/aria/aria.model3.json' });

  // One-shot [Aria System Check] log on app load
  useEffect(() => {
    const t = setTimeout(() => {
      const cubismOK = typeof window !== 'undefined' && !!(window as any).Live2DCubismCore;
      const speechOK = typeof window !== 'undefined' && !!(window as any).speechSynthesis;
      const cameraOK = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
      // eslint-disable-next-line no-console
      console.groupCollapsed('[Aria System Check]');
      console.log('Live2D Core ............', cubismOK ? 'OK' : 'DEGRADED (Live2DCubismCore not on window)');
      console.log('Face Tracking ..........', cameraOK ? 'OK (camera available)' : 'OFFLINE (no mediaDevices)');
      console.log('Vision Pipeline ........', cameraOK ? 'OK' : 'OFFLINE (no camera)');
      console.log('Supabase Sync ..........', ctx.isSetupComplete ? 'OK' : 'DEGRADED (setup incomplete)');
      console.log('Emotion State ..........', 'OK', `(orb=${ctx.orbState}, emotion=${ctx.emotionState || 'neutral'})`);
      console.log('Voice ..................', speechOK ? 'OK' : 'DEGRADED (no speechSynthesis)');
      console.groupEnd();
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toastColor = toastMsg
    ? toastMsg.type === 'ok'
      ? 'hsl(var(--aria-safe))'
      : toastMsg.type === 'err'
        ? 'hsl(var(--destructive))'
        : `rgb(${getAriaStateRGB(orbState, emotionState)})`
    : undefined;


  return (
    <>
      {!isSetupComplete && syncStatus.state !== 'busy' && <SetupOverlay />}
      <SidebarProvider>
        <div className="h-screen flex w-full overflow-hidden">
          <AriaSidebar />
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <header className="h-10 flex items-center border-b border-border bg-background/85 backdrop-blur-xl md:hidden flex-shrink-0">
              <SidebarTrigger className="ml-2 text-muted-foreground" />
              <span className="ml-2 aria-serif text-sm text-aria-lav tracking-wider font-light">ARIA</span>
            </header>
            <main className="flex-1 flex flex-col overflow-hidden">
              <PanelComponent />
            </main>
          </div>
        </div>
      </SidebarProvider>
      {toastMsg && (
        <div
          className={`fixed bottom-5 right-5 z-[9998] px-4 py-2.5 rounded-lg bg-card/95 border backdrop-blur-xl text-sm max-w-[280px] transition-all ${
            toastMsg.type === 'ok' ? 'text-aria-safe' : toastMsg.type === 'err' ? 'text-destructive' : 'text-aria-lav'
          }`}
          style={{ borderColor: toastColor }}
        >
          {toastMsg.text}
        </div>
      )}
    </>
  );
};
