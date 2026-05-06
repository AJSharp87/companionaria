import { useRef } from 'react';
import { useAria } from '@/contexts/AriaContext';

export const BackupPanel = () => {
  const { exportBackup, importBackup } = useAria();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden">
    <div className="flex-1 overflow-y-auto min-h-0 p-5 flex flex-col gap-4">
      <h2 className="aria-serif text-xl font-light text-aria-lav tracking-wider border-b border-border pb-3">USB Backup & Portability</h2>
      <p className="text-[11px] text-muted-foreground leading-relaxed">Aria lives in Supabase — available on every device. Export a safety copy anytime.</p>

      <div className="bg-card border border-aria-gold/20 rounded-xl p-4 relative">
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl bg-gradient-to-r from-aria-gold via-primary to-transparent" />
        <h3 className="text-[9px] tracking-[0.22em] uppercase text-aria-gold mb-3">💾 Export / Import</h3>
        <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">Exports aria-backup.json with all memories, profile, history, and credentials.</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportBackup}
            className="px-4 py-2.5 rounded-lg border border-aria-gold/30 bg-aria-gold/[0.06] text-aria-gold text-xs tracking-wider uppercase">
            ⬇ Export Backup
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="px-4 py-2.5 rounded-lg border border-secondary/30 bg-secondary/[0.07] text-secondary text-xs tracking-wider uppercase">
            ⬆ Import / Restore
          </button>
          <input ref={fileRef} type="file" className="hidden" accept=".json"
            onChange={e => { if (e.target.files?.[0]) importBackup(e.target.files[0]); }} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 relative">
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl aria-gradient-rose" />
        <h3 className="text-[9px] tracking-[0.22em] uppercase text-secondary mb-3">🗂 Setup</h3>
        <div className="space-y-2 text-[11px] text-muted-foreground leading-relaxed">
          <div className="flex gap-2"><span className="text-secondary font-semibold">1.</span> Export a backup above</div>
          <div className="flex gap-2"><span className="text-secondary font-semibold">2.</span> On any device, open this Lovable app</div>
          <div className="flex gap-2"><span className="text-secondary font-semibold">3.</span> Import your backup to restore everything</div>
        </div>
      </div>

      <div className="bg-card border border-accent/20 rounded-xl p-4 relative">
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl bg-gradient-to-r from-accent to-transparent" />
        <h3 className="text-[9px] tracking-[0.22em] uppercase text-accent mb-2">📱 Mobile</h3>
        <p className="text-[11px] text-muted-foreground">Works on any device with a browser. Voice + camera both work on mobile.</p>
      </div>
    </div>
    </div>
  );
};
