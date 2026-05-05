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
  const { isSetupComplete, activePanel, toastMsg, syncStatus } = ctx;
  const PanelComponent = panels[activePanel] || ChatPanel;

  return (
    <>
      {!isSetupComplete && syncStatus.state !== 'busy' && <SetupOverlay />}
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AriaSidebar />
          <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
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
        <div className={`fixed bottom-5 right-5 z-[9998] px-4 py-2.5 rounded-lg bg-card/95 border backdrop-blur-xl text-sm max-w-[280px] transition-all ${
          toastMsg.type === 'ok' ? 'border-aria-safe/35 text-aria-safe' : toastMsg.type === 'err' ? 'border-destructive/35 text-destructive' : 'border-secondary/25 text-aria-lav'
        }`}>
          {toastMsg.text}
        </div>
      )}
    </>
  );
};
