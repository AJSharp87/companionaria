import { useState, useEffect } from 'react';
import { useAria } from '@/contexts/AriaContext';

interface RecallEntry {
  id: string;
  url: string;
  title: string;
  description: string;
  device_type: string;
  created_at: string;
}

export const WebIngestionPanel = () => {
  const { ingestUrl, searchRecall, toast } = useAria();
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecallEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'ingest' | 'recall'>('ingest');

  // Load all entries on mount and when tab switches to recall
  useEffect(() => {
    if (tab === 'recall') {
      searchRecall('').then(setResults);
    }
  }, [tab, searchRecall]);

  const handleIngest = async () => {
    if (!url.trim()) { toast('Enter a URL', 'err'); return; }
    setLoading(true);
    await ingestUrl(url);
    setUrl('');
    setLoading(false);
  };

  const handleSearch = async () => {
    const res = await searchRecall(query);
    setResults(res);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 md:px-5 py-3 border-b border-border flex items-center justify-between bg-background/85 backdrop-blur-xl flex-shrink-0">
        <h2 className="aria-serif text-base md:text-lg font-light text-aria-lav tracking-wider">Web Memory</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setTab('ingest')}
            className={`px-3 py-1 rounded-lg text-xs tracking-wider uppercase transition-all ${
              tab === 'ingest' ? 'bg-primary/15 border border-primary/35 text-primary' : 'text-muted-foreground'
            }`}
          >Ingest</button>
          <button
            onClick={() => setTab('recall')}
            className={`px-3 py-1 rounded-lg text-xs tracking-wider uppercase transition-all ${
              tab === 'recall' ? 'bg-secondary/15 border border-secondary/35 text-secondary' : 'text-muted-foreground'
            }`}
          >Recall</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4">
        {tab === 'ingest' ? (
          <div className="space-y-4">
            <p className="text-muted-foreground/40 text-sm aria-serif leading-relaxed">
              Feed Aria URLs to build her passive memory. She'll extract page titles and descriptions
              for instant recall later.
            </p>
            <div className="flex gap-2">
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleIngest()}
                placeholder="https://example.com/article"
                className="flex-1 px-3.5 py-3 bg-card/90 border border-secondary/[0.18] rounded-xl text-foreground text-sm font-mono outline-none transition-colors focus:border-secondary/40 placeholder:text-muted-foreground/20"
              />
              <button
                onClick={handleIngest}
                disabled={loading}
                className="px-4 py-3 rounded-xl border border-primary/35 bg-gradient-to-br from-primary/[0.13] to-secondary/[0.13] text-primary text-sm tracking-wider uppercase transition-all hover:from-primary/25 hover:to-secondary/25 disabled:opacity-50"
              >
                {loading ? '...' : '📥'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                value={query}
                onChange={e => { setQuery(e.target.value); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search Aria's web memory..."
                className="flex-1 px-3.5 py-3 bg-card/90 border border-secondary/[0.18] rounded-xl text-foreground text-sm outline-none transition-colors focus:border-secondary/40 placeholder:text-muted-foreground/20"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-3 rounded-xl border border-accent/30 bg-accent/10 text-accent text-sm transition-all"
              >🔍</button>
            </div>

            {results.length === 0 ? (
              <p className="text-muted-foreground/30 text-sm italic aria-serif text-center py-8">
                No web memories yet. Ingest some URLs first.
              </p>
            ) : (
              <div className="space-y-2">
                {results.map(r => (
                  <div key={r.id} className="px-3.5 py-2.5 bg-card/60 border border-border rounded-xl">
                    <a href={r.url} target="_blank" rel="noreferrer" className="text-secondary text-sm hover:underline truncate block">
                      {r.title || r.url}
                    </a>
                    {r.description && (
                      <p className="text-muted-foreground/40 text-xs mt-1 line-clamp-2">{r.description}</p>
                    )}
                    <div className="flex gap-2 mt-1.5 text-[8px] text-muted-foreground/20">
                      <span>{new Date(r.created_at).toLocaleDateString()}</span>
                      <span>{r.device_type}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
