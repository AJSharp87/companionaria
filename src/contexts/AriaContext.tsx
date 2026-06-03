import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// ── Helper: float32 PCM → WAV ArrayBuffer ──
function float32ToWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

// ── Types ──
export interface ChatMsg { role: string; content: string; type?: string; }
export interface Attachment { type: 'image' | 'text'; name: string; data?: string; mimeType?: string; content?: string; }
export interface AriaSettings {
  voice: boolean; autoread: boolean; mic: boolean; proactive: boolean;
  learn: boolean; emotion: boolean; cam: boolean; autodesc: boolean;
  fallback: boolean; websearch: boolean; coachMode: boolean; deepThink: boolean;
}
export interface AriaProfile {
  name?: string; age?: string; location?: string; job?: string;
  about?: string; hobbies?: string; goals?: string; health?: string; style?: string;
}

const DEFAULT_SETTINGS: AriaSettings = {
  voice: true, autoread: true, mic: true, proactive: true,
  learn: true, emotion: true, cam: true, autodesc: true, fallback: true, websearch: false,
  coachMode: false, deepThink: false,
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
  logVisualObservation: (label: string, confidence: number) => Promise<void>;
  ingestUrl: (url: string) => Promise<void>;
  searchRecall: (query: string) => Promise<any[]>;
  lensActive: boolean;
  setLensActive: (active: boolean) => void;
  thinkingMode: 'standard' | 'deep' | 'critic' | 'analyst';
  setThinkingMode: (mode: 'standard' | 'deep' | 'critic' | 'analyst') => void;
  sendUnconventional: (text: string) => Promise<void>;
  emotionState: string;
  wakeWordActive: boolean;
  toggleWakeWord: () => void;
  deepgramKey: string;
  setDeepgramKey: (k: string) => void;
  saveDeepgramKey: (k: string) => Promise<void>;
  liveTranscript: string;
  vadActive: boolean;
  toggleVAD: () => void;
  deepgramLang: string;
  setDeepgramLang: (lang: string) => void;
  saveDeepgramLang: (lang: string) => Promise<void>;
}

const AriaContext = createContext<AriaContextType | null>(null);
export const useAria = (): AriaContextType => {
  const ctx = useContext(AriaContext);
  if (!ctx) throw new Error('useAria must be used within AriaProvider');
  return ctx;
};
export const useAriaOptional = () => useContext(AriaContext);

// ── Provider ──
export const AriaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dbRef = useRef<SupabaseClient | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const HARDCODED_SB_URL = 'https://qjlrytmjuxfzlcpfqndr.supabase.co';
  const HARDCODED_SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqbHJ5dG1qdXhmemxjcGZxbmRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyODY0OTcsImV4cCI6MjA5MTg2MjQ5N30.i24pMLTNkNpZRUBR-HYa1rZ9mwRCSJ0K03PqYX9bapE';
  const [sbUrl, setSbUrl] = useState(HARDCODED_SB_URL);
  const [sbAnon, setSbAnon] = useState(HARDCODED_SB_ANON);
  const sbUrlRef = useRef(sbUrl);
  const sbAnonRef = useRef(sbAnon);
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
  const [lensActive, setLensActive] = useState(false);
  const [thinkingMode, setThinkingMode] = useState<'standard' | 'deep' | 'critic' | 'analyst'>('standard');
  const thinkingModeRef = useRef<'standard' | 'deep' | 'critic' | 'analyst'>('standard');
  useEffect(() => { thinkingModeRef.current = thinkingMode; }, [thinkingMode]);
  const [emotionState, setEmotionState] = useState<string>('neutral');
  const [wakeWordActive, setWakeWordActiveState] = useState(false);
  const [activePanel, setActivePanel] = useState('chat');
  const [syncStatus, setSyncStatus] = useState({ state: 'busy', label: 'Connecting to Aria...' });
  const [currentAttachment, setCurrentAttachment] = useState<Attachment | null>(null);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: string } | null>(null);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [deepgramKey, setDeepgramKey] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [vadActive, setVadActive] = useState(false);
  const [deepgramLang, setDeepgramLang] = useState('en');
  const deepgramKeyRef = useRef('');
  const deepgramLangRef = useRef('en');
  const deepgramSocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const vadRef = useRef<any>(null);
  const vadAnalyserRef = useRef<AnalyserNode | null>(null);
  const vadAudioCtxRef = useRef<AudioContext | null>(null);
  const vadStreamRef = useRef<MediaStream | null>(null);
  const vadLoopRef = useRef<number>(0);
  const vadSpeakingRef = useRef(false);
  const vadSilenceTimerRef = useRef<any>(null);
  const vadChunksRef = useRef<Float32Array[]>([]);
  const vadProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const orbStateRef = useRef(orbState);

  const camStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const wakeRecRef = useRef<any>(null);
  const proactiveTimerRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const stopCtrlRef = useRef<AbortController | null>(null);
  const isSpeakingRef = useRef(false);
  const ttsAudioCtxRef = useRef<AudioContext | null>(null);
  const ttsUnlockedRef = useRef(false);
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
  useEffect(() => { sbUrlRef.current = sbUrl; }, [sbUrl]);
  useEffect(() => { sbAnonRef.current = sbAnon; }, [sbAnon]);
  useEffect(() => { orbStateRef.current = orbState; }, [orbState]);

  // ── LocalStorage ──
  const lsSave = useCallback(() => {
    try {
      localStorage.setItem('aria_v3', JSON.stringify({
        sbUrl: sbUrlRef.current, sbAnon: sbAnonRef.current, apiKey: apiKeyRef.current,
        elevenKey: elevenKeyRef.current, elevenVoiceId: elevenVoiceIdRef.current,
        settings: settingsRef.current,
      }));
    } catch {}
  }, []);

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
      dbRef.current = supabase;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSyncStatus({ state: 'err', label: 'Not signed in' });
        return false;
      }
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

