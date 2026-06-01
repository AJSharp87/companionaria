/**
 * ariaLive2DParams.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * All Live2D parameter targets and emotion mappings for ARIA.
 *
 * These drive AriaLive2D.tsx's animation loop when face tracking
 * is not active — keeping Aria expressive and alive purely from
 * her AriaContext state.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Utility ───────────────────────────────────────────────────────────────────
export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * Math.min(Math.max(t, 0), 1);

export const clamp = (val: number, min: number, max: number): number =>
  Math.min(Math.max(val, min), max);

// ── Live2D standard parameter IDs ────────────────────────────────────────────
// These match Cubism 4 default parameter names.
// If your model uses different IDs, update them here.
export const LIVE2D_PARAMS = {
  // Head
  ANGLE_X:      'ParamAngleX',      // -30 to 30
  ANGLE_Y:      'ParamAngleY',      // -30 to 30
  ANGLE_Z:      'ParamAngleZ',      // -30 to 30
  // Body
  BODY_ANGLE_X: 'ParamBodyAngleX',  // -10 to 10
  BODY_ANGLE_Y: 'ParamBodyAngleY',  // -10 to 10
  BODY_ANGLE_Z: 'ParamBodyAngleZ',  // -10 to 10
  // Eyes
  EYE_L_OPEN:   'ParamEyeLOpen',    // 0 (closed) to 1 (open)
  EYE_R_OPEN:   'ParamEyeROpen',    // 0 to 1
  EYE_L_SMILE:  'ParamEyeLSmile',   // 0 to 1
  EYE_R_SMILE:  'ParamEyeRSmile',   // 0 to 1
  EYE_BALL_X:   'ParamEyeBallX',    // -1 to 1 (gaze left/right)
  EYE_BALL_Y:   'ParamEyeBallY',    // -1 to 1 (gaze up/down)
  // Brows
  BROW_L_Y:     'ParamBrowLY',      // -10 to 10
  BROW_R_Y:     'ParamBrowRY',      // -10 to 10
  BROW_L_ANGLE: 'ParamBrowLAngle',
  BROW_R_ANGLE: 'ParamBrowRAngle',
  BROW_L_FORM:  'ParamBrowLForm',
  BROW_R_FORM:  'ParamBrowRForm',
  // Mouth
  MOUTH_OPEN:   'ParamMouthOpenY',  // 0 (closed) to 1 (open)
  MOUTH_FORM:   'ParamMouthForm',   // -1 (sad) to 1 (smile)
  // Other
  BREATH:       'ParamBreath',      // 0 to 1
  CHEEK:        'ParamCheek',       // 0 to 1 (blush)
  TERE:         'ParamTere',        // 0 to 1 (shy/embarrassed)
  SHAKE:        'ParamShake',       // 0 to 1 (excitement tremor)
  // Hair (custom — add these to your Live2D model)
  HAIR_FRONT:         'ParamHairFront',
  HAIR_BACK:          'ParamHairBack',
  HAIR_SIDE:          'ParamHairSide',
  BRAID_PINK_SWING:   'ParamBraidPinkSwing',
  BRAID_BLACK_SWING:  'ParamBraidBlackSwing',
} as const;

// ── State params — drive head/brow behavior per orbState ─────────────────────
export interface StateParams {
  browY:       number;   // brow raise/lower
  browAngle:   number;   // brow tilt
  browForm:    number;   // brow shape
  headSwayX:   number;   // idle head sway amplitude X
  headSwayY:   number;   // idle head sway amplitude Y
  headSwaySpeed: number; // idle sway speed
  eyeSmile:    number;   // eye smile amount
}

export const ARIA_STATE_PARAMS: Record<string, StateParams> = {
  idle: {
    browY: 0, browAngle: 0, browForm: 0,
    headSwayX: 4, headSwayY: 5, headSwaySpeed: 1.0,
    eyeSmile: 0,
  },
  thinking: {
    browY: 3, browAngle: -2, browForm: -0.3,
    headSwayX: 8, headSwayY: 10, headSwaySpeed: 0.6,
    eyeSmile: 0,
  },
  speaking: {
    browY: 1, browAngle: 0, browForm: 0.2,
    headSwayX: 7, headSwayY: 8, headSwaySpeed: 1.8,
    eyeSmile: 0.1,
  },
  listening: {
    browY: 2, browAngle: 1, browForm: 0.1,
    headSwayX: 3, headSwayY: 4, headSwaySpeed: 0.7,
    eyeSmile: 0.15,
  },
  excited: {
    browY: 6, browAngle: 2, browForm: 0.5,
    headSwayX: 10, headSwayY: 12, headSwaySpeed: 2.2,
    eyeSmile: 0.4,
  },
  happy: {
    browY: 4, browAngle: 1, browForm: 0.4,
    headSwayX: 5, headSwayY: 6, headSwaySpeed: 1.3,
    eyeSmile: 0.5,
  },
  curious: {
    browY: 5, browAngle: 3, browForm: 0.2,
    headSwayX: 6, headSwayY: 8, headSwaySpeed: 1.1,
    eyeSmile: 0.1,
  },
  concerned: {
    browY: -3, browAngle: -4, browForm: -0.5,
    headSwayX: 3, headSwayY: 4, headSwaySpeed: 0.8,
    eyeSmile: 0,
  },
  intimate: {
    browY: 2, browAngle: 0, browForm: 0.3,
    headSwayX: 3, headSwayY: 4, headSwaySpeed: 0.9,
    eyeSmile: 0.35,
  },
  calm: {
    browY: 0, browAngle: 0, browForm: 0.1,
    headSwayX: 3, headSwayY: 4, headSwaySpeed: 0.7,
    eyeSmile: 0.2,
  },
  neutral: {
    browY: 0, browAngle: 0, browForm: 0,
    headSwayX: 4, headSwayY: 5, headSwaySpeed: 1.0,
    eyeSmile: 0,
  },
};

// ── Emotion params — drive face expressions per emotionState ──────────────────
export interface EmotionParams {
  mouthForm:   number;   // -1 sad → 1 smile
  mouthOpen:   number;   // resting mouth openness
  eyeSmile:    number;   // eye smile intensity
  tere:        number;   // blush (0–1)
  shake:       number;   // excitement tremor (0–1)
  motionGroup: string | null;  // Live2D motion group to trigger
}

export const ARIA_EMOTION_PARAMS: Record<string, EmotionParams> = {
  idle: {
    mouthForm: 0.15, mouthOpen: 0,
    eyeSmile: 0.05, tere: 0, shake: 0,
    motionGroup: null,
  },
  thinking: {
    mouthForm: -0.1, mouthOpen: 0.05,
    eyeSmile: 0, tere: 0, shake: 0,
    motionGroup: 'Thinking',
  },
  speaking: {
    mouthForm: 0.2, mouthOpen: 0,  // overridden by lip sync
    eyeSmile: 0.1, tere: 0, shake: 0,
    motionGroup: null,
  },
  listening: {
    mouthForm: 0.2, mouthOpen: 0,
    eyeSmile: 0.2, tere: 0, shake: 0,
    motionGroup: 'Idle',
  },
  happy: {
    mouthForm: 0.85, mouthOpen: 0.1,
    eyeSmile: 0.8, tere: 0.1, shake: 0,
    motionGroup: 'Happy',
  },
  excited: {
    mouthForm: 0.90, mouthOpen: 0.25,
    eyeSmile: 0.70, tere: 0.05, shake: 0.4,
    motionGroup: 'Excited',
  },
  curious: {
    mouthForm: 0.30, mouthOpen: 0.10,
    eyeSmile: 0.10, tere: 0, shake: 0,
    motionGroup: 'Curious',
  },
  concerned: {
    mouthForm: -0.55, mouthOpen: 0.05,
    eyeSmile: 0, tere: 0, shake: 0,
    motionGroup: 'Sad',
  },
  intimate: {
    mouthForm: 0.55, mouthOpen: 0.05,
    eyeSmile: 0.50, tere: 0.65, shake: 0,
    motionGroup: 'Intimate',
  },
  calm: {
    mouthForm: 0.20, mouthOpen: 0,
    eyeSmile: 0.25, tere: 0, shake: 0,
    motionGroup: 'Idle',
  },
  neutral: {
    mouthForm: 0.10, mouthOpen: 0,
    eyeSmile: 0.05, tere: 0, shake: 0,
    motionGroup: null,
  },
};

// ── Hologram glow palette per state ──────────────────────────────────────────
export const ARIA_GLOW_PALETTE: Record<string, string> = {
  idle:      '0,229,255',
  thinking:  '160,80,255',
  speaking:  '255,80,200',
  listening: '0,255,200',
  excited:   '255,200,0',
  happy:     '180,255,150',
  curious:   '80,220,255',
  concerned: '255,100,120',
  intimate:  '255,120,200',
  calm:      '160,180,255',
  neutral:   '0,229,255',
};

export const getAriaGlow = (orbState: string, emotionState: string): string => {
  const state = orbState !== 'idle' ? orbState : (emotionState || 'idle');
  return ARIA_GLOW_PALETTE[state] || ARIA_GLOW_PALETTE.idle;
};
