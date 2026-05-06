import { useRef } from 'react';
import { useAria } from '@/contexts/AriaContext';

export const FilesPanel = () => {
  const { processFile, setActivePanel } = useAria();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) processFile(f, false);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
    <div className="flex-1 overflow-y-auto min-h-0 p-5 flex flex-col gap-4">
      <h2 className="aria-serif text-xl font-light text-aria-lav tracking-wider border-b border-border pb-3">Files & Images</h2>
      <p className="text-[11px] text-muted-foreground leading-relaxed">Drop any file here — Aria can read documents, edit text, and describe images.</p>

      <div className="border-2 border-dashed border-secondary/25 rounded-xl p-7 text-center cursor-pointer transition-all hover:border-secondary/60 hover:bg-secondary/[0.07] relative"
        onDragOver={e => e.preventDefault()} onDrop={handleDrop} onClick={() => fileRef.current?.click()}>
        <input ref={fileRef} type="file" className="hidden" accept=".txt,.md,.csv,.json,.pdf,.docx,.png,.jpg,.jpeg,.gif,.webp"
          onChange={e => { if (e.target.files?.[0]) { processFile(e.target.files[0], false); e.target.value = ''; } }} />
        <div className="text-3xl mb-2">📂</div>
        <div className="text-sm text-muted-foreground"><strong>Drop a file here</strong> or click to browse</div>
        <div className="text-[10px] text-muted-foreground/25 mt-1 tracking-wider">TXT · MD · CSV · JSON · PDF · DOCX · PNG · JPG · WEBP</div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 relative">
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl aria-gradient-rose" />
        <h3 className="text-[9px] tracking-[0.22em] uppercase text-secondary mb-2">📎 Quick Attach to Chat</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed">Use the paperclip 📎 button in the chat input to attach any file directly to your message.</p>
        <button onClick={() => setActivePanel('chat')}
          className="mt-3 px-4 py-2 rounded-lg border border-secondary/30 bg-secondary/[0.07] text-secondary text-xs tracking-wider uppercase">
          ← Go to Chat
        </button>
      </div>
    </div>
    </div>
  );
};