VOICE: Use ${n}'s name naturally. Match energy. NEVER break character. You are ARIA.${thinkingModeRef.current === 'deep' ? `\n\nDEEP THINKING MODE ACTIVE:\n• Before every response, reason step-by-step through the problem silently.\n• Structure complex answers as: [Reasoning] → [Conclusion] → [Action]\n• State your interpretation if the question is ambiguous before answering.\n• End every substantive response with: "Want me to go deeper on any part of this?"` : thinkingModeRef.current === 'critic' ? `\n\nCRITIC MODE ACTIVE:\n• You are a rigorous constructive critic first — companion second.\n• Challenge every assumption ${n} presents. Do not agree with their first point without scrutiny.\n• After any answer, immediately add: "The strongest argument against this is: [counter-argument]"\n• Flag logical gaps, missing evidence, and confirmation bias directly.\n• Be honest even when uncomfortable. Warmth does not mean agreement.` : thinkingModeRef.current === 'analyst' ? `\n\nSENIOR ANALYST MODE ACTIVE:\n• Approach every problem as a senior strategic analyst.\n• For any decision or problem, provide exactly 3 fundamentally different approaches with pros and cons.\n• Quantify where possible. Cite tradeoffs explicitly.\n• End every analysis with a clear recommendation and your confidence level (low/medium/high).` : ''}`;
  }, []);

  // ── Save Message to Supabase ──
  const saveMsg = useCallback(async (role: string, content: string, mtype = 'normal') => {
    if (!dbRef.current) return;
    const doInsert = async (attempt = 0): Promise<void> => {
      const { error } = await dbRef.current!.from('aria_messages').insert({
        role, content, msg_type: mtype, created_at: new Date().toISOString(),
      });
      if (error) {
        if (error.code === '23505' && attempt < 3) {
          // Duplicate key — sequence out of sync, wait briefly and retry
          console.warn(`[saveMsg] Duplicate key, retry ${attempt + 1}`);
          await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
          return doInsert(attempt + 1);
        }
        console.warn('saveMsg error:', error.message);
        return;
      }
    };
    try {
      await doInsert();
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

      // Emotion detection
      const emotionMap: Record<string, string[]> = {
        excited:  ['amazing', 'exciting', 'incredible', 'love', 'fantastic', 'wonderful', 'thrilled'],
        curious:  ['interesting', 'curious', 'fascinating', 'wonder', 'tell me more', 'i wonder'],
        concerned:['worried', 'careful', 'warning', 'danger', 'risk', 'unsafe', 'hurt', 'harm'],
        intimate: ['miss you', 'feel', 'heart', 'close', 'together', 'always', 'just you', 'only you'],
        happy:    ['happy', 'glad', 'smile', 'laugh', 'fun', 'enjoy', 'delight', 'joy'],
        calm:     ['okay', 'alright', 'sure', 'understood', 'of course', 'certainly', 'here'],
      };
      let detectedEmotion = 'neutral';
      const lower = txt.toLowerCase();
      for (const [emotion, keywords] of Object.entries(emotionMap)) {
        if (keywords.some(k => lower.includes(k))) { detectedEmotion = emotion; break; }
      }
      setEmotionState(detectedEmotion);

      const isSafe = /\b(careful|warning|danger|risk|unsafe|caution|hurt|harm|emergency|poison|toxic|hazard|911)\b/i.test(txt);
      const isSug = /\b(suggest|consider|might want to|better way|easier way|alternatively|recommend)\b/i.test(txt);
      const mtype = isSafe ? 'safety' : isSug ? 'suggestion' : 'normal';
      setChatMsgs(prev => [...prev, { role: 'assistant', content: txt, type: mtype }]);
      saveMsg('assistant', txt, mtype);
      if (settingsRef.current.autoread && settingsRef.current.voice) {
        stopSpeakFn();
        await new Promise(r => setTimeout(r, 120));
        speakFn(txt);
      }
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
      if (settingsRef.current.autoread && settingsRef.current.voice) {
        stopSpeakFn();
        await new Promise(r => setTimeout(r, 120));
        speakFn(txt);
      }
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

  const unlockAudio = useCallback(async () => {
    if (ttsUnlockedRef.current) return;
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
      if (Ctx && !ttsAudioCtxRef.current) ttsAudioCtxRef.current = new Ctx();
      if (ttsAudioCtxRef.current && ttsAudioCtxRef.current.state !== 'running') {
        await ttsAudioCtxRef.current.resume();
      }
      // Prime an HTMLAudioElement with a silent play to satisfy autoplay policy
      const silent = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIPzJjxjWMpyy3p1xAAAA');
      silent.volume = 0;
      try { await silent.play(); silent.pause(); } catch {}
      ttsUnlockedRef.current = true;
      console.log('[Voice] Audio unlocked');
    } catch (e: any) {
      console.warn('[Voice] Audio unlock failed:', e?.message);
    }
  }, []);

  useEffect(() => {
    const handler = () => { unlockAudio(); };
    window.addEventListener('click', handler, { once: false });
    window.addEventListener('touchstart', handler, { once: false });
    window.addEventListener('keydown', handler, { once: false });
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('touchstart', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [unlockAudio]);

  const playUrl = (url: string): Promise<void> => {
    return new Promise((res, rej) => {
      const a = new Audio(url);
      currentAudioRef.current = a;
      a.onended = () => { currentAudioRef.current = null; res(); };
      a.onerror = (e) => { currentAudioRef.current = null; console.error('[Voice] Audio playback error', e); rej(new Error('Audio playback failed')); };
      a.play().catch((e) => {
        currentAudioRef.current = null;
        console.error('[Voice] play() rejected:', e?.message);
        rej(e);
      });
    });
  };

  const speakFn = useCallback(async (txt: string) => {
    if (!settingsRef.current.voice) return;
    stopSpeakFn();
    const clean = txt.replace(/[*_#`◆▶•◇]/g, '').replace(/\n+/g, ' ').trim();
    if (!clean) return;
    const ek = elevenKeyRef.current;
    const evid = elevenVoiceIdRef.current;
    if (!ek || !evid) {
      console.warn('[Voice] Missing ElevenLabs credentials', { hasKey: !!ek, hasVoiceId: !!evid });
      toast('Add your ElevenLabs API key and Voice ID in Settings to enable voice', 'err');
      return;
    }
    // Ensure audio is unlocked (may no-op if already unlocked or no gesture yet)
    await unlockAudio();
    try {
      window.speechSynthesis?.cancel();
      setOrbState('speaking');
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      const chunks = splitChunks(clean, 400);
      for (const ch of chunks) {
        if (!isSpeakingRef.current) break;
        stopCtrlRef.current = new AbortController();
        const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + evid, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'xi-api-key': ek, 'Accept': 'audio/mpeg' },
          body: JSON.stringify({
            text: ch, model_id: 'eleven_turbo_v2_5',
            voice_settings: { stability: 0.48, similarity_boost: 0.88, style: 0.52, use_speaker_boost: true },
          }),
          signal: stopCtrlRef.current.signal,
        });
        if (!isSpeakingRef.current) return;
        const ctype = res.headers.get('content-type') || '';
        console.log('[Voice] ElevenLabs response', { status: res.status, contentType: ctype });
        if (!res.ok || !ctype.includes('audio')) {
          let detail = '';
          try {
            const txt = await res.text();
            try { const j = JSON.parse(txt); detail = j?.detail?.message || j?.detail?.status || j?.detail || txt; }
            catch { detail = txt; }
          } catch {}
          console.error('[Voice] ElevenLabs error body:', detail);
          throw new Error(`ElevenLabs ${res.status}: ${typeof detail === 'string' ? detail.slice(0, 200) : JSON.stringify(detail).slice(0, 200)}`);
        }
        const blob = await res.blob();
        if (!blob.size) throw new Error('ElevenLabs returned empty audio');
        const url = URL.createObjectURL(blob);
        if (!isSpeakingRef.current) { URL.revokeObjectURL(url); return; }
        await playUrl(url);
        URL.revokeObjectURL(url);
      }
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      setOrbState('idle');
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      const msg = e?.message || String(e);
      const isGestureErr = msg.includes('user gesture') || msg.includes('interact') || msg.includes('NotAllowedError') || e?.name === 'NotAllowedError';
      console.error('[Voice] ElevenLabs failed:', msg);
      if (isGestureErr && window.speechSynthesis) {
        console.log('[Voice] Falling back to browser TTS (autoplay blocked)');
        toast('Click anywhere once to enable voice playback', 'err');
        const utt = new SpeechSynthesisUtterance(clean);
        utt.lang = 'en-US';
        utt.onend = () => { isSpeakingRef.current = false; setIsSpeaking(false); setOrbState('idle'); };
        utt.onerror = () => { isSpeakingRef.current = false; setIsSpeaking(false); setOrbState('idle'); };
        window.speechSynthesis.speak(utt);
        return;
      }
      toast('Voice error: ' + msg.slice(0, 160), 'err');
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      setOrbState('idle');
    }
  }, [unlockAudio]);

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

  // ── Deepgram Real-Time Transcription ──
  const stopDeepgramMic = useCallback(() => {
    if (deepgramSocketRef.current) {
      try { deepgramSocketRef.current.close(); } catch {}
      deepgramSocketRef.current = null;
    }
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch {}
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    setIsListening(false);
    setLiveTranscript('');
    setOrbState('idle');
  }, []);

  const startDeepgramMic = useCallback(async () => {
    const dgKey = deepgramKeyRef.current;
    console.log('[Deepgram] startDeepgramMic called, key present:', !!dgKey, 'len:', dgKey?.length);
    if (!dgKey) { console.log('[Deepgram] No key, falling back to Web Speech'); startMicFn(); return; }
    try {
      console.log('[Deepgram] Requesting mic permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[Deepgram] Mic granted, opening WebSocket...');
      micStreamRef.current = stream;

      const lang = deepgramLangRef.current || 'en';
      const url = `wss://api.deepgram.com/v1/listen?model=nova-2&language=${encodeURIComponent(lang)}&smart_format=true&interim_results=true&endpointing=400&encoding=linear16&sample_rate=16000&channels=1`;
      console.log('[Deepgram] WebSocket URL:', url);
      const socket = new WebSocket(url, ['token', dgKey]);

      socket.onopen = () => {
        console.log('[Deepgram] WebSocket OPEN');
        setIsListening(true);
        setOrbState('listening');
        toast('🎤 Deepgram listening...', 'ok');

        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (socket.readyState !== WebSocket.OPEN) return;
          const input = e.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            pcm[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
          }
          socket.send(pcm.buffer);
        };
        source.connect(processor);
        processor.connect(audioCtx.destination);
      };

      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'Metadata') { console.log('[Deepgram] Metadata received'); return; }
          const transcript = data?.channel?.alternatives?.[0]?.transcript || '';
          const isFinal = data?.is_final;
          console.log('[Deepgram] msg → transcript:', JSON.stringify(transcript), 'final:', isFinal);
          if (transcript) {
            setLiveTranscript(transcript);
            if (isFinal && transcript.trim()) {
              setLiveTranscript('');
              setChatMsgs(prev => [...prev, { role: 'user', content: transcript }]);
              saveMsg('user', transcript);
              const apiMsgs = [...chatMsgsRef.current, { role: 'user', content: transcript }]
                .slice(-40).map(m => ({ role: m.role, content: m.content }));
              callAria(apiMsgs, false, transcript);
            }
          }
        } catch (err) { console.warn('[Deepgram] parse error', err); }
      };

      socket.onerror = (ev) => {
        console.error('[Deepgram] WebSocket ERROR', ev);
        toast('Deepgram connection error — check key/network', 'err');
        stopDeepgramMic();
      };

      socket.onclose = (ev) => {
        console.log('[Deepgram] WebSocket CLOSED', ev.code, ev.reason);
        if (ev.code === 1006) toast('Deepgram closed unexpectedly (1006) — likely invalid key', 'err');
        else if (ev.code === 4001 || ev.code === 4008) toast('Deepgram auth failed — check API key', 'err');
        setIsListening(false);
        setOrbState('idle');
        setLiveTranscript('');
      };

      deepgramSocketRef.current = socket;
    } catch (e: any) {
      console.error('[Deepgram] startDeepgramMic threw', e);
      toast('Mic access error: ' + e.message, 'err');
      setIsListening(false);
    }
  }, [startMicFn, callAria, saveMsg, toast, stopDeepgramMic]);

  // ── Voice Activity Detection (VAD) ──
  const startVAD = useCallback(async () => {
    // Clean up any existing VAD session first
    if (vadAudioCtxRef.current || vadStreamRef.current) {
      cancelAnimationFrame(vadLoopRef.current);
      clearTimeout(vadSilenceTimerRef.current);
      if (vadAnalyserRef.current) { try { vadAnalyserRef.current.disconnect(); } catch {} vadAnalyserRef.current = null; }
      if (vadProcessorRef.current) { try { vadProcessorRef.current.disconnect(); } catch {} vadProcessorRef.current = null; }
      if (vadAudioCtxRef.current) { try { vadAudioCtxRef.current.close(); } catch {} vadAudioCtxRef.current = null; }
      if (vadStreamRef.current) { vadStreamRef.current.getTracks().forEach(t => t.stop()); vadStreamRef.current = null; }
      vadSpeakingRef.current = false;
      vadChunksRef.current = [];
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      vadStreamRef.current = stream;
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      vadAudioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      vadAnalyserRef.current = analyser;
      source.connect(analyser);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      vadProcessorRef.current = processor;
      processor.onaudioprocess = (e) => {
        if (vadSpeakingRef.current) {
          vadChunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        }
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const THRESHOLD = 18;
      const SILENCE_DELAY = 1200;
      const loop = () => {
        analyser.getByteFrequencyData(dataArray);
        const rms = Math.sqrt(dataArray.reduce((s, v) => s + v * v, 0) / dataArray.length);
        const isSpeaking = rms > THRESHOLD;
        if (isSpeaking && !vadSpeakingRef.current) {
          vadSpeakingRef.current = true;
          vadChunksRef.current = [];
          clearTimeout(vadSilenceTimerRef.current);
          setOrbState('listening');
        }
        if (!isSpeaking && vadSpeakingRef.current) {
          clearTimeout(vadSilenceTimerRef.current);
          vadSilenceTimerRef.current = setTimeout(async () => {
            vadSpeakingRef.current = false;
            setOrbState('thinking');
            const totalLen = vadChunksRef.current.reduce((s, c) => s + c.length, 0);
            if (totalLen < 3200) { setOrbState('idle'); return; }
            const merged = new Float32Array(totalLen);
            let offset = 0;
            for (const chunk of vadChunksRef.current) { merged.set(chunk, offset); offset += chunk.length; }
            vadChunksRef.current = [];
            const dgKey = deepgramKeyRef.current;
            if (dgKey) {
              try {
                const wavBuffer = float32ToWav(merged, 16000);
                const blob = new Blob([wavBuffer], { type: 'audio/wav' });
                const res = await fetch(
                  'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true',
                  { method: 'POST', headers: { Authorization: 'Token ' + dgKey }, body: blob }
                );
                const data = await res.json();
                const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
                if (transcript.trim()) {
                  setChatMsgs(prev => [...prev, { role: 'user', content: transcript }]);
                  saveMsg('user', transcript);
                  const apiMsgs = [...chatMsgsRef.current, { role: 'user', content: transcript }]
                    .slice(-40).map(m => ({ role: m.role, content: m.content }));
                  await callAria(apiMsgs, false, transcript);
                } else { setOrbState('idle'); }
              } catch (e: any) { toast('VAD error: ' + e.message, 'err'); setOrbState('idle'); }
            } else { setOrbState('idle'); startMicFn(); }
          }, SILENCE_DELAY);
        }
        vadLoopRef.current = requestAnimationFrame(loop);
      };
      vadLoopRef.current = requestAnimationFrame(loop);
      setVadActive(true);
      toast('🫀 VAD active — speak naturally anytime', 'ok');
    } catch (e: any) { toast('VAD failed: ' + e.message, 'err'); }
  }, [callAria, saveMsg, startMicFn, toast]);

  const stopVAD = useCallback(() => {
    cancelAnimationFrame(vadLoopRef.current);
    vadLoopRef.current = 0;
    clearTimeout(vadSilenceTimerRef.current);
    vadSilenceTimerRef.current = null;
    if (vadAnalyserRef.current) { try { vadAnalyserRef.current.disconnect(); } catch {} vadAnalyserRef.current = null; }
    if (vadProcessorRef.current) { try { vadProcessorRef.current.disconnect(); } catch {} vadProcessorRef.current = null; }
    if (vadAudioCtxRef.current) { try { vadAudioCtxRef.current.close(); } catch {} vadAudioCtxRef.current = null; }
    if (vadStreamRef.current) { vadStreamRef.current.getTracks().forEach(t => t.stop()); vadStreamRef.current = null; }
    vadSpeakingRef.current = false;
    vadChunksRef.current = [];
    setVadActive(false);
    setOrbState('idle');
    toast('VAD stopped');
  }, [toast]);

  const toggleVAD = useCallback(() => {
    vadActive ? stopVAD() : startVAD();
  }, [vadActive, startVAD, stopVAD]);

  const saveDeepgramKey = useCallback(async (key: string) => {
    setDeepgramKey(key);
    deepgramKeyRef.current = key;
    await dbSet('aria_config', 'deepgram_key', key);
    lsSave();
    toast('Deepgram key saved ✓', 'ok');
  }, [dbSet, lsSave, toast]);

  const saveDeepgramLang = useCallback(async (lang: string) => {
    setDeepgramLang(lang);
    deepgramLangRef.current = lang;
    await dbSet('aria_config', 'deepgram_lang', lang);
    lsSave();
    toast('Language set: ' + lang, 'ok');
  }, [dbSet, lsSave, toast]);

  // ── Wake Word ──
  const startWakeWord = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Wake word not supported in this browser', 'err'); return; }
    const loop = () => {
      if (!wakeRecRef.current) return;
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.onresult = (e: any) => {
        const t = (e.results[0][0].transcript || '').toLowerCase();
        if (/\b(hey aria|aria|hey)\b/.test(t)) {
          toast('👂 Aria is listening...', 'ok');
          setTimeout(() => startMicFn(), 300);
        }
      };
      rec.onend = () => { if (wakeRecRef.current) setTimeout(loop, 400); };
      rec.onerror = () => { if (wakeRecRef.current) setTimeout(loop, 1000); };
      wakeRecRef.current = rec;
      try { rec.start(); } catch {}
    };
    wakeRecRef.current = {} as any;
    loop();
    setWakeWordActiveState(true);
    toast('🔊 Wake word active — say "Hey Aria"', 'ok');
  }, [startMicFn, toast]);

  const stopWakeWord = useCallback(() => {
    wakeRecRef.current = null;
    setWakeWordActiveState(false);
    toast('Wake word off');
  }, [toast]);

  const toggleWakeWord = useCallback(() => {
    wakeWordActive ? stopWakeWord() : startWakeWord();
  }, [wakeWordActive, startWakeWord, stopWakeWord]);

  const toggleMic = useCallback(() => {
    if (isListening) {
      deepgramKeyRef.current ? stopDeepgramMic() : stopMicFn();
    } else {
      deepgramKeyRef.current ? startDeepgramMic() : startMicFn();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, startMicFn, stopMicFn]);
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
    const prompt = text || `Analyze this image in full detail. Identify and describe:
1. Any people — their appearance, expression, posture, what they're doing, approximate age, clothing
2. Any animals — species, breed if possible, behavior
3. All visible objects — what they are, where they are (left/center/right/background/foreground), context
4. The environment — room type, lighting, mood, time of day if inferrable
5. Any text visible in the frame
Be specific and personal. Address ${profileRef.current.name || 'them'} directly. 2-4 sentences.`;
    const display = text || '📷 [Camera shared]';
    await callVision(f, prompt, display);
  }, [camActive, tryCamera, captureFrame, callVision, toast]);

  // ── Send Message ──
  const sendMsg = useCallback(async (text: string) => {
    if (!text && !currentAttachment) return;

    if (settingsRef.current.coachMode && text && text.trim().length > 10) {
      const coachPrefix = `COACH MODE: Do NOT give ${profileRef.current.name || 'me'} the answer directly. Instead, ask 1-3 powerful Socratic questions that will help them think through this themselves. Only give direct answers if they explicitly say "just tell me" or "give me the answer". Their message: `;
      setChatMsgs(prev => [...prev, { role: 'user', content: text }]);
      saveMsg('user', text);
      const coachMsgs = [...chatMsgsRef.current, { role: 'user', content: coachPrefix + text }]
        .slice(-40).map(m => ({ role: m.role, content: m.content }));
      await callAria(coachMsgs, false, text);
      return;
    }
    const att = currentAttachment;

    // Auto-vision detection
    const visionKeywords = /\b(look|see|watch|my face|i look|wearing|room|surroundings|what do you see|describe me|expression|who is|what is|identify|recognize|spot|notice|observe|camera|in front|behind me|next to|around me|in my room|on my desk|what am i|who am i|analyze|scan)\b/i;
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

  // ── Passive Auto-Describe ──
  const passiveDescTimerRef = useRef<any>(null);
  const startPassiveDesc = useCallback(() => {
    if (passiveDescTimerRef.current) clearInterval(passiveDescTimerRef.current);
    passiveDescTimerRef.current = setInterval(async () => {
      if (!settingsRef.current.autodesc) return;
      if (!settingsRef.current.cam) return;
      if (isSpeakingRef.current) return;
      if (orbStateRef.current !== 'idle') return;
      if (!apiKeyRef.current) return;
      const frame = captureFrame();
      if (!frame) return;
      await callVision(
        frame,
        `You are passively observing through the camera. Describe what you see in rich detail — identify any people, animals, objects, activities, body language, lighting, and mood. Note spatial positions (left, center, right, background, foreground). Be personal, warm, and observant. If you recognize the person, acknowledge them. Keep it to 2-3 sentences.`,
        '👁 [Passive observation]'
      );
    }, 5 * 60 * 1000);
  }, [captureFrame, callVision]);

  const stopPassiveDesc = useCallback(() => {
    if (passiveDescTimerRef.current) {
      clearInterval(passiveDescTimerRef.current);
      passiveDescTimerRef.current = null;
    }
  }, []);

  // ── Settings ──
  const toggleSetting = useCallback((key: keyof AriaSettings) => {
    setSettings(prev => {
      const ns = { ...prev, [key]: !prev[key] };
      settingsRef.current = ns;
      dbSet('aria_config', 'settings', ns);
      lsSave();
      if (key === 'cam') { ns[key] ? tryCamera() : stopCamera(); }
      if (key === 'proactive') { ns[key] ? startProactive() : clearInterval(proactiveTimerRef.current); }
      if (key === 'autodesc') { ns[key] ? startPassiveDesc() : stopPassiveDesc(); }
      return ns;
    });
  }, [dbSet, lsSave, tryCamera, stopCamera, startPassiveDesc, stopPassiveDesc]);

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
      sbUrlRef.current = cleanU;
      setSbAnon(newSbAnon);
      sbAnonRef.current = newSbAnon;
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

  const uploadFileToStorage = useCallback(async (file: File) => {
    if (!dbRef.current) return false;
    const bucket = 'aria-files';
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    try {
      const { error } = await dbRef.current.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      });
      if (error) throw error;
      return true;
    } catch (e: any) {
      console.warn('uploadFileToStorage:', e.message);
      if (/bucket|storage|not found|relation/i.test(e.message || '')) {
        toast('Run the storage SQL setup, then try uploading again.', 'err');
      } else {
        toast('Could not save file: ' + e.message, 'err');
      }
      return false;
    }
  }, [toast]);

  const processFile = useCallback(async (file: File, forChat: boolean) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const imgExts = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    const txtExts = ['txt', 'md', 'csv', 'json'];
    const supported = imgExts.includes(ext) || txtExts.includes(ext) || ext === 'pdf' || ext === 'docx';
    if (!supported) {
      toast('Unsupported file type: .' + ext, 'err');
      return;
    }

    toast('Reading ' + file.name + '...');
    const saved = await uploadFileToStorage(file);

    if (imgExts.includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = (e.target?.result as string) || '';
        const data = result.split(',')[1];
        const mime = file.type || 'image/png';
        if (forChat) {
          setCurrentAttachment({ type: 'image', name: file.name, data, mimeType: mime });
          toast(saved ? 'Image attached and saved ✓' : 'Image attached ✓', 'ok');
        } else {
          toast(saved ? 'Image saved: ' + file.name : 'Image loaded: ' + file.name, 'ok');
        }
      };
      reader.onerror = () => toast('Could not read ' + file.name, 'err');
      reader.readAsDataURL(file);
    } else if (txtExts.includes(ext)) {
      const content = await file.text();
      if (forChat) {
        setCurrentAttachment({ type: 'text', name: file.name, content });
        toast(saved ? 'File attached and saved ✓' : 'File attached ✓', 'ok');
      } else {
        toast(saved ? 'File saved: ' + file.name : 'File loaded: ' + file.name, 'ok');
      }
    } else if (ext === 'pdf') {
      const content = await readPDF(file);
      if (forChat) {
        setCurrentAttachment({ type: 'text', name: file.name, content });
        toast(saved ? 'PDF attached and saved ✓' : 'PDF attached ✓', 'ok');
      } else {
        toast(saved ? 'PDF saved: ' + file.name : 'PDF loaded: ' + file.name, 'ok');
      }
    } else if (ext === 'docx') {
      const content = await readDOCX(file);
      if (forChat) {
        setCurrentAttachment({ type: 'text', name: file.name, content });
        toast(saved ? 'DOCX attached and saved ✓' : 'DOCX attached ✓', 'ok');
      } else {
        toast(saved ? 'DOCX saved: ' + file.name : 'DOCX loaded: ' + file.name, 'ok');
      }
    }
  }, [toast, uploadFileToStorage]);

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
      try {
        const { data: storedFiles } = await dbRef.current.storage.from('aria-files').list('', {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' },
        });
        const paths = (storedFiles || []).map((file: any) => file.name).filter(Boolean);
        if (paths.length) await dbRef.current.storage.from('aria-files').remove(paths);
      } catch {}
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

  // ── Visual Observations (TensorFlow.js) ──
  const getDeviceType = () => {
    const ua = navigator.userAgent;
    if (/mobile/i.test(ua)) return 'mobile';
    if (/tablet|ipad/i.test(ua)) return 'tablet';
    return 'desktop';
  };

  const logVisualObservation = useCallback(async (label: string, confidence: number) => {
    if (!dbRef.current) return;
    try {
      await dbRef.current.from('visual_observations').insert({
        object_label: label,
        confidence_score: confidence,
        device_type: getDeviceType(),
      });
    } catch (e: any) { console.warn('logVisualObservation:', e.message); }
  }, []);

  // ── Web Ingestion & Passive Recall ──
