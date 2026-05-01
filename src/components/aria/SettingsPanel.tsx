import { useState, useEffect } from 'react';
import { useAria } from '@/contexts/AriaContext';

const VOICE_PRESETS: { id: string; label: string; voiceId: string }[] = [
  { id: 'sadie', label: '★ Sadie — Calm, gritty & expressive', voiceId: '9BWtsMINqrJLrRacOk9x' },
  { id: 'aria', label: 'Aria — Deep, rich, seductive', voiceId: '9BWtsMINqrJLrRacOk9x' },
  { id: 'sarah', label: 'Sarah — Warm, natural, conversational', voiceId: 'EXAVITQu4vr4xnSDxMaL' },
  { id: 'charlotte', label: 'Charlotte — Confident, smooth, rich', voiceId: 'XB0fDUnXU5powFXDhCwa' },
  { id: 'freya', label: 'Freya — Warm, expressive, fluid', voiceId: 'jsCqWAovK2LkecY7zXl4' },
  { id: 'lily', label: 'Lily — Soft, warm, deeply personal', voiceId: 'pFZP5JQG7iQjIQuC4Bku' },
  { id: 'jessica', label: 'Jessica — Energetic, bright, clear', voiceId: 'cgSgspJ2msm6clMCkdEW' },
  { id: 'custom', label: 'Custom — paste Voice ID below', voiceId: '' },
];

