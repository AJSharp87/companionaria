declare module '@vladmandic/face-api' {
  const faceapi: any;
  export = faceapi;
  export default faceapi;
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
