declare module '@vladmandic/face-api' {
  export * from 'face-api.js';
}

declare module '@vladmandic/face-api' {
  const faceapi: any;
  export = faceapi;
}

declare global {
  interface Window {
    pdfjsLib: any;
    mammoth: any;
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
export {};
