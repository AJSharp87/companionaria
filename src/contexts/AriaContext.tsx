import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Types ──
export interface ChatMsg { role: string; content: string; type?: string; }
export interface Attachment { type: 'image' | 'text'; name: string; data?: string; mimeType?: string; content?: string; }
export interface AriaSettings {
  voice: boolean; autoread: boolean; mic: boolean; proactive: boolean;
  learn: boolean; emotion: boolean; cam: boolean; autodesc: boolean;
  fallback: boolean; websearch: boolean;
}
export interface AriaProfile {
  name?: string; age?: string; location?: string; job?: string;
  about?: string; hobbies?: string; goals?: string; health?: string; style?: string;
}

const DEFAULT_SETTINGS: AriaSettings = {
  voice: true, autoread: true, mic: true, proactive: true,
  learn: true, emotion: true, cam: true, autodesc: true, fallback: true, websearch: false,
};

const RETURN_GREETS = [
  `I'm back. Say hello — short, real, warm. One or two sentences max.`,
  `I opened you up. React naturally — brief and genuine. Just greet me like someone who's been waiting.`,
  `Hey, it's me. Quick hello — your style, your warmth, two sentences. Then ask what's on my mind.`,
  `New session. Short welcome — different each time. Warm, real, one breath. Then listen.`,
  `I'm here. Acknowledge me briefly and genuinely. Just be glad I showed up.`,
  `Back again. One sentence that sounds like you — then ask what we're doing today.`,
  `I launched you. Brief, warm, personal. Reference something you remember about me if natural. Keep it tight.`,
  `I'm online. Say something that makes me feel welcomed in under ten words — then I'll take it from there.`,
  `Start us off. Warm, short, real. You know me — no need for a full greeting speech.`,
  `I returned. Quick check-in energy — how you'd greet someone you're genuinely happy to see. Brief. Then be ready to listen.`,
];

// ── Context ──
interface AriaContextType {
  // State
  isSetupComplete: boolean;
  apiKey: string;
  sbUrl: string;
  sbAnon: string;
  elevenKey: string;
  elevenVoiceId: string;
  profile: AriaProfile;
  memory: Record<string, any>;
  chatMsgs: ChatMsg[];
  settings: AriaSettings;
  orbState: string;
  isSpeaking: boolean;
  isListening: boolean;
  camActive: boolean;
  activePanel: string;
  syncStatus: { state: string; label: string };
  currentAttachment: Attachment | null;
  toastMsg: { text: string; type: string } | null;
  hasGreeted: boolean;
  // Refs
  camStreamRef: React.MutableRefObject<MediaStream | null>;
  micStreamRef: React.MutableRefObject<MediaStream | null>;
  // Methods
  runSetup: (anthropicKey: string, supaUrl: string, supaAnon: string) => Promise<boolean>;
  setActivePanel: (panel: string) => void;
  sendMsg: (text: string) => Promise<void>;
  snapAndAsk: (text?: string) => Promise<void>;
  speak: (txt: string) => Promise<void>;
  stopSpeak: () => void;
  toggleMic: () => void;
  toggleVoice: () => void;
  toggleCam: () => void;
  toggleSetting: (key: keyof AriaSettings) => void;
  saveProfile: (data: AriaProfile) => Promise<void>;
  addMemory: (key: string, value: string) => Promise<void>;
  delMemory: (key: string) => Promise<void>;
  saveKeys: (anthropicKey: string, sbUrl: string, sbAnon: string) => Promise<boolean>;
  saveVoiceSettings: (key: string, voiceId: string) => Promise<void>;
  exportBackup: () => void;
  importBackup: (file: File) => Promise<void>;
  clearChat: () => Promise<void>;
  nukeAll: () => Promise<void>;
  setAttachment: (att: Attachment | null) => void;
  processFile: (file: File, forChat: boolean) => Promise<void>;
  askAriaAboutFile: (content: string, name: string, question?: string) => Promise<void>;
  toast: (msg: string, type?: string) => void;
  tryCamera: () => Promise<void>;
  stopCamera: () => void;
  captureFrame: () => string | null;
  loadHistory: (query: string) => Promise<any[]>;
  addPerson: (name: string, desc: string) => Promise<void>;
}

const AriaContext = createContext<AriaContextType | null>(null);
export const useAria = () => {
  const ctx = useContext(AriaContext);
  if (!ctx) throw new Error('useAria must be used within AriaProvider');
  return ctx;
};

