import { useState, useEffect } from 'react';
import { useAria } from '@/contexts/AriaContext';

export const ProfilePanel = () => {
  const { profile, saveProfile } = useAria();
  const [form, setForm] = useState(profile);

  useEffect(() => { setForm(profile); }, [profile]);

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
      <h2 className="aria-serif text-xl font-light text-aria-lav tracking-wider border-b border-border pb-3">Your Profile</h2>
      <p className="text-[11px] text-muted-foreground leading-relaxed">Tell Aria everything about you. Saved to Supabase — synced across all your devices.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { key: 'name', label: 'Your Name', placeholder: 'What should Aria call you?', full: false },
          { key: 'age', label: 'Age', placeholder: 'Your age', full: false },
          { key: 'location', label: 'Location', placeholder: 'City / Region', full: false },
          { key: 'job', label: 'Occupation', placeholder: 'What do you do?', full: false },
          { key: 'about', label: 'About You', placeholder: 'Your personality, values, habits...', full: true, ta: true },
          { key: 'hobbies', label: 'Interests & Hobbies', placeholder: 'What do you love?', full: true, ta: true },
          { key: 'goals', label: 'Goals & Priorities', placeholder: 'What are you working toward?', full: true, ta: true },
          { key: 'health', label: 'Health & Safety Notes', placeholder: 'Health conditions, medications...', full: true, ta: true },
          { key: 'style', label: 'How You Like to Be Treated', placeholder: 'Blunt honesty? Gentle?', full: true, ta: true },
        ].map(f => (
          <div key={f.key} className={f.full ? 'md:col-span-2' : ''}>
            <label className="text-[9px] tracking-[0.18em] uppercase text-secondary mb-1.5 block">{f.label}</label>
            {f.ta ? (
              <textarea value={(form as any)[f.key] || ''} onChange={e => update(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-3 py-2.5 bg-background/50 border border-secondary/[0.18] rounded-lg text-foreground aria-sans text-sm outline-none resize-y min-h-[70px] leading-relaxed transition-colors focus:border-secondary/45 placeholder:text-muted-foreground/20" />
            ) : (
              <input value={(form as any)[f.key] || ''} onChange={e => update(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-3 py-2.5 bg-background/50 border border-secondary/[0.18] rounded-lg text-foreground aria-sans text-sm outline-none transition-colors focus:border-secondary/45 placeholder:text-muted-foreground/20" />
            )}
          </div>
        ))}
        <div className="md:col-span-2">
          <button onClick={() => saveProfile(form)}
            className="w-full py-2.5 rounded-lg border border-primary/35 bg-primary/[0.09] text-primary aria-sans text-xs tracking-[0.16em] uppercase transition-all hover:bg-primary/20">
            ✦ Save Profile to Supabase
          </button>
        </div>
      </div>
    </div>
  );
};
