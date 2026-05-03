import { useState } from 'react';
import { LensModePanel } from './LensModePanel';
import { FacePanel } from './FacePanel';

export const VisionPanel = () => {
  const [tab, setTab] = useState<'lens' | 'face'>('lens');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b border-border bg-background/85 backdrop-blur-xl flex-shrink-0">
        {(['lens', 'face'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-xs tracking-[0.18em] uppercase transition-all ${
              tab === t
                ? 'text-primary border-b-2 border-primary bg-primary/[0.04]'
                : 'text-muted-foreground/40 hover:text-muted-foreground/60'
            }`}
          >
            {t === 'lens' ? '👁 Object Lens' : '🔍 Face Mode'}
          </button>
        ))}
      </div>

      <div className={`flex-1 overflow-hidden ${tab === 'lens' ? '' : 'hidden'}`}>
        <LensModePanel hideHeader />
      </div>

      <div className={`flex-1 overflow-hidden ${tab === 'face' ? '' : 'hidden'}`}>
        <FacePanel hideHeader />
      </div>
    </div>
  );
};
