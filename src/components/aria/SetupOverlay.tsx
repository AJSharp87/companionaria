import { useState } from 'react';
import { useAria } from '@/contexts/AriaContext';

export const SetupOverlay = () => {
  const { runSetup, sbUrl, sbAnon } = useAria();
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSetup = async () => {
    setError('');
    setLoading(true);
    const ok = await runSetup(apiKey, sbUrl, sbAnon);
    if (!ok) setError('Could not connect. Check your Anthropic API key.');
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 flex items-start justify-center overflow-y-auto p-4 md:p-8">
      <div className="w-full max-w-[560px] bg-gradient-to-br from-card to-background border border-primary/30 rounded-2xl p-6 md:p-8 relative my-auto">
        <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl aria-gradient-rose" />

        <h1 className="aria-serif text-2xl font-light tracking-[0.22em] aria-gradient-text">ARIA</h1>
        <p className="text-[10px] tracking-[0.28em] uppercase text-muted-foreground mt-1 mb-6">Enter your Anthropic API key to begin</p>

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

        <p className="text-[10px] text-muted-foreground/40 mt-4 text-center">
          Database is pre-configured — just add your API key.
        </p>
      </div>
    </div>
  );
};
