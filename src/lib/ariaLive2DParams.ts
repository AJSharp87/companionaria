// Live2D parameter mappings and Aria emotional state presets
// Cubism 4 standard parameter IDs.

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const LIVE2D_PARAMS = {
  angleX: 'ParamAngleX',
  angleY: 'ParamAngleY',
  angleZ: 'ParamAngleZ',
  bodyAngleX: 'ParamBodyAngleX',
  bodyAngleY: 'ParamBodyAngleY',
  bodyAngleZ: 'ParamBodyAngleZ',
  eyeLOpen: 'ParamEyeLOpen',
  eyeROpen: 'ParamEyeROpen',
  eyeBallX: 'ParamEyeBallX',
  eyeBallY: 'ParamEyeBallY',
  eyeLSmile: 'ParamEyeLSmile',
  eyeRSmile: 'ParamEyeRSmile',
  browLY: 'ParamBrowLY',
  browRY: 'ParamBrowRY',
  browLAngle: 'ParamBrowLAngle',
  browRAngle: 'ParamBrowRAngle',
  mouthOpenY: 'ParamMouthOpenY',
  mouthForm: 'ParamMouthForm',
  breath: 'ParamBreath',
  cheek: 'ParamCheek',
  tere: 'ParamTere',
  braidPink: 'ParamBraidPinkSwing',
  braidBlack: 'ParamBraidBlackSwing',
} as const;

export interface AriaStateParams {
  browY: number;
  browAngle: number;
  headSwayX: number;
  headSwayY: number;
  headSwaySpeed: number;
  eyeSmile: number;
}

export const ARIA_STATE_PARAMS: Record<string, AriaStateParams> = {
  idle:      { browY: 0,    browAngle: 0,    headSwayX: 6,  headSwayY: 3,  headSwaySpeed: 0.4, eyeSmile: 0 },
  thinking:  { browY: -0.3, browAngle: -0.2, headSwayX: 4,  headSwayY: 6,  headSwaySpeed: 0.3, eyeSmile: 0 },
  speaking:  { browY: 0.2,  browAngle: 0.1,  headSwayX: 10, headSwayY: 5,  headSwaySpeed: 0.9, eyeSmile: 0.2 },
  listening: { browY: 0.4,  browAngle: 0.1,  headSwayX: 3,  headSwayY: 2,  headSwaySpeed: 0.3, eyeSmile: 0.1 },
  excited:   { browY: 0.6,  browAngle: 0.2,  headSwayX: 14, headSwayY: 7,  headSwaySpeed: 1.2, eyeSmile: 0.6 },
  happy:     { browY: 0.3,  browAngle: 0.1,  headSwayX: 8,  headSwayY: 4,  headSwaySpeed: 0.7, eyeSmile: 0.5 },
  curious:   { browY: 0.5,  browAngle: 0.3,  headSwayX: 6,  headSwayY: 8,  headSwaySpeed: 0.5, eyeSmile: 0.1 },
  concerned: { browY: -0.5, browAngle: -0.3, headSwayX: 3,  headSwayY: 3,  headSwaySpeed: 0.3, eyeSmile: 0 },
  intimate:  { browY: 0.1,  browAngle: 0,    headSwayX: 5,  headSwayY: 3,  headSwaySpeed: 0.4, eyeSmile: 0.3 },
  calm:      { browY: 0,    browAngle: 0,    headSwayX: 4,  headSwayY: 2,  headSwaySpeed: 0.3, eyeSmile: 0.1 },
  neutral:   { browY: 0,    browAngle: 0,    headSwayX: 6,  headSwayY: 3,  headSwaySpeed: 0.4, eyeSmile: 0 },
};

export interface AriaEmotionParams {
  mouthForm: number;
  mouthOpen: number;
  eyeSmile: number;
  tere: number;
  shake: number;
  motionGroup: string | null;
}

export const ARIA_EMOTION_PARAMS: Record<string, AriaEmotionParams> = {
  idle:      { mouthForm: 0,    mouthOpen: 0,    eyeSmile: 0,    tere: 0,    shake: 0,    motionGroup: 'Idle' },
  thinking:  { mouthForm: -0.2, mouthOpen: 0,    eyeSmile: 0,    tere: 0,    shake: 0,    motionGroup: null },
  speaking:  { mouthForm: 0.2,  mouthOpen: 0.4,  eyeSmile: 0.2,  tere: 0.05, shake: 0.1,  motionGroup: 'Speak' },
  listening: { mouthForm: 0.1,  mouthOpen: 0,    eyeSmile: 0.1,  tere: 0,    shake: 0,    motionGroup: null },
  excited:   { mouthForm: 0.7,  mouthOpen: 0.3,  eyeSmile: 0.6,  tere: 0.3,  shake: 0.5,  motionGroup: 'Tap' },
  happy:     { mouthForm: 0.5,  mouthOpen: 0.1,  eyeSmile: 0.5,  tere: 0.2,  shake: 0.1,  motionGroup: null },
  curious:   { mouthForm: 0.1,  mouthOpen: 0.05, eyeSmile: 0.1,  tere: 0.05, shake: 0,    motionGroup: null },
  concerned: { mouthForm: -0.5, mouthOpen: 0,    eyeSmile: 0,    tere: 0,    shake: 0,    motionGroup: null },
  intimate:  { mouthForm: 0.3,  mouthOpen: 0,    eyeSmile: 0.3,  tere: 0.6,  shake: 0,    motionGroup: null },
  calm:      { mouthForm: 0.1,  mouthOpen: 0,    eyeSmile: 0.1,  tere: 0,    shake: 0,    motionGroup: null },
  neutral:   { mouthForm: 0,    mouthOpen: 0,    eyeSmile: 0,    tere: 0,    shake: 0,    motionGroup: null },
};

export const ARIA_GLOW_PALETTE: Record<string, string> = {
  idle:      '0, 220, 255',
  thinking:  '180, 120, 255',
  speaking:  '255, 120, 200',
  listening: '100, 230, 220',
  excited:   '255, 200, 80',
  happy:     '180, 255, 160',
  curious:   '120, 255, 200',
  concerned: '255, 120, 120',
  intimate:  '255, 150, 210',
  calm:      '180, 200, 255',
  neutral:   '0, 220, 255',
};

export function getAriaGlow(orbState?: string, emotionState?: string): string {
  const key = (orbState && orbState !== 'idle' ? orbState : emotionState) || 'idle';
  return ARIA_GLOW_PALETTE[key] || ARIA_GLOW_PALETTE.idle;
}
