import { useState, useRef, useEffect } from 'react';
import { useAria } from '@/contexts/AriaContext';
import { AriaOrb } from './AriaOrb';

export const ChatPanel = () => {
  const {
    chatMsgs, sendMsg, toggleMic, toggleVoice, snapAndAsk, toggleCam, toggleSetting,
    settings, isListening, isSpeaking, camActive, currentAttachment, setAttachment,
    processFile, orbState, stopSpeak, toggleWakeWord, wakeWordActive,
    liveTranscript, toggleVAD, vadActive, profile,
  } = useAria();
  const [input, setInput] = useState('');
  const [orbVisible, setOrbVisible] = useState(true);
  const messagesRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs]);

  // Force scroll to bottom on initial mount (after layout paints)
  useEffect(() => {
    const t = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
    return () => clearTimeout(t);
  }, []);

  const handleSend = async () => {
    if (!input.trim() && !currentAttachment) return;
    const txt = input;
    setInput('');
    await sendMsg(txt);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Orb */}
      {orbVisible && (
        <div className="flex flex-col items-center py-4 border-b border-border/30 bg-background/60 backdrop-blur-xl flex-shrink-0">
          <AriaOrb size={80} />
          <p className="text-[8px] tracking-[0.22em] uppercase text-muted-foreground/60 mt-2 text-center min-h-[13px]">
            {orbState === 'thinking' ? 'Processing...'
              : orbState === 'speaking' ? 'Speaking...'
              : orbState === 'listening' ? 'Listening...'
              : profile.name ? `Online — ${profile.name}` : 'Initializing...'}
          </p>
        </div>
      )}
      <button
        onClick={() => setOrbVisible(v => !v)}
        className="w-full flex items-center justify-center py-1 border-b border-border/30 text-muted-foreground/20 hover:text-muted-foreground/40 transition-colors flex-shrink-0"
      >
        {orbVisible ? '▲ hide' : '▼ aria'}
      </button>

      {/* Header */}
      <div className="px-4 md:px-5 py-3 border-b border-border flex items-center justify-between bg-background/85 backdrop-blur-xl flex-shrink-0">
        <h2 className="aria-serif text-base md:text-lg font-light text-aria-lav tracking-wider">Conversation</h2>
        <div className="flex gap-1.5">
          <button onClick={() => toggleSetting('websearch')}
            className={`w-8 h-8 rounded-lg border text-sm flex items-center justify-center transition-all ${
              settings.websearch ? 'text-primary border-primary/35 bg-primary/[0.09]' : 'text-muted-foreground border-border bg-secondary/5'
            }`}>🌐</button>
          <button onClick={toggleVoice}
            className={`w-8 h-8 rounded-lg border text-sm flex items-center justify-center transition-all ${
              settings.voice ? 'text-primary border-primary/35 bg-primary/[0.09]' : 'text-muted-foreground border-border bg-secondary/5'
            }`}>{settings.voice ? '🔊' : '🔇'}</button>
          <button onClick={toggleCam}
            className={`w-8 h-8 rounded-lg border text-sm flex items-center justify-center transition-all ${
              camActive ? 'text-accent border-accent/35 bg-accent/10' : 'text-muted-foreground border-border bg-secondary/5'
            }`}>📷</button>
          <button onClick={toggleWakeWord}
            className={`w-8 h-8 rounded-lg border text-sm flex items-center justify-center transition-all ${
              wakeWordActive ? 'text-aria-safe border-aria-safe/35 bg-aria-safe/10 animate-pulse' : 'text-muted-foreground border-border bg-secondary/5'
            }`} title="Wake Word">👂</button>
          <button onClick={toggleVAD}
            className={`w-8 h-8 rounded-lg border text-sm flex items-center justify-center transition-all ${
              vadActive ? 'text-accent border-accent/35 bg-accent/10 animate-pulse' : 'text-muted-foreground border-border bg-secondary/5'
            }`} title="Voice Activity Detection">🫀</button>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-5 py-4 flex flex-col gap-4 min-h-0">
        {orbState === 'thinking' && chatMsgs.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground/30 text-sm">
            Loading...
          </div>
        )}
        {chatMsgs.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 max-w-full aria-fade-up ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] aria-serif ${
              msg.role === 'user'
                ? 'bg-gradient-to-br from-aria-gold/20 to-secondary/10 border border-aria-gold/25 text-aria-gold text-[8px] tracking-wide'
                : 'shadow-[0_0_10px_rgba(192,132,252,0.35)]'
            }`}
              style={msg.role !== 'user' ? { background: 'radial-gradient(circle at 35% 35%, #ffb3c6, #c084fc 50%, #4a0080)' } : undefined}
            >
              {msg.role === 'user' ? 'YOU' : ''}
            </div>
            <div className="max-w-[calc(100%-40px)]">
              <div className={`text-[8px] tracking-[0.18em] uppercase mb-1 px-0.5 ${msg.role === 'user' ? 'text-aria-gold text-right' : 'text-secondary'}`}>
                {msg.role === 'user' ? 'You' : 'Aria'}
              </div>
              <div className={`px-3.5 py-2.5 aria-serif text-[15px] leading-relaxed font-light ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-aria-gold/[0.08] to-secondary/[0.06] border border-aria-gold/15 rounded-xl rounded-tr-sm text-foreground'
                  : `bg-gradient-to-br from-[rgba(24,15,45,0.96)] to-[rgba(18,9,36,0.96)] border rounded-xl rounded-tl-sm text-aria-lav ${
                    msg.type === 'safety' ? 'border-destructive/35' : msg.type === 'vision' ? 'border-accent/25' : 'border-secondary/[0.13]'
                  }`
              }`}>
                {msg.role !== 'user' && msg.type === 'suggestion' && (
                  <div className="text-[9px] tracking-wider uppercase text-aria-gold aria-sans mb-1.5 flex items-center gap-1">◆ Aria suggests</div>
                )}
                {msg.role !== 'user' && msg.type === 'safety' && (
                  <div className="text-[9px] tracking-wider uppercase text-destructive aria-sans mb-1.5 flex items-center gap-1">⚠ Safety Note</div>
                )}
                {msg.role !== 'user' && msg.type === 'vision' && (
                  <div className="text-[9px] tracking-wider uppercase text-accent aria-sans mb-1.5 flex items-center gap-1">📷 Aria sees</div>
                )}
                <div className="whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>{msg.content}</div>
              </div>
              <div className="flex gap-1.5 items-center mt-1 px-0.5">
                <span className="text-[8px] text-muted-foreground/20">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}
        {orbState === 'thinking' && chatMsgs.length > 0 && (
          <div className="flex gap-2.5 self-start aria-fade-up">
            <div className="w-8 h-8 rounded-full flex-shrink-0"
              style={{ background: 'radial-gradient(circle at 35% 35%, #ffb3c6, #c084fc 50%, #4a0080)' }} />
            <div className="px-4 py-3 bg-card/60 border border-border rounded-xl rounded-tl-sm flex items-center gap-1.5">
              {[0, 0.2, 0.4].map((d, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-secondary/30"
                  style={{ animation: `aria-think-dot 1.2s ${d}s ease-in-out infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Attachment bar */}
      {currentAttachment && (
        <div className="px-4 md:px-5 py-1.5 flex gap-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary/10 border border-secondary/25 rounded-full text-xs text-aria-lav">
            <span className="text-[9px] uppercase tracking-wider text-secondary">{currentAttachment.type === 'image' ? '🖼' : '📄'}</span>
            <span className="max-w-[200px] truncate">{currentAttachment.name}</span>
            <button onClick={() => setAttachment(null)} className="text-muted-foreground hover:text-destructive">✕</button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 md:px-5 py-3 border-t border-border bg-background/90 backdrop-blur-xl flex-shrink-0">
        <div className="flex gap-2 items-end">
          <button onClick={toggleMic}
            className={`w-11 h-11 rounded-xl flex-shrink-0 border text-base flex items-center justify-center transition-all ${
              isListening
                ? 'bg-accent/15 border-accent/60 shadow-[0_0_20px_rgba(165,243,252,0.35)] text-accent animate-[aria-mic-pulse_1s_ease-in-out_infinite]'
                : 'border-accent/20 bg-accent/[0.04] text-accent/50'
            }`}>🎤</button>
          <textarea
            value={liveTranscript || input}
            onChange={e => { if (!liveTranscript) setInput(e.target.value); }}
            onKeyDown={handleKey}
            placeholder="Speak to Aria..."
            rows={1}
            className={`flex-1 bg-card/90 border rounded-xl px-3.5 py-3 text-foreground aria-serif text-[15px] font-light resize-none outline-none min-h-[46px] max-h-[130px] leading-relaxed transition-colors focus:shadow-[0_0_0_3px_rgba(192,132,252,0.05)] placeholder:text-muted-foreground/20 placeholder:italic ${
              liveTranscript ? 'border-accent/60 shadow-[0_0_0_3px_rgba(165,243,252,0.08)]' : 'border-secondary/[0.18] focus:border-secondary/40'
            }`}
            onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
          />
          <button onClick={() => fileRef.current?.click()}
            className={`w-11 h-11 rounded-xl flex-shrink-0 border text-base flex items-center justify-center transition-all ${
              currentAttachment ? 'text-secondary border-secondary/50 bg-secondary/15' : 'border-secondary/20 bg-secondary/5 text-secondary/50'
            }`}>📎</button>
          <input ref={fileRef} type="file" className="hidden" accept=".txt,.md,.csv,.json,.pdf,.docx,.png,.jpg,.jpeg,.gif,.webp"
            onChange={e => { if (e.target.files?.[0]) { processFile(e.target.files[0], true); e.target.value = ''; } }} />
          <button onClick={() => snapAndAsk(input || undefined)}
            className="w-11 h-11 rounded-xl flex-shrink-0 border border-accent/15 bg-accent/[0.03] text-accent/35 text-base flex items-center justify-center transition-all hover:text-accent hover:border-accent/50">
            👁
          </button>
          <button onClick={handleSend}
            disabled={!input.trim() && !liveTranscript && !currentAttachment}
            className="w-11 h-11 rounded-xl flex-shrink-0 border border-primary/35 bg-gradient-to-br from-primary/[0.13] to-secondary/[0.13] text-primary text-base flex items-center justify-center transition-all hover:from-primary/25 hover:to-secondary/25 hover:shadow-[0_0_16px_rgba(255,107,157,0.25)] hover:-translate-y-px disabled:opacity-30 disabled:pointer-events-none">
            ➤
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/15 tracking-wide text-center mt-1.5">
          Enter to send · Shift+Enter new line · 🎤 voice · 📎 attach · 👁 camera
        </p>
      </div>

      {/* Stop button */}
      {isSpeaking && (
        <button onClick={stopSpeak}
          className="fixed bottom-7 left-1/2 -translate-x-1/2 z-[3000] flex items-center gap-2 px-7 py-3 rounded-full cursor-pointer bg-gradient-to-br from-destructive/90 to-[rgba(192,60,120,0.88)] border border-primary/60 shadow-[0_8px_32px_rgba(255,71,87,0.45)] text-foreground aria-sans text-sm font-medium tracking-[0.18em] uppercase backdrop-blur-xl hover:brightness-110">
          ⏹ Stop
        </button>
      )}
    </div>
  );
};
