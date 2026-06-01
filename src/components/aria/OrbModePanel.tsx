import { useState } from 'react';
import { useAria } from '@/contexts/AriaContext';
import { AriaLive2D } from './AriaLive2D';

export const OrbModePanel = () => {
  const { orbState, profile, isListening, isSpeaking, toggleMic, sendMsg, setActivePanel, stopSpeak } = useAria();
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    const txt = input;
    setInput('');
    sendMsg(txt);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-10 bg-gradient-to-b from-background to-[rgba(8,4,18,1)]">
      <AriaLive2D size={280} mode="full" devMode={true} />

      <p className="aria-serif text-xl font-light tracking-[0.18em] text-foreground/75 text-center min-h-[30px]">
        {orbState === 'thinking' ? 'Thinking...'
          : orbState === 'speaking' ? 'Speaking...'
          : orbState === 'listening' ? 'Listening...'
          : profile.name ? `Hey, ${profile.name}` : "I'm ready"}
      </p>

      {(isSpeaking || orbState === 'listening') && (
        <div className="flex items-center gap-[3px] h-9">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="w-[3px] rounded-sm bg-foreground/60"
              style={{ height: 4, animation: `aria-wv 0.5s ${i * 0.04}s ease-in-out infinite alternate`, ['--h' as any]: `${12 + Math.sin(i) * 14}px` }} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={toggleMic}
          className={`w-14 h-14 rounded-full border text-xl flex items-center justify-center transition-all ${
            isListening
              ? 'bg-accent/15 border-accent/70 shadow-[0_0_28px_rgba(165,243,252,0.4)] text-accent animate-[aria-mic-pulse_1s_ease-in-out_infinite]'
              : 'border-accent/25 bg-accent/[0.06] text-accent/60'
          }`}>🎤</button>
      </div>

      <div className="flex gap-2.5 items-end w-full max-w-[480px]">
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Or type here..."
          rows={1}
          className="flex-1 bg-card/90 border border-secondary/[0.18] rounded-xl px-3.5 py-3 text-foreground aria-serif text-[15px] font-light resize-none outline-none min-h-[46px] max-h-[100px] leading-relaxed focus:border-secondary/40 placeholder:text-muted-foreground/20 placeholder:italic"
          onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }} />
        <button onClick={handleSend}
          className="w-12 h-12 rounded-xl flex-shrink-0 border border-primary/35 bg-gradient-to-br from-primary/[0.13] to-secondary/[0.13] text-primary text-lg flex items-center justify-center transition-all hover:from-primary/25 hover:to-secondary/25 hover:shadow-[0_0_18px_rgba(255,107,157,0.3)]">
          ➤
        </button>
      </div>

      <button onClick={() => setActivePanel('chat')}
        className="px-6 py-2.5 rounded-3xl border border-secondary/25 bg-secondary/[0.07] text-secondary text-xs tracking-[0.2em] uppercase transition-all hover:bg-secondary/15 hover:border-secondary/50">
        ← Back to Chat
      </button>

      {isSpeaking && (
        <button onClick={stopSpeak}
          className="fixed bottom-7 left-1/2 -translate-x-1/2 z-[3000] flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-br from-destructive/90 to-[rgba(192,60,120,0.88)] border border-primary/60 shadow-[0_8px_32px_rgba(255,71,87,0.45)] text-foreground text-sm tracking-[0.18em] uppercase">
          ⏹ Stop
        </button>
      )}
    </div>
  );
};