export const SettingsPanel = () => {
  const {
    apiKey, sbUrl, sbAnon, elevenKey, elevenVoiceId, settings,
    toggleSetting, saveKeys, saveVoiceSettings, nukeAll, speak, stopSpeak,
    deepgramKey, saveDeepgramKey, deepgramLang, saveDeepgramLang,
  } = useAria();
  const [anth, setAnth] = useState(apiKey);
  const [sUrl, setSUrl] = useState(sbUrl);
  const [sAnon, setSAnon] = useState(sbAnon);
  const [elKey, setElKey] = useState(elevenKey);
  const [elVid, setElVid] = useState(elevenVoiceId);
  const [dgKey, setDgKey] = useState(deepgramKey);
  const [keyMsg, setKeyMsg] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('sadie');

  useEffect(() => {
    setAnth(apiKey); setSUrl(sbUrl); setSAnon(sbAnon);
    setElKey(elevenKey); setElVid(elevenVoiceId); setDgKey(deepgramKey);
    // Detect current preset from voice ID
    const match = VOICE_PRESETS.find(p => p.voiceId === elevenVoiceId && p.id !== 'custom');
    setSelectedPreset(match ? match.id : 'custom');
  }, [apiKey, sbUrl, sbAnon, elevenKey, elevenVoiceId, deepgramKey]);

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = VOICE_PRESETS.find(p => p.id === presetId);
    if (preset && preset.voiceId) {
      setElVid(preset.voiceId);
    }
  };

  const Toggle = ({ k, label, desc }: { k: keyof typeof settings; label: string; desc: string }) => (
    <div className="flex items-center justify-between py-2 border-b border-secondary/5 last:border-none">
      <div><div className="text-sm text-foreground">{label}</div><div className="text-[10px] text-muted-foreground mt-0.5">{desc}</div></div>
      <div onClick={() => toggleSetting(k)}
        className={`w-[38px] h-5 rounded-full relative cursor-pointer transition-all ${
          settings[k] ? 'bg-gradient-to-r from-primary/50 to-secondary/50 border-primary/40' : 'bg-secondary/10 border-secondary/20'
        } border`}>
        <div className={`absolute top-[2px] w-3.5 h-3.5 rounded-full transition-all ${
          settings[k] ? 'left-5 bg-foreground shadow-[0_0_7px_rgba(255,107,157,0.5)]' : 'left-[2px] bg-muted-foreground/50'
        }`} />
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
      <h2 className="aria-serif text-xl font-light text-aria-lav tracking-wider border-b border-border pb-3">Settings</h2>

      {/* Keys */}
      <div className="bg-card border border-destructive/20 rounded-xl p-4 relative">
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl bg-gradient-to-r from-destructive to-transparent" />
        <h3 className="text-[9px] tracking-[0.22em] uppercase text-destructive mb-3">🔑 API Keys</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[9px] tracking-[0.18em] uppercase text-secondary mb-1 block">Anthropic API Key</label>
            <input value={anth} onChange={e => setAnth(e.target.value)} type="text" placeholder="sk-ant-api03-..."
              className="w-full px-3 py-2.5 bg-background/50 border border-secondary/[0.18] rounded-lg text-foreground text-sm font-mono outline-none focus:border-secondary/45 placeholder:text-muted-foreground/20" />
          </div>
          <div>
            <label className="text-[9px] tracking-[0.18em] uppercase text-secondary mb-1 block">Supabase Project URL</label>
            <input value={sUrl} onChange={e => setSUrl(e.target.value)} placeholder="https://xxx.supabase.co"
              className="w-full px-3 py-2.5 bg-background/50 border border-secondary/[0.18] rounded-lg text-foreground text-sm font-mono outline-none focus:border-secondary/45 placeholder:text-muted-foreground/20" />
          </div>
          <div>
            <label className="text-[9px] tracking-[0.18em] uppercase text-secondary mb-1 block">Supabase Anon Key</label>
            <input value={sAnon} onChange={e => setSAnon(e.target.value)} placeholder="eyJ..."
              className="w-full px-3 py-2.5 bg-background/50 border border-secondary/[0.18] rounded-lg text-foreground text-sm font-mono outline-none focus:border-secondary/45 placeholder:text-muted-foreground/20" />
          </div>
          <button onClick={async () => { const ok = await saveKeys(anth, sUrl, sAnon); setKeyMsg(ok ? '✓ Saved' : '⚠ Failed'); setTimeout(() => setKeyMsg(''), 4000); }}
            className="w-full py-2.5 rounded-lg border border-primary/35 bg-primary/[0.09] text-primary text-xs tracking-[0.16em] uppercase">✓ Save & Reconnect</button>
          {keyMsg && <p className="text-[10px] text-center text-muted-foreground">{keyMsg}</p>}
        </div>
      </div>

      {/* Voice */}
      <div className="bg-card border border-accent/20 rounded-xl p-4 relative">
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl bg-gradient-to-r from-accent to-transparent" />
        <h3 className="text-[9px] tracking-[0.22em] uppercase text-accent mb-3">🎙 Voice — ElevenLabs</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[9px] tracking-[0.18em] uppercase text-secondary mb-1 block">ElevenLabs API Key</label>
            <input value={elKey} onChange={e => setElKey(e.target.value)} placeholder="your-elevenlabs-api-key"
              className="w-full px-3 py-2.5 bg-background/50 border border-secondary/[0.18] rounded-lg text-foreground text-sm font-mono outline-none focus:border-secondary/45 placeholder:text-muted-foreground/20" />
          </div>
          <div>
            <label className="text-[9px] tracking-[0.18em] uppercase text-secondary mb-1 block">Voice Preset</label>
            <select
              value={selectedPreset}
              onChange={e => handlePresetChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-background/50 border border-secondary/[0.18] rounded-lg text-foreground text-sm outline-none focus:border-secondary/45"
            >
              {VOICE_PRESETS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>
          {selectedPreset === 'custom' && (
            <div>
              <label className="text-[9px] tracking-[0.18em] uppercase text-secondary mb-1 block">Custom Voice ID</label>
              <input value={elVid} onChange={e => setElVid(e.target.value)} placeholder="paste-voice-id-here"
                className="w-full px-3 py-2.5 bg-background/50 border border-secondary/[0.18] rounded-lg text-foreground text-sm font-mono outline-none focus:border-secondary/45 placeholder:text-muted-foreground/20" />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => saveVoiceSettings(elKey, elVid)}
              className="flex-1 py-2.5 rounded-lg border border-accent/25 bg-accent/[0.06] text-accent text-xs tracking-wider uppercase">✓ Save</button>
            <button onClick={() => speak('Hello! This is how I sound. Nice to meet you.')}
              className="flex-1 py-2.5 rounded-lg border border-secondary/30 bg-secondary/[0.07] text-secondary text-xs tracking-wider uppercase">▶ Test</button>
            <button onClick={stopSpeak}
              className="flex-1 py-2.5 rounded-lg border border-primary/30 bg-primary/[0.06] text-primary text-xs tracking-wider uppercase">⏹ Stop</button>
          </div>
          <Toggle k="voice" label="Voice Output" desc="Aria speaks responses" />
          <Toggle k="autoread" label="Auto-read Responses" desc="Read every reply automatically" />
          <Toggle k="mic" label="Voice Input (Mic)" desc="Hands-free conversation" />

          {/* Sadie Voice Setup Info */}
          {selectedPreset === 'sadie' && (
            <div className="mt-2 p-3 bg-background/30 border border-aria-gold/15 rounded-lg">
              <h4 className="text-[9px] tracking-[0.18em] uppercase text-aria-gold mb-2">★ Sadie — Voice Setup</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                To use Sadie via ElevenLabs API: go to{' '}
                <a href="https://elevenlabs.io" target="_blank" rel="noreferrer" className="text-secondary hover:underline">elevenlabs.io</a>
                {' '}→ Voice Library → search "Sadie" → Add to your voices → copy the Voice ID. Paste your API key above and save.
              </p>
            </div>
          )}

          <div className="pt-3 mt-2 border-t border-secondary/10">
            <label className="text-[9px] tracking-[0.18em] uppercase text-secondary mb-1 block">
              Deepgram API Key (optional — real-time transcription)
            </label>
            <input
              value={dgKey}
              onChange={e => setDgKey(e.target.value)}
              onBlur={() => { if (dgKey !== deepgramKey) saveDeepgramKey(dgKey); }}
              placeholder="dg_..."
              className="w-full px-3 py-2.5 bg-background/50 border border-secondary/[0.18] rounded-lg text-foreground text-sm font-mono outline-none focus:border-secondary/45 placeholder:text-muted-foreground/20"
            />
            <p className="text-[10px] text-muted-foreground/60 mt-1.5">
              When set, the mic uses Deepgram Nova-2 streaming. VAD also routes through Deepgram.
            </p>

            <label className="text-[9px] tracking-[0.18em] uppercase text-secondary mb-1 mt-3 block">
              Transcription Language
            </label>
            <select
              value={deepgramLang}
              onChange={e => saveDeepgramLang(e.target.value)}
              className="w-full px-3 py-2.5 bg-background/50 border border-secondary/[0.18] rounded-lg text-foreground text-sm outline-none focus:border-secondary/45"
            >
              <option value="en">English (en)</option>
              <option value="en-US">English — US (en-US)</option>
              <option value="en-GB">English — UK (en-GB)</option>
              <option value="es">Spanish (es)</option>
              <option value="es-419">Spanish — Latin America (es-419)</option>
              <option value="fr">French (fr)</option>
              <option value="fr-CA">French — Canada (fr-CA)</option>
              <option value="de">German (de)</option>
              <option value="it">Italian (it)</option>
              <option value="pt">Portuguese (pt)</option>
              <option value="pt-BR">Portuguese — Brazil (pt-BR)</option>
              <option value="nl">Dutch (nl)</option>
              <option value="hi">Hindi (hi)</option>
              <option value="ja">Japanese (ja)</option>
              <option value="ko">Korean (ko)</option>
              <option value="zh">Chinese (zh)</option>
              <option value="ru">Russian (ru)</option>
              <option value="pl">Polish (pl)</option>
              <option value="tr">Turkish (tr)</option>
              <option value="sv">Swedish (sv)</option>
              <option value="uk">Ukrainian (uk)</option>
              <option value="multi">Multilingual (auto-detect)</option>
            </select>
            <p className="text-[10px] text-muted-foreground/60 mt-1.5">
              Applies to both streaming mic and VAD batched transcription.
            </p>
          </div>
        </div>
      </div>

      {/* Web Search */}
      <div className="bg-card border border-accent/20 rounded-xl p-4 relative">
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl bg-gradient-to-r from-accent to-transparent" />
        <h3 className="text-[9px] tracking-[0.22em] uppercase text-accent mb-3">🌐 Web Search</h3>
        <Toggle k="websearch" label="Live Web Access" desc="Aria searches the web for current info" />
      </div>

      {/* Personality */}
      <div className="bg-card border border-border rounded-xl p-4 relative">
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl aria-gradient-rose" />
        <h3 className="text-[9px] tracking-[0.22em] uppercase text-secondary mb-3">🎭 Personality</h3>
        <Toggle k="proactive" label="Proactive Suggestions" desc="Safety & efficiency tips" />
        <Toggle k="learn" label="Auto-learn from Chat" desc="Extract and save facts you share" />
        <Toggle k="emotion" label="Emotional Awareness" desc="Read mood, adapt tone" />
      </div>

      {/* Camera */}
      <div className="bg-card border border-accent/20 rounded-xl p-4 relative">
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl bg-gradient-to-r from-accent to-transparent" />
        <h3 className="text-[9px] tracking-[0.22em] uppercase text-accent mb-3">📷 Camera & Vision</h3>
        <Toggle k="cam" label="Webcam Vision" desc="Aria can see you and your surroundings" />
        <Toggle k="autodesc" label="Auto-describe on Connect" desc="Aria comments when camera activates" />
      </div>

      {/* Danger Zone */}
      <div className="bg-card border border-destructive/20 rounded-xl p-4 relative">
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl bg-gradient-to-r from-destructive to-transparent" />
        <h3 className="text-[9px] tracking-[0.22em] uppercase text-destructive mb-3">⚠ Danger Zone</h3>
        <button onClick={() => { if (confirm('Erase ALL of Aria\'s data? This cannot be undone.')) nukeAll(); }}
          className="w-full py-2.5 rounded-lg border border-destructive/25 bg-destructive/[0.06] text-destructive text-xs tracking-wider uppercase">
          Clear All Data & Reset Aria
        </button>
      </div>
    </div>
  );
};
