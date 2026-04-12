import { useState, useEffect } from 'react';
import { useAria } from '@/contexts/AriaContext';

export const MemoryPanel = () => {
  const { memory, addMemory, delMemory, loadHistory, addPerson } = useAria();
  const [tab, setTab] = useState<'facts' | 'history' | 'people'>('facts');
  const [mk, setMk] = useState('');
  const [mv, setMv] = useState('');
  const [histSearch, setHistSearch] = useState('');
  const [histItems, setHistItems] = useState<any[]>([]);
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');

  useEffect(() => {
    if (tab === 'history') loadHistory(histSearch).then(setHistItems);
  }, [tab, histSearch, loadHistory]);

  const memEntries = Object.entries(memory).filter(([k]) => !k.startsWith('_'));
  const peopleKeys = ['introduced_people', 'friends', 'family', 'coworkers'];

  return (
    <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
      <h2 className="aria-serif text-xl font-light text-aria-lav tracking-wider border-b border-border pb-3">Aria's Memory</h2>
      <p className="text-[11px] text-muted-foreground leading-relaxed">Everything Aria knows — persistent across every session.</p>

      <div className="flex gap-1.5 border-b border-border pb-2.5">
        {(['facts', 'history', 'people'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs tracking-wider uppercase transition-all border ${
              tab === t ? 'border-secondary/30 bg-secondary/[0.07] text-secondary' : 'border-border text-muted-foreground'
            }`}>
            {t === 'facts' ? '🧠 Facts' : t === 'history' ? '💬 History' : '👥 People'}
          </button>
        ))}
      </div>

      {tab === 'facts' && (
        <>
          <div className="flex gap-2">
            <input value={mk} onChange={e => setMk(e.target.value)} placeholder="Category"
              className="w-[140px] flex-shrink-0 px-3 py-2.5 bg-background/50 border border-secondary/[0.18] rounded-lg text-foreground text-sm outline-none focus:border-secondary/45 placeholder:text-muted-foreground/20" />
            <input value={mv} onChange={e => setMv(e.target.value)} placeholder="What Aria knows..."
              className="flex-1 px-3 py-2.5 bg-background/50 border border-secondary/[0.18] rounded-lg text-foreground text-sm outline-none focus:border-secondary/45 placeholder:text-muted-foreground/20" />
            <button onClick={() => { addMemory(mk, mv); setMk(''); setMv(''); }}
              className="px-4 py-2.5 rounded-lg border border-secondary/30 bg-secondary/[0.07] text-secondary text-xs tracking-wider uppercase">+ Add</button>
          </div>
          <div className="flex flex-col gap-1.5">
            {memEntries.map(([k, v]) => (
              <div key={k} className="bg-card/75 border border-border rounded-lg px-3 py-2.5 relative aria-fade-up">
                <div className="text-[8px] tracking-[0.18em] uppercase text-secondary mb-0.5">{k}</div>
                <div className="aria-serif text-sm text-aria-lav font-light">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                <button onClick={() => delMemory(k)}
                  className="absolute top-2 right-2 text-muted-foreground/15 hover:text-destructive text-xs">✕</button>
              </div>
            ))}
            {memEntries.length === 0 && <p className="text-muted-foreground/30 aria-serif italic text-sm py-4">No memories yet. Aria learns through conversation.</p>}
          </div>
        </>
      )}

      {tab === 'history' && (
        <>
          <div className="flex gap-2">
            <input value={histSearch} onChange={e => setHistSearch(e.target.value)} placeholder="Search conversations..."
              className="flex-1 px-3 py-2.5 bg-background/50 border border-secondary/[0.18] rounded-lg text-foreground text-sm outline-none focus:border-secondary/45 placeholder:text-muted-foreground/20" />
          </div>
          <div className="text-[9px] text-muted-foreground/40 tracking-wide">Last 2,000 messages stored</div>
          <div className="flex flex-col gap-2">
            {histItems.slice(0, 40).map((r, i) => (
              <div key={i} className="bg-card/75 border border-border rounded-lg px-3 py-2.5 cursor-pointer hover:border-secondary/30 transition-colors">
                <div className={`text-[8px] tracking-[0.18em] uppercase mb-1 ${r.role === 'user' ? 'text-aria-gold' : 'text-secondary'}`}>
                  {r.role === 'user' ? 'You' : 'Aria'}
                </div>
                <div className="aria-serif text-sm text-aria-lav font-light leading-relaxed">{r.content?.substring(0, 140)}{r.content?.length > 140 ? '…' : ''}</div>
                <div className="text-[8px] text-muted-foreground/20 mt-1">
                  {r.created_at ? new Date(r.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
            ))}
            {histItems.length === 0 && <p className="text-muted-foreground/30 text-sm py-4">No messages found.</p>}
          </div>
        </>
      )}

      {tab === 'people' && (
        <>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            People Aria has been introduced to. Say <em className="text-aria-lav">"Aria, meet [name]"</em> in conversation.
          </p>
          <div className="flex flex-col gap-1.5">
            {peopleKeys.map(k => memory[k] ? (
              <div key={k} className="bg-card/75 border border-border rounded-lg px-3 py-2.5 flex justify-between">
                <div>
                  <div className="aria-serif text-sm text-aria-lav font-light">{k.replace('_', ' ')}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{String(memory[k]).substring(0, 200)}</div>
                </div>
                <button onClick={() => delMemory(k)} className="text-muted-foreground/15 hover:text-destructive text-xs">✕</button>
              </div>
            ) : null)}
            {!peopleKeys.some(k => memory[k]) && <p className="text-muted-foreground/30 aria-serif italic text-sm py-4">No people in memory yet.</p>}
          </div>
          <div className="flex gap-2 mt-2">
            <input value={pName} onChange={e => setPName(e.target.value)} placeholder="Name"
              className="w-[120px] flex-shrink-0 px-3 py-2.5 bg-background/50 border border-secondary/[0.18] rounded-lg text-foreground text-sm outline-none focus:border-secondary/45 placeholder:text-muted-foreground/20" />
            <input value={pDesc} onChange={e => setPDesc(e.target.value)} placeholder="Who are they?"
              className="flex-1 px-3 py-2.5 bg-background/50 border border-secondary/[0.18] rounded-lg text-foreground text-sm outline-none focus:border-secondary/45 placeholder:text-muted-foreground/20" />
            <button onClick={() => { addPerson(pName, pDesc); setPName(''); setPDesc(''); }}
              className="px-4 py-2.5 rounded-lg border border-secondary/30 bg-secondary/[0.07] text-secondary text-xs tracking-wider uppercase">+ Add</button>
          </div>
        </>
      )}
    </div>
  );
};
