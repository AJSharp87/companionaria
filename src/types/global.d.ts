declare module '@vladmandic/face-api' {
  const faceapi: {
    nets: any;
    detectAllFaces: any;
    TinyFaceDetectorOptions: any;
    matchDimensions: any;
    resizeResults: any;
    draw: any;
    [key: string]: any;
  };
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
