// ブラウザ上（クライアントサイド）で MediaPipe Pose Landmarker を動かすための薄いラッパー。
// wasm・モデルは外部CDNに依存せず /public/mediapipe に同梱している
// （このアプリはオフライン運用のPWAのため、施術所のネットワークからCDNへ
//   到達できない環境でも自動解析だけは動くようにするため）。

let landmarkerPromise: Promise<import('@mediapipe/tasks-vision').PoseLandmarker> | null = null;

const WASM_BASE_URL = '/mediapipe/wasm';
const MODEL_URL = '/mediapipe/models/pose_landmarker_lite.task';

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
      return PoseLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        numPoses: 1,
      });
    })().catch((error) => {
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

export interface DetectedPose {
  landmarks: { x: number; y: number; z: number; visibility?: number }[];
  worldLandmarks: { x: number; y: number; z: number; visibility?: number }[];
}

/** 画像1枚から姿勢ランドマークを検出する。人物が検出できない場合は null を返す。 */
export async function detectPoseFromImage(image: HTMLImageElement): Promise<DetectedPose | null> {
  const landmarker = await getLandmarker();
  const result = landmarker.detect(image);
  const landmarks = result.landmarks?.[0];
  const worldLandmarks = result.worldLandmarks?.[0];
  if (!landmarks || !worldLandmarks) return null;
  return { landmarks, worldLandmarks };
}
