import { MessageSquare, User, Brain, Settings, FolderOpen, HardDrive, Eye, Globe } from 'lucide-react';
import { useAria } from '@/contexts/AriaContext';
import { AriaLive2D } from './AriaLive2D';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';

const NAV_ITEMS = [
  { id: 'chat',     label: 'Chat',        icon: MessageSquare },
  { id: 'vision',   label: 'Vision',      icon: Eye },
  { id: 'web',      label: 'Web Memory',  icon: Globe },
  { id: 'memory',   label: 'Memory',      icon: Brain },
  { id: 'profile',  label: 'Profile',     icon: User },
  { id: 'files',    label: 'Files',       icon: FolderOpen },
  { id: 'backup',   label: 'Backup',      icon: HardDrive },
  { id: 'settings', label: 'Settings',    icon: Settings },
];

export const AriaSidebar = () => {
  const { activePanel, setActivePanel, profile, orbState, syncStatus, isSpeaking } = useAria();
  const { state: sidebarState, setOpenMobile } = useSidebar();
  const collapsed = sidebarState === 'collapsed';

  const handleNav = (id: string) => {
    setActivePanel(id);
    setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        {!collapsed && (
          <div>
            <h1 className="aria-serif text-[26px] font-light tracking-[0.25em] aria-gradient-text leading-none">
              ARIA
            </h1>
            <p className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground mt-1">
              Personal Companion
            </p>
          </div>
        )}
        <div className={`flex flex-col items-center ${collapsed ? 'py-2' : 'py-4'}`}>
          <AriaLive2D size={collapsed ? 50 : 100} mode="orb" devMode={true} />
          {!collapsed && (
            <>
              <p className="text-[8px] tracking-[0.22em] uppercase text-muted-foreground/60 mt-3 text-center min-h-[13px]">
                {orbState === 'thinking' ? 'Processing...'
                  : orbState === 'speaking' ? 'Speaking...'
                  : orbState === 'listening' ? 'Listening...'
                  : profile.name ? `Online — ${profile.name}` : 'Initializing...'}
              </p>
              {(isSpeaking || orbState === 'listening') && (
                <div className="flex items-center gap-[2px] h-6 mt-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-[2px] rounded-sm bg-foreground/60"
                      style={{
                        height: 3,
                        animation: `aria-wv 0.5s ${i * 0.04}s ease-in-out infinite alternate`,
                        ['--h' as any]: `${8 + Math.sin(i) * 10}px`,
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(item => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => handleNav(item.id)}
                    isActive={activePanel === item.id}
                    tooltip={item.label}
                    className={`transition-all ${
                      activePanel === item.id
                        ? 'text-primary bg-primary/[0.07] border-l-2 border-l-primary'
                        : 'text-muted-foreground hover:text-aria-lav hover:bg-secondary/[0.05] border-l-2 border-l-transparent'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span className="text-xs tracking-wide">{item.label}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border">
        <div className="flex items-center gap-2 text-[9px] tracking-wide text-muted-foreground/30">
          <div className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${
            syncStatus.state === 'ok' ? 'bg-aria-safe shadow-[0_0_5px_rgba(46,213,115,0.4)]'
            : syncStatus.state === 'err' ? 'bg-destructive'
            : syncStatus.state === 'busy' ? 'bg-aria-gold animate-[aria-pulse_0.8s_ease-in-out_infinite]'
            : 'bg-muted-foreground/20'
          }`} />
          {!collapsed && <span>{syncStatus.label || 'Disconnected'}</span>}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};