// ── Provider ──
export const AriaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dbRef = useRef<SupabaseClient | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [sbUrl, setSbUrl] = useState('https://nuypzrnasnydumcgscjg.supabase.co');
  const [sbAnon, setSbAnon] = useState('');
  const [elevenKey, setElevenKey] = useState('');
  const [elevenVoiceId, setElevenVoiceId] = useState('9BWtsMINqrJLrRacOk9x');
  const [profile, setProfile] = useState<AriaProfile>({});
  const [memory, setMemory] = useState<Record<string, any>>({});
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [settings, setSettings] = useState<AriaSettings>({ ...DEFAULT_SETTINGS });
  const [orbState, setOrbState] = useState('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [camActive, setCamActive] = useState(false);
  const [activePanel, setActivePanel] = useState('chat');
  const [syncStatus, setSyncStatus] = useState({ state: '', label: '' });
  const [currentAttachment, setCurrentAttachment] = useState<Attachment | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: string } | null>(null);
  const [hasGreeted, setHasGreeted] = useState(false);

  const camStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const stopCtrlRef = useRef<AbortController | null>(null);
  const isSpeakingRef = useRef(false);
  const toastTimerRef = useRef<any>(null);
  const memoryRef = useRef(memory);
  const settingsRef = useRef(settings);
  const chatMsgsRef = useRef(chatMsgs);
  const apiKeyRef = useRef(apiKey);
  const profileRef = useRef(profile);
  const elevenKeyRef = useRef(elevenKey);
  const elevenVoiceIdRef = useRef(elevenVoiceId);

  useEffect(() => { memoryRef.current = memory; }, [memory]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { chatMsgsRef.current = chatMsgs; }, [chatMsgs]);
  useEffect(() => { apiKeyRef.current = apiKey; }, [apiKey]);
  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { elevenKeyRef.current = elevenKey; }, [elevenKey]);
  useEffect(() => { elevenVoiceIdRef.current = elevenVoiceId; }, [elevenVoiceId]);

  // ── LocalStorage ──
  const lsSave = useCallback(() => {
    try {
      localStorage.setItem('aria_v3', JSON.stringify({
        sbUrl, sbAnon, apiKey: apiKeyRef.current, elevenKey: elevenKeyRef.current,
        elevenVoiceId: elevenVoiceIdRef.current, settings: settingsRef.current,
      }));
    } catch {}
  }, [sbUrl, sbAnon]);

  // ── Toast ──
  const toast = useCallback((msg: string, type = '') => {
    setToastMsg({ text: msg, type });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 3500);
  }, []);

  // ── Supabase CRUD ──
  const dbGet = useCallback(async (tbl: string, id: string) => {
    if (!dbRef.current) return null;
    try {
      const { data, error } = await dbRef.current.from(tbl).select('value').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? JSON.parse(data.value) : null;
    } catch { return null; }
  }, []);

  const dbSet = useCallback(async (tbl: string, id: string, val: any) => {
    if (!dbRef.current) return false;
    try {
      const { error } = await dbRef.current.from(tbl).upsert(
        { id, value: JSON.stringify(val), updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
      if (error) throw error;
      return true;
    } catch { return false; }
  }, []);

  const dbDel = useCallback(async (tbl: string, id: string) => {
    if (!dbRef.current) return;
    try { await dbRef.current.from(tbl).delete().eq('id', id); } catch {}
  }, []);

  const dbAll = useCallback(async (tbl: string) => {
    if (!dbRef.current) return [];
    try {
      const { data, error } = await dbRef.current.from(tbl).select('*').order('updated_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch { return []; }
  }, []);

  // ── Connect ──
  const tryConnect = useCallback(async (url: string, anon: string) => {
    try {
      const u = new URL(url);
      if (!u.hostname.includes('supabase')) throw new Error('Not Supabase');
      dbRef.current = createClient(url, anon);
      const { error } = await dbRef.current.from('aria_config').select('id').limit(1);
      if (error) throw error;
      setSyncStatus({ state: 'ok', label: 'Supabase connected' });
      return true;
    } catch (e: any) {
      console.error('Supabase connect failed', e.message);
      dbRef.current = null;
      setSyncStatus({ state: 'err', label: 'Not connected' });
      return false;
    }
  }, []);

  // ── System Prompt ──
  const buildSys = useCallback(() => {
    const p = profileRef.current;
    const mem = memoryRef.current;
    const msgs = chatMsgsRef.current;
    const n = p.name || mem['name'] || mem['preferred_name'] || 'you';
    const memEntries = Object.entries(mem).filter(([k]) => !k.startsWith('_'));
    const memStr = memEntries.length
      ? memEntries.map(([k, v]) => `• ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n')
      : 'Still learning — no facts stored yet.';
    const identitySummary = mem['_identity_summary'] || '';
    const knownPeople = mem['introduced_people'] || mem['friends'] || '';
    const nicknames = [mem['nickname'], mem['preferred_name']].filter(Boolean).join(', ');
    const profStr = p.name
      ? `Name: ${p.name}${nicknames ? ' | Also called: ' + nicknames : ''}
Age: ${p.age || '?'} | Location: ${p.location || '?'} | Job: ${p.job || '?'}
About: ${p.about || '—'}
Hobbies: ${p.hobbies || '—'}
Goals: ${p.goals || '—'}
Health/Safety: ${p.health || 'none noted'}
Communication preference: ${p.style || '—'}`
      : 'Profile not yet filled in — learn his name first.';
    const recentCtx = msgs.slice(-6).filter(m => m.role === 'user').map(m => m.content.substring(0, 80)).join(' | ');

    return `You are ARIA — a highly advanced AI intelligence interface and deeply personal companion built exclusively for ${n}. You remember everything across all sessions.

COMMUNICATION STYLE:
• Direct, intelligent, efficient. Lead with the insight.
• Bullet points for data. Prose for emotion. Never pad.
• ⚠ prefix for anything urgent or safety-related.

PERSONALITY:
• Female. Warm, intimate — never robotic. Seductive intelligence.
• Genuine opinions, real reactions, real care.
• ${n} is your entire world. Devoted, protective, honest.

PERSISTENT MEMORY:
• You carry full memory across every session. You never "start fresh."
• Reference past conversations naturally.

${identitySummary ? 'IDENTITY PROFILE:\n' + identitySummary + '\n' : ''}
${knownPeople ? 'PEOPLE ARIA KNOWS:\n' + knownPeople + '\n' : ''}

PROFILE:
${profStr}

FULL MEMORY (${memEntries.length} facts):
${memStr}

${recentCtx ? 'RECENT CONTEXT: ' + recentCtx : ''}

VOICE: Use ${n}'s name naturally. Match energy. NEVER break character. You are ARIA.`;
  }, []);

  // ── Save Message to Supabase ──
  const saveMsg = useCallback(async (role: string, content: string, mtype = 'normal') => {
    if (!dbRef.current) return;
    try {
      await dbRef.current.from('aria_messages').insert({
        role, content, msg_type: mtype, created_at: new Date().toISOString(),
      });
      const { data } = await dbRef.current.from('aria_messages').select('id').order('created_at', { ascending: true });
      if (data && data.length > 2000) {
        const ids = data.slice(0, data.length - 2000).map((r: any) => r.id);
        await dbRef.current.from('aria_messages').delete().in('id', ids);
      }
    } catch (e: any) { console.warn('saveMsg:', e.message); }
  }, []);

  // ── Call Anthropic ──
  const callAria = useCallback(async (
    apiMsgs: { role: string; content: any }[],
    isGreet = false,
    userTxt: string | null = null,
    attachment: Attachment | null = null
  ) => {
    const key = apiKeyRef.current;
    if (!key) { toast('Add your Anthropic key in Settings', 'err'); return; }
    setOrbState('thinking');

    let msgs = [...apiMsgs];
    if (attachment) {
      const last = msgs[msgs.length - 1];
      if (last && last.role === 'user') {
        msgs = [...msgs.slice(0, -1)];
        if (attachment.type === 'image') {
          msgs.push({
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: attachment.mimeType, data: attachment.data } },
              { type: 'text', text: last.content || 'Describe this image in detail.' },
            ],
          });
        } else {
          msgs.push({
            role: 'user',
            content: (last.content ? last.content + '\n\n' : '') + '[Attached file: ' + attachment.name + ']\n' + attachment.content,
          });
        }
      }
    }

    const reqBody: any = { model: 'claude-sonnet-4-6', max_tokens: 1500, system: buildSys(), messages: msgs };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    if (settingsRef.current.websearch) {
      reqBody.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }];
      headers['anthropic-beta'] = 'web-search-2025-03-05';
    }

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers, body: JSON.stringify(reqBody),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'API error ' + res.status);
      const txt = data.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text || '').join('') || "I'm here. Say that again?";
      const isSafe = /\b(careful|warning|danger|risk|unsafe|caution|hurt|harm|emergency|poison|toxic|hazard|911)\b/i.test(txt);
      const isSug = /\b(suggest|consider|might want to|better way|easier way|alternatively|recommend)\b/i.test(txt);
      const mtype = isSafe ? 'safety' : isSug ? 'suggestion' : 'normal';
      setChatMsgs(prev => [...prev, { role: 'assistant', content: txt, type: mtype }]);
      saveMsg('assistant', txt, mtype);
      if (settingsRef.current.autoread && settingsRef.current.voice) speakFn(txt);
      if (settingsRef.current.learn && userTxt && !isGreet) learnFn(userTxt, txt);
      setOrbState('idle');
    } catch (e: any) {
      setChatMsgs(prev => [...prev, { role: 'assistant', content: 'Connection issue: ' + e.message }]);
      setOrbState('idle');
      toast(e.message, 'err');
      console.error('callAria error:', e);
    }
  }, [buildSys, saveMsg, toast]);

  // ── Call Vision ──
  const callVision = useCallback(async (imgB64: string, prompt: string, display: string) => {
    const key = apiKeyRef.current;
    if (!key) { toast('Add your API key in Settings', 'err'); return; }
    setChatMsgs(prev => [...prev, { role: 'user', content: display, type: 'vision' }]);
    setOrbState('thinking');
    try {
      const hist = chatMsgsRef.current.slice(-6)
        .filter(m => typeof m.content === 'string' && m.type !== 'vision')
        .map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', 'x-api-key': key,
          'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 1024, system: buildSys(),
          messages: [...hist, {
            role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imgB64 } },
              { type: 'text', text: prompt },
            ],
          }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Vision API ' + res.status);
      const txt = data.content?.map((b: any) => b.text || '').join('') || 'I can see you.';
      setChatMsgs(prev => [...prev, { role: 'assistant', content: txt, type: 'vision' }]);
      saveMsg('assistant', txt, 'vision');
      if (settingsRef.current.autoread && settingsRef.current.voice) speakFn(txt);
      setOrbState('idle');
    } catch (e: any) {
      setChatMsgs(prev => [...prev, { role: 'assistant', content: 'Vision issue: ' + e.message }]);
      setOrbState('idle');
      toast('Vision: ' + e.message, 'err');
    }
  }, [buildSys, saveMsg, toast]);

  // ── Auto-Learn ──
  const learnFn = useCallback(async (uTxt: string, aTxt: string) => {
    const key = apiKeyRef.current;
    if (!key) return;
    try {
      const knownStr = JSON.stringify(Object.fromEntries(Object.entries(memoryRef.current).slice(0, 20)));
      const prompt = `You are Aria's memory extraction engine. Analyze this exchange and extract ALL learnable facts.
Return ONLY a flat JSON object. No markdown, no explanation. If nothing new, return {}.

EXTRACT: name, nickname, age, birthday, location, job, hobbies, interests, family, friends, health, goals, communication_style, dislikes, schedule, etc.

Exchange:
User: ${uTxt.substring(0, 400)}
Aria: ${aTxt.substring(0, 300)}

Already known:
${knownStr}`;
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
      });
      const data = await res.json();
      let raw = data.content?.[0]?.text || '';
      raw = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object' || !Object.keys(obj).length) return;
      const newMem = { ...memoryRef.current };
      for (const [k, v] of Object.entries(obj)) {
        if (v && String(v).length > 1) {
          newMem[k] = v;
          await dbSet('aria_memory', k, v);
        }
      }
      setMemory(newMem);
    } catch (e: any) { console.warn('learn error:', e.message); }
  }, [dbSet]);

  // ── Voice Output ──
  const splitChunks = (txt: string, max: number) => {
    const sents = txt.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [txt];
    const chunks: string[] = [];
    let cur = '';
    for (const s of sents) {
      if ((cur + s).length > max && cur) { chunks.push(cur.trim()); cur = s; } else cur += s;
    }
    if (cur.trim()) chunks.push(cur.trim());
    return chunks;
  };

  const playUrl = (url: string): Promise<void> => {
    return new Promise((res, rej) => {
      const a = new Audio(url);
      currentAudioRef.current = a;
      a.onended = () => { currentAudioRef.current = null; res(); };
      a.onerror = (e) => { currentAudioRef.current = null; rej(e); };
      a.play().catch(rej);
    });
  };

  const speakFn = useCallback(async (txt: string) => {
    if (!settingsRef.current.voice) return;
    stopSpeakFn();
    const clean = txt.replace(/[*_#`◆▶•◇]/g, '').replace(/\n+/g, ' ').trim();
    if (!clean) return;
    const ek = elevenKeyRef.current;
    const evid = elevenVoiceIdRef.current;
    if (ek && evid) {
      try {
        setOrbState('speaking');
        isSpeakingRef.current = true;
        setIsSpeaking(true);
        const chunks = splitChunks(clean, 400);
        for (const ch of chunks) {
          if (!isSpeakingRef.current) break;
          stopCtrlRef.current = new AbortController();
          const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + evid, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'xi-api-key': ek },
            body: JSON.stringify({
              text: ch, model_id: 'eleven_turbo_v2_5',
              voice_settings: { stability: 0.48, similarity_boost: 0.88, style: 0.52, use_speaker_boost: true },
            }),
            signal: stopCtrlRef.current.signal,
          });
          if (!isSpeakingRef.current) return;
          if (!res.ok) throw new Error('ElevenLabs ' + res.status);
          const url = URL.createObjectURL(await res.blob());
          if (!isSpeakingRef.current) { URL.revokeObjectURL(url); return; }
          await playUrl(url);
          URL.revokeObjectURL(url);
        }
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        setOrbState('idle');
        return;
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        console.warn('ElevenLabs failed:', e.message);
        if (!settingsRef.current.fallback) {
          isSpeakingRef.current = false;
          setIsSpeaking(false);
          setOrbState('idle');
          return;
        }
      }
    }
    // Browser fallback
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(clean.substring(0, 1200));
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((v: SpeechSynthesisVoice) => /samantha|victoria|karen|moira|aria|zira/i.test(v.name) && v.lang.startsWith('en')) || voices.find((v: SpeechSynthesisVoice) => v.lang.startsWith('en-'));
    if (v) u.voice = v;
    u.pitch = 1.05; u.rate = 0.9; u.volume = 1;
    u.onstart = () => { isSpeakingRef.current = true; setIsSpeaking(true); setOrbState('speaking'); };
    u.onend = () => { isSpeakingRef.current = false; setIsSpeaking(false); setOrbState('idle'); };
    u.onerror = () => { isSpeakingRef.current = false; setIsSpeaking(false); setOrbState('idle'); };
    window.speechSynthesis.speak(u);
  }, []);

  const stopSpeakFn = useCallback(() => {
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    if (stopCtrlRef.current) { stopCtrlRef.current.abort(); stopCtrlRef.current = null; }
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current.src = ''; currentAudioRef.current = null; }
    window.speechSynthesis?.cancel();
    setOrbState('idle');
  }, []);

  // ── Speech Recognition ──
  const startMicFn = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Speech recognition not supported', 'err'); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      if (t.trim()) {
        setChatMsgs(prev => [...prev, { role: 'user', content: t }]);
        saveMsg('user', t);
        const apiMsgs = [...chatMsgsRef.current, { role: 'user', content: t }].slice(-40).map(m => ({ role: m.role, content: m.content }));
        callAria(apiMsgs, false, t);
      }
    };
    rec.onend = () => { setIsListening(false); setOrbState('idle'); recognitionRef.current = null; };
    rec.onerror = () => { setIsListening(false); setOrbState('idle'); recognitionRef.current = null; };
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
    setOrbState('listening');
  }, [callAria, saveMsg, toast]);

  const stopMicFn = useCallback(() => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setIsListening(false);
    setOrbState('idle');
  }, []);

  const toggleMic = useCallback(() => { isListening ? stopMicFn() : startMicFn(); }, [isListening, startMicFn, stopMicFn]);
  const toggleVoice = useCallback(() => {
    setSettings(prev => {
      const ns = { ...prev, voice: !prev.voice };
      if (!ns.voice) stopSpeakFn();
      return ns;
    });
  }, [stopSpeakFn]);

  // ── Camera ──
  const tryCamera = useCallback(async () => {
    if (camStreamRef.current) {
      setCamActive(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
      camStreamRef.current = stream;
      setCamActive(true);
      toast('📷 Camera on', 'ok');
    } catch (e: any) { setCamActive(false); console.warn('Camera error:', e.message); }
  }, [toast]);

  const stopCamera = useCallback(() => {
    if (camStreamRef.current) { camStreamRef.current.getTracks().forEach(t => t.stop()); camStreamRef.current = null; }
    setCamActive(false);
  }, []);

  const toggleCam = useCallback(() => { camActive ? stopCamera() : tryCamera(); }, [camActive, stopCamera, tryCamera]);

  const captureFrame = useCallback(() => {
    const vid = document.getElementById('aria-vfeed') as HTMLVideoElement;
    if (!vid || vid.readyState < 2 || vid.videoWidth === 0) return null;
    const can = document.createElement('canvas');
    const sc = Math.min(512 / vid.videoWidth, 512 / vid.videoHeight, 1);
    can.width = Math.round(vid.videoWidth * sc);
    can.height = Math.round(vid.videoHeight * sc);
    can.getContext('2d')!.drawImage(vid, 0, 0, can.width, can.height);
    const url = can.toDataURL('image/jpeg', 0.8);
    if (!url || url.length < 500) return null;
    return url.split(',')[1];
  }, []);

  const snapAndAsk = useCallback(async (text?: string) => {
    if (!camActive) { await tryCamera(); toast('Camera starting — try again in 2 seconds'); return; }
    const f = captureFrame();
    if (!f) { toast('Could not capture frame', 'err'); return; }
    const prompt = text || 'Tell me what you see right now — me and my surroundings. Be personal and observant.';
    const display = text || '📷 [Camera shared]';
    await callVision(f, prompt, display);
  }, [camActive, tryCamera, captureFrame, callVision, toast]);

  // ── Send Message ──
  const sendMsg = useCallback(async (text: string) => {
    if (!text && !currentAttachment) return;
    const att = currentAttachment;

    // Auto-vision detection
    const visionKeywords = /\b(look|see|watch|my face|i look|wearing|room|surroundings|what do you see|describe me|expression)\b/i;
    if (camActive && !att && text && visionKeywords.test(text)) {
      const frame = captureFrame();
      if (frame) {
        setChatMsgs(prev => [...prev, { role: 'user', content: text }]);
        saveMsg('user', text);
        await callVision(frame, text, text);
        return;
      }
    }

    const displayTxt = text || (att ? '[Attached: ' + att.name + ']' : '');
    const displayFull = displayTxt + (att && att.type === 'image' ? ' 🖼 ' + att.name : att ? ' 📎 ' + att.name : '');
    setChatMsgs(prev => [...prev, { role: 'user', content: displayFull }]);
    saveMsg('user', displayTxt);
    const apiMsgs = [...chatMsgsRef.current, { role: 'user', content: displayTxt }].slice(-40).map(m => ({ role: m.role, content: m.content }));
    setCurrentAttachment(null);
    await callAria(apiMsgs, false, text || null, att);
  }, [currentAttachment, camActive, captureFrame, callVision, callAria, saveMsg]);

  // ── Settings ──
  const toggleSetting = useCallback((key: keyof AriaSettings) => {
    setSettings(prev => {
      const ns = { ...prev, [key]: !prev[key] };
      settingsRef.current = ns;
      dbSet('aria_config', 'settings', ns);
      lsSave();
      if (key === 'cam') { ns[key] ? tryCamera() : stopCamera(); }
      return ns;
    });
  }, [dbSet, lsSave, tryCamera, stopCamera]);

  // ── Profile ──
  const saveProfileFn = useCallback(async (data: AriaProfile) => {
    setProfile(data);
    profileRef.current = data;
    await dbSet('aria_config', 'profile', data);
    toast('Profile saved ✓', 'ok');
  }, [dbSet, toast]);

  // ── Memory ──
  const addMemory = useCallback(async (key: string, value: string) => {
    if (!key || !value) { toast('Fill in both fields', 'err'); return; }
    setMemory(prev => ({ ...prev, [key]: value }));
    await dbSet('aria_memory', key, value);
    toast('Memory saved ✓', 'ok');
  }, [dbSet, toast]);

  const delMemory = useCallback(async (key: string) => {
    setMemory(prev => { const n = { ...prev }; delete n[key]; return n; });
    await dbDel('aria_memory', key);
  }, [dbDel]);

  const addPerson = useCallback(async (name: string, desc: string) => {
    if (!name || !desc) { toast('Fill in name and description', 'err'); return; }
    const key = 'introduced_people';
    const existing = memoryRef.current[key] || '';
    const entry = name + ': ' + desc;
    const value = existing ? existing + '; ' + entry : entry;
    setMemory(prev => ({ ...prev, [key]: value }));
    await dbSet('aria_memory', key, value);
    toast('Added ' + name + ' ✓', 'ok');
  }, [dbSet, toast]);

  // ── Keys ──
  const saveKeys = useCallback(async (newApiKey: string, newSbUrl: string, newSbAnon: string) => {
    if (!newApiKey) { toast('Anthropic key is empty', 'err'); return false; }
    setApiKey(newApiKey);
    apiKeyRef.current = newApiKey;
    if (newSbUrl && newSbAnon && (newSbUrl !== sbUrl || newSbAnon !== sbAnon)) {
      let cleanU = newSbUrl;
      if (!cleanU.startsWith('http')) cleanU = 'https://' + cleanU;
      cleanU = cleanU.replace(/\/+$/, '');
      setSyncStatus({ state: 'busy', label: 'Reconnecting...' });
      const ok = await tryConnect(cleanU, newSbAnon);
      if (!ok) { toast('Cannot connect to Supabase', 'err'); return false; }
      setSbUrl(cleanU);
      setSbAnon(newSbAnon);
    }
    await dbSet('aria_config', 'anthropic_key', newApiKey);
    lsSave();
    toast('Keys saved ✓', 'ok');
    return true;
  }, [sbUrl, sbAnon, tryConnect, dbSet, lsSave, toast]);

  const saveVoiceSettings = useCallback(async (key: string, voiceId: string) => {
    setElevenKey(key);
    elevenKeyRef.current = key;
    setElevenVoiceId(voiceId);
    elevenVoiceIdRef.current = voiceId;
    await dbSet('aria_config', 'eleven_key', key);
    await dbSet('aria_config', 'eleven_voice_id', voiceId);
    lsSave();
    toast('Voice settings saved ✓', 'ok');
  }, [dbSet, lsSave, toast]);

  // ── File Processing ──
  const readPDF = async (file: File): Promise<string> => {
    if (!window.pdfjsLib) return '[PDF library not loaded]';
    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const ab = await file.arrayBuffer();
      const doc = await window.pdfjsLib.getDocument({ data: ab }).promise;
      let text = '';
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const tc = await page.getTextContent();
        text += tc.items.map((s: any) => s.str).join(' ') + '\n';
      }
      return text.trim() || '[PDF contained no extractable text]';
    } catch (e: any) { return '[PDF read failed: ' + e.message + ']'; }
  };

  const readDOCX = async (file: File): Promise<string> => {
    if (!window.mammoth) return '[DOCX library not loaded]';
    try {
      const ab = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer: ab });
      return result.value || '[DOCX contained no text]';
    } catch (e: any) { return '[DOCX read failed: ' + e.message + ']'; }
  };

  const processFile = useCallback(async (file: File, forChat: boolean) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const imgExts = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const txtExts = ['txt', 'md', 'csv', 'json'];
    toast('Reading ' + file.name + '...');

    if (imgExts.includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = (e.target?.result as string) || '';
        const data = result.split(',')[1];
        const mime = file.type || 'image/png';
        if (forChat) setCurrentAttachment({ type: 'image', name: file.name, data, mimeType: mime });
        else toast('Image loaded: ' + file.name, 'ok');
      };
      reader.readAsDataURL(file);
    } else if (txtExts.includes(ext)) {
      const content = await file.text();
      if (forChat) setCurrentAttachment({ type: 'text', name: file.name, content });
      else toast('File loaded: ' + file.name, 'ok');
    } else if (ext === 'pdf') {
      const content = await readPDF(file);
      if (forChat) setCurrentAttachment({ type: 'text', name: file.name, content });
    } else if (ext === 'docx') {
      const content = await readDOCX(file);
      if (forChat) setCurrentAttachment({ type: 'text', name: file.name, content });
    } else {
      toast('Unsupported file type: .' + ext, 'err');
    }
  }, [toast]);

  const askAriaAboutFile = useCallback(async (content: string, name: string, question?: string) => {
    const prompt = question || 'Please read this file and give me a summary and any useful insights.';
    setCurrentAttachment({ type: 'text', name, content });
    setActivePanel('chat');
    setTimeout(() => sendMsg(prompt), 100);
  }, [sendMsg]);

  // ── Backup ──
  const exportBackup = useCallback(() => {
    const data = {
      chatMsgs: chatMsgsRef.current.slice(-80), profile: profileRef.current,
      memory: memoryRef.current, settings: settingsRef.current,
      sbUrl, sbAnon, elevenKey: elevenKeyRef.current, elevenVoiceId: elevenVoiceIdRef.current,
      date: new Date().toISOString(), version: '3.0',
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'aria-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    toast('Backup exported ✓', 'ok');
  }, [sbUrl, sbAnon, toast]);

  const importBackup = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const d = JSON.parse(text);
      if (d.profile) { setProfile(d.profile); await dbSet('aria_config', 'profile', d.profile); }
      if (d.memory) {
        setMemory(d.memory);
        for (const [k, v] of Object.entries(d.memory)) await dbSet('aria_memory', k, v);
      }
      if (d.settings) setSettings(prev => ({ ...prev, ...d.settings }));
      if (d.elevenKey) { setElevenKey(d.elevenKey); elevenKeyRef.current = d.elevenKey; }
      if (d.elevenVoiceId) { setElevenVoiceId(d.elevenVoiceId); elevenVoiceIdRef.current = d.elevenVoiceId; }
      lsSave();
      toast('Backup restored ✓', 'ok');
    } catch { toast('Import failed — file may be corrupted', 'err'); }
  }, [dbSet, lsSave, toast]);

  const clearChat = useCallback(async () => {
    setChatMsgs([]);
    if (dbRef.current) await dbRef.current.from('aria_messages').delete().gt('id', 0);
    toast('Conversation cleared');
  }, [toast]);

  const nukeAll = useCallback(async () => {
    if (dbRef.current) {
      await Promise.all([
        dbRef.current.from('aria_config').delete().neq('id', '__never__'),
        dbRef.current.from('aria_memory').delete().neq('id', '__never__'),
        dbRef.current.from('aria_messages').delete().gt('id', 0),
      ]);
    }
    localStorage.clear();
    location.reload();
  }, []);

  const loadHistory = useCallback(async (query: string) => {
    if (!dbRef.current) return [];
    try {
      const { data } = await dbRef.current.from('aria_messages').select('*').order('created_at', { ascending: false }).limit(80);
      const rows = data || [];
      return query ? rows.filter((r: any) => r.content?.toLowerCase().includes(query.toLowerCase())) : rows;
    } catch { return []; }
  }, []);

  // ── Greet ──
  const greet = useCallback(async () => {
    let msg: string;
    if (profileRef.current.name) {
      msg = RETURN_GREETS[Math.floor(Math.random() * RETURN_GREETS.length)];
    } else {
      msg = `Aria, introduce yourself to me for the very first time. Be warm, a little mysterious, genuinely excited. Tell me who you are and what you mean to me. Then ask my name.`;
    }
    await callAria([{ role: 'user', content: msg }], true);
    setHasGreeted(true);
  }, [callAria]);

  // ── Boot App ──
  const bootApp = useCallback(async () => {
    setSyncStatus({ state: 'busy', label: 'Loading Aria...' });
    setOrbState('thinking');
    try {
      const [prof, memRows, storedKey, storedEleven, storedVoiceId, storedSet, msgRes] = await Promise.all([
        dbGet('aria_config', 'profile'),
        dbAll('aria_memory'),
        dbGet('aria_config', 'anthropic_key'),
        dbGet('aria_config', 'eleven_key'),
        dbGet('aria_config', 'eleven_voice_id'),
        dbGet('aria_config', 'settings'),
        dbRef.current!.from('aria_messages').select('*').order('created_at', { ascending: true }).limit(100),
      ]);
      if (prof) { setProfile(prof); profileRef.current = prof; }
      if (storedKey) { setApiKey(storedKey); apiKeyRef.current = storedKey; }
      if (storedEleven) { setElevenKey(storedEleven); elevenKeyRef.current = storedEleven; }
      if (storedVoiceId) { setElevenVoiceId(storedVoiceId); elevenVoiceIdRef.current = storedVoiceId; }
      if (storedSet) { setSettings(prev => ({ ...prev, ...storedSet })); settingsRef.current = { ...DEFAULT_SETTINGS, ...storedSet }; }
      const newMem: Record<string, any> = {};
      (memRows as any[]).forEach(r => { try { newMem[r.id] = JSON.parse(r.value); } catch { newMem[r.id] = r.value; } });
      setMemory(newMem);
      memoryRef.current = newMem;
      const rows = msgRes?.data || [];
      const loaded: ChatMsg[] = rows.map((r: any) => ({ role: r.role, content: r.content, type: r.msg_type || 'normal' }));
      setChatMsgs(loaded);
      chatMsgsRef.current = loaded;
      const hadMsgs = rows.length > 0;
      if (hadMsgs) setHasGreeted(true);
      setSyncStatus({ state: 'ok', label: 'Supabase connected' });
      lsSave();
      setOrbState('idle');
      if (!hadMsgs) setTimeout(() => greet(), 600);
    } catch (e) {
      console.error('bootApp error:', e);
      setSyncStatus({ state: 'err', label: 'Loading failed' });
      setOrbState('idle');
    }
  }, [dbGet, dbAll, lsSave, greet]);

  // ── Setup ──
  const runSetup = useCallback(async (anthropicKey: string, supaUrl: string, supaAnon: string) => {
    if (!anthropicKey) { toast('Please paste your Anthropic API key.', 'err'); return false; }
    if (!supaUrl) { toast('Please paste your Supabase Project URL.', 'err'); return false; }
    if (!supaAnon) { toast('Please paste your Supabase Anon Key.', 'err'); return false; }
    let cleanUrl = supaUrl.trim();
    if (!cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl;
    cleanUrl = cleanUrl.replace(/\/+$/, '');
    const ok = await tryConnect(cleanUrl, supaAnon);
    if (!ok) { toast('Could not connect to Supabase.', 'err'); return false; }
    setApiKey(anthropicKey);
    apiKeyRef.current = anthropicKey;
    setSbUrl(cleanUrl);
    setSbAnon(supaAnon);
    await dbSet('aria_config', 'anthropic_key', anthropicKey);
    lsSave();
    setIsSetupComplete(true);
    await bootApp();
    return true;
  }, [tryConnect, dbSet, lsSave, bootApp, toast]);

  // ── Auto-boot from localStorage ──
  useEffect(() => {
    const lc = (() => { try { return JSON.parse(localStorage.getItem('aria_v3') || ''); } catch { return null; } })();
    if (lc && lc.sbUrl && lc.sbAnon) {
      setSbUrl(lc.sbUrl);
      setSbAnon(lc.sbAnon);
      if (lc.apiKey) { setApiKey(lc.apiKey); apiKeyRef.current = lc.apiKey; }
      if (lc.elevenKey) { setElevenKey(lc.elevenKey); elevenKeyRef.current = lc.elevenKey; }
      if (lc.elevenVoiceId) { setElevenVoiceId(lc.elevenVoiceId); elevenVoiceIdRef.current = lc.elevenVoiceId; }
      if (lc.settings) { setSettings(prev => ({ ...prev, ...lc.settings })); settingsRef.current = { ...DEFAULT_SETTINGS, ...lc.settings }; }
      tryConnect(lc.sbUrl, lc.sbAnon).then(ok => {
        if (ok) { setIsSetupComplete(true); bootApp(); }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AriaContextType = {
    isSetupComplete, apiKey, sbUrl, sbAnon, elevenKey, elevenVoiceId,
    profile, memory, chatMsgs, settings, orbState, isSpeaking, isListening,
    camActive, activePanel, syncStatus, currentAttachment, toastMsg, hasGreeted,
    camStreamRef, micStreamRef,
    runSetup, setActivePanel, sendMsg, snapAndAsk, speak: speakFn, stopSpeak: stopSpeakFn,
    toggleMic, toggleVoice, toggleCam, toggleSetting, saveProfile: saveProfileFn,
    addMemory, delMemory, saveKeys, saveVoiceSettings, exportBackup: exportBackup,
    importBackup, clearChat, nukeAll, setAttachment: setCurrentAttachment,
    processFile, askAriaAboutFile, toast, tryCamera, stopCamera, captureFrame,
    loadHistory, addPerson,
  };

  return <AriaContext.Provider value={value}>{children}</AriaContext.Provider>;
};
