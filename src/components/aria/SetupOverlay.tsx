import { useState } from 'react';
import { useAria } from '@/contexts/AriaContext';

export const SetupOverlay = () => {
  const { runSetup, sbUrl } = useAria();
  const [apiKey, setApiKey] = useState('');
  const [supaUrl, setSupaUrl] = useState(sbUrl);
  const [supaAnon, setSupaAnon] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  const handleSetup = async () => {
    setError('');
    setLoading(true);
    const ok = await runSetup(apiKey, supaUrl, supaAnon);
    if (!ok) setError('Could not connect. Check your credentials.');
    setLoading(false);
  };

  const SQL = `create table if not exists aria_config (
  id text primary key,
  value text,
  updated_at timestamptz default now()
);
create table if not exists aria_memory (
  id text primary key,
  value text,
  updated_at timestamptz default now()
);
create table if not exists aria_messages (
  id bigserial primary key,
  role text,
  content text,
  msg_type text default 'normal',
  created_at timestamptz default now()
);
alter table aria_config enable row level security;
alter table aria_memory enable row level security;
alter table aria_messages enable row level security;
create policy "allow_all" on aria_config for all using (true) with check (true);
create policy "allow_all" on aria_memory for all using (true) with check (true);
create policy "allow_all" on aria_messages for all using (true) with check (true);`;

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 flex items-start justify-center overflow-y-auto p-4 md:p-8">
      <div className="w-full max-w-[560px] bg-gradient-to-br from-card to-background border border-primary/30 rounded-2xl p-6 md:p-8 relative my-auto">
        <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl aria-gradient-rose" />

        <h1 className="aria-serif text-2xl font-light tracking-[0.22em] aria-gradient-text">ARIA</h1>
        <p className="text-[10px] tracking-[0.28em] uppercase text-muted-foreground mt-1 mb-6">First-time connection setup</p>

        <div className="space-y-4">
          <div>
            <label className="text-[9px] tracking-[0.22em] uppercase text-secondary mb-1.5 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-secondary/15 border border-secondary/35 flex items-center justify-center text-[9px]">1</span>
              Anthropic API Key
            </label>
            <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="text" placeholder="sk-ant-api03-..."
              className="w-full px-3.5 py-3 bg-background/50 border border-secondary/25 rounded-lg text-foreground text-sm font-mono outline-none transition-all focus:border-primary/65 focus:shadow-[0_0_0_3px_rgba(255,107,157,0.08)] placeholder:text-muted-foreground/20" />
            <p className="text-[11px] text-muted-foreground/30 mt-1 leading-relaxed">
              Free at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-secondary hover:underline">console.anthropic.com</a> → API Keys
            </p>
          </div>

          <div>
            <label className="text-[9px] tracking-[0.22em] uppercase text-secondary mb-1.5 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-secondary/15 border border-secondary/35 flex items-center justify-center text-[9px]">2</span>
              Supabase Project URL
            </label>
            <input value={supaUrl} onChange={e => setSupaUrl(e.target.value)} type="text" placeholder="https://xxxxxxxxxxxx.supabase.co"
              className="w-full px-3.5 py-3 bg-background/50 border border-secondary/25 rounded-lg text-foreground text-sm font-mono outline-none transition-all focus:border-primary/65 focus:shadow-[0_0_0_3px_rgba(255,107,157,0.08)] placeholder:text-muted-foreground/20" />
          </div>

          <div>
            <label className="text-[9px] tracking-[0.22em] uppercase text-secondary mb-1.5 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-secondary/15 border border-secondary/35 flex items-center justify-center text-[9px]">3</span>
              Supabase Anon Key
            </label>
            <input value={supaAnon} onChange={e => setSupaAnon(e.target.value)} type="text" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full px-3.5 py-3 bg-background/50 border border-secondary/25 rounded-lg text-foreground text-sm font-mono outline-none transition-all focus:border-primary/65 focus:shadow-[0_0_0_3px_rgba(255,107,157,0.08)] placeholder:text-muted-foreground/20" />
          </div>
        </div>

        {error && (
          <div className="mt-3 px-3.5 py-2.5 bg-destructive/[0.08] border border-destructive/30 rounded-lg text-destructive text-xs leading-relaxed">
            ⚠ {error}
          </div>
        )}

        <button onClick={handleSetup} disabled={loading}
          className="w-full mt-4 py-3.5 rounded-xl border border-primary/45 bg-gradient-to-br from-primary/20 to-secondary/20 text-primary text-sm tracking-[0.2em] uppercase transition-all hover:from-primary/35 hover:to-secondary/35 hover:shadow-[0_0_25px_rgba(255,107,157,0.25)] disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? 'Connecting...' : '✦ Connect & Meet Aria'}
        </button>

        <div className="mt-4">
          <button onClick={() => setShowGuide(!showGuide)}
            className="text-[10px] tracking-[0.15em] uppercase text-secondary cursor-pointer">
            {showGuide ? '▼' : '▶'} New to Supabase? Free setup guide + SQL
          </button>
          {showGuide && (
            <div className="mt-3 space-y-2">
              {['Go to supabase.com → Start for free', 'Click New Project, name it "aria"', 'In sidebar click SQL Editor → paste SQL below → Run', 'Go to Settings → API → copy Project URL and anon key'].map((s, i) => (
                <div key={i} className="flex gap-2.5 text-[11px] text-muted-foreground leading-relaxed border-b border-secondary/[0.06] pb-2 last:border-none">
                  <span className="w-4 h-4 rounded-full bg-secondary/10 border border-secondary/25 flex items-center justify-center text-[9px] text-secondary flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span dangerouslySetInnerHTML={{ __html: s.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>') }} />
                </div>
              ))}
              <button onClick={() => { navigator.clipboard.writeText(SQL); }}
                className="w-full py-2.5 rounded-lg border border-secondary/30 bg-secondary/[0.07] text-secondary text-xs tracking-wider uppercase">
                📋 Copy Setup SQL
              </button>
              <div className="p-3.5 bg-background/40 border border-border rounded-lg">
                <pre className="text-[10px] text-muted-foreground/50 whitespace-pre-wrap leading-relaxed font-mono select-text">{SQL}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
