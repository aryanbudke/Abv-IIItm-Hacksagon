import * as faceapi from 'face-api.js';

export class FaceVerification {
  private modelsLoaded = false;

  async loadModels() {
    if (this.modelsLoaded) return;

    const MODEL_URL = '/models';
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
    ]);

    this.modelsLoaded = true;
  }

  async detectFace(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) {
    await this.loadModels();

    const detection = await faceapi
      .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    return detection;
  }

  async extractFaceEmbedding(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<number[] | null> {
    const detection = await this.detectFace(imageElement);
    
    if (!detection) {
      return null;
    }

    return Array.from(detection.descriptor);
  }

  compareFaces(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Face embeddings must have the same length');
    }

    const distance = faceapi.euclideanDistance(embedding1, embedding2);
    const similarity = 1 - distance;
    
    return similarity;
  }

  verifyFace(embedding1: number[], embedding2: number[], threshold: number = 0.6): boolean {
    const similarity = this.compareFaces(embedding1, embedding2);
    return similarity >= threshold;
  }

  async captureFromVideo(videoElement: HTMLVideoElement): Promise<number[] | null> {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(videoElement, 0, 0);
    
    return await this.extractFaceEmbedding(canvas);
  }
}

export const faceVerification = new FaceVerification();