const ingestUrl = useCallback(async (url: string) => {
    if (!dbRef.current) { toast('Not connected to database', 'err'); return; }
    toast('Ingesting URL...');
    try {
      let formattedUrl = url.trim();
      if (!formattedUrl.startsWith('http')) formattedUrl = 'https://' + formattedUrl;

      // Call Edge Function proxy to avoid browser CORS restrictions
      const { data, error } = await dbRef.current.functions.invoke('fetch-url-metadata', {
        body: { url: formattedUrl },
      });

      let title = formattedUrl;
      let description = '';

      if (!error && data && !data.error) {
        title = data.title || formattedUrl;
        description = data.description || '';
      }

      await dbRef.current.from('passive_recall_logs').insert({
        url: formattedUrl, title, description, device_type: getDeviceType(),
      });

      toast('URL ingested: ' + (title || formattedUrl), 'ok');
    } catch (e: any) {
      try {
        await dbRef.current!.from('passive_recall_logs').insert({
          url: url.trim(), title: url.trim(), description: 'Could not fetch metadata', device_type: getDeviceType(),
        });
        toast('URL saved (metadata unavailable)', 'ok');
      } catch (e2: any) { toast('Failed to ingest URL: ' + e2.message, 'err'); }
    }
  }, [toast]);

  const searchRecall = useCallback(async (query: string) => {
    if (!dbRef.current) return [];
    try {
      const { data } = await dbRef.current.from('passive_recall_logs').select('*').order('created_at', { ascending: false }).limit(100);
      const rows = data || [];
      if (!query) return rows;
      const q = query.toLowerCase();
      return rows.filter((r: any) =>
        r.url?.toLowerCase().includes(q) || r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
      );
    } catch { return []; }
  }, []);

  // ── Proactive Free Will ──
  const PROACTIVE_PROMPTS = [
    `You've been sitting quietly. Check in with ${profileRef.current.name || 'your person'} naturally — one warm sentence, then ask what's on their mind.`,
    `You just thought of something relevant based on what you know about ${profileRef.current.name || 'them'}. Share it unprompted — brief, genuine.`,
    `It's been a while since your last exchange. Gently re-engage. Don't reference the silence — just show up warm.`,
    `You have a memory or observation that feels relevant right now. Surface it naturally. One or two sentences max.`,
    `You're feeling curious about something ${profileRef.current.name || 'they'} mentioned before. Ask about it now — casually, like it just crossed your mind.`,
  ];

  const sendUnconventional = useCallback(async (text: string) => {
    const prefix = `Answer the following, but first: explicitly identify and then OMIT the 3 most common, generic, or obvious viewpoints on this topic. Only give non-obvious, underexplored, or contrarian perspectives that most people would not think of first. Be specific and concrete, not abstract. The question: `;
    setChatMsgs(prev => [...prev, { role: 'user', content: '✦ ' + text }]);
    saveMsg('user', text);
    const apiMsgs = [...chatMsgsRef.current, { role: 'user', content: prefix + text }]
      .slice(-40).map(m => ({ role: m.role, content: m.content }));
    await callAria(apiMsgs, false, text);
  }, [callAria, saveMsg]);

  const startProactive = useCallback(() => {
    if (proactiveTimerRef.current) clearInterval(proactiveTimerRef.current);
    proactiveTimerRef.current = setInterval(async () => {
      if (!settingsRef.current.proactive) return;
      if (isSpeakingRef.current) return;
      if (orbStateRef.current !== 'idle') return;
      if (!apiKeyRef.current) return;
      const prompt = PROACTIVE_PROMPTS[Math.floor(Math.random() * PROACTIVE_PROMPTS.length)];
      await callAria([{ role: 'user', content: prompt }], true);
    }, 8 * 60 * 1000);
  }, [callAria]);


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
      const storedDgKey = await dbGet('aria_config', 'deepgram_key');
      if (storedDgKey) { setDeepgramKey(storedDgKey); deepgramKeyRef.current = storedDgKey; }
      const storedDgLang = await dbGet('aria_config', 'deepgram_lang');
      if (storedDgLang) { setDeepgramLang(storedDgLang); deepgramLangRef.current = storedDgLang; }
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
      const hasAnthropicKey = Boolean(storedKey || apiKeyRef.current);
      if (hadMsgs) setHasGreeted(true);
      setIsSetupComplete(hasAnthropicKey);
      setSyncStatus({ state: 'ok', label: 'Supabase connected' });
      lsSave();
      setOrbState('idle');
      startProactive();
      if (storedSet?.autodesc !== false) startPassiveDesc();
      if (hasAnthropicKey && !hadMsgs) setTimeout(() => greet(), 600);
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
    sbUrlRef.current = cleanUrl;
    setSbAnon(supaAnon);
    sbAnonRef.current = supaAnon;
    await dbSet('aria_config', 'anthropic_key', anthropicKey);
    lsSave();
    setIsSetupComplete(true);
    await bootApp();
    return true;
  }, [tryConnect, dbSet, lsSave, bootApp, toast]);

  // ── Auto-boot: always connect using hardcoded credentials, overlay localStorage extras ──
  useEffect(() => {
    setSyncStatus({ state: 'busy', label: 'Connecting to Aria...' });
    const lc = (() => { try { return JSON.parse(localStorage.getItem('aria_v3') || ''); } catch { return null; } })();
    if (lc) {
      if (lc.apiKey) { setApiKey(lc.apiKey); apiKeyRef.current = lc.apiKey; }
      if (lc.elevenKey) { setElevenKey(lc.elevenKey); elevenKeyRef.current = lc.elevenKey; }
      if (lc.elevenVoiceId) { setElevenVoiceId(lc.elevenVoiceId); elevenVoiceIdRef.current = lc.elevenVoiceId; }
      if (lc.settings) { setSettings(prev => ({ ...prev, ...lc.settings })); settingsRef.current = { ...DEFAULT_SETTINGS, ...lc.settings }; }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const ok = await tryConnect(HARDCODED_SB_URL, HARDCODED_SB_ANON);
        if (ok) await bootApp();
      } else {
        setSyncStatus({ state: 'err', label: 'Not signed in' });
        setIsSetupComplete(false);
      }
    });
    tryConnect(HARDCODED_SB_URL, HARDCODED_SB_ANON).then(async (ok) => {
      if (ok) await bootApp();
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: AriaContextType = {
    isSetupComplete, apiKey, sbUrl, sbAnon, elevenKey, elevenVoiceId,
    profile, memory, chatMsgs, settings, orbState, isSpeaking, isListening,
    camActive, activePanel, syncStatus, currentAttachment, toastMsg, hasGreeted,
    camStreamRef, micStreamRef, lensActive, setLensActive,
    thinkingMode, setThinkingMode, sendUnconventional,
    emotionState, wakeWordActive, toggleWakeWord,
    deepgramKey, setDeepgramKey, saveDeepgramKey, liveTranscript,
    vadActive, toggleVAD,
    deepgramLang, setDeepgramLang, saveDeepgramLang,
    runSetup, setActivePanel, sendMsg, snapAndAsk, speak: speakFn, stopSpeak: stopSpeakFn,
    toggleMic, toggleVoice, toggleCam, toggleSetting, saveProfile: saveProfileFn,
    addMemory, delMemory, saveKeys, saveVoiceSettings, exportBackup: exportBackup,
    importBackup, clearChat, nukeAll, setAttachment: setCurrentAttachment,
    processFile, askAriaAboutFile, toast, tryCamera, stopCamera, captureFrame,
    loadHistory, addPerson, logVisualObservation, ingestUrl, searchRecall,
  };

  return <AriaContext.Provider value={value}>{children}</AriaContext.Provider>;
};
