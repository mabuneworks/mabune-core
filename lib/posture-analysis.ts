/**
 * 画像から検出した姿勢ランドマーク（MediaPipe Pose の worldLandmarks）を、
 * このカルテアプリの「7段階評価プロトコル」（顔・肩上・軸・AS・大転子・肘・肩・耳・
 * 肩内旋左右）のスコアに変換するロジック。
 *
 * スコアは 2.0〜5.0（0.5刻み、3.5=左右差なし）の連続値で、原則として
 * 「体の左（患者本人の左）に偏っているほど 2 に近く、右に偏っているほど 5 に近い」
 * という単一の規則で統一している（4項目に用意されている左右セレクターは、
 * このスコアが 3.5 未満なら「左」・以上なら「右」を機械的に反映したもの）。
 *
 * これは実測値から導いた一次近似であり、施術者ごとの臨床的な判断基準とは
 * 必ずしも一致しない。SENSITIVITY 定数を調整するか、結果を確認のうえ
 * 手動でスライダーを補正して使うことを前提とする。
 */

export type MetaSide = '左' | '右';
export type FaceType = '捻れ' | '傾き' | 'スライド';

export type NumericKey =
  | '顔'
  | '肩上'
  | '軸'
  | 'AS'
  | '大転子'
  | '肘'
  | '肩'
  | '耳'
  | '肩内旋左'
  | '肩内旋右';

export interface PostureAnalysisResult {
  numeric: Partial<Record<NumericKey, number>>;
  meta: {
    顔_左右?: MetaSide;
    顔_種類?: FaceType;
    肩上_左右?: MetaSide;
    軸_左右?: MetaSide;
    AS_左右?: MetaSide;
  };
  warnings: string[];
}

interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

// 左右の横方向のズレ・高さの差を score(2.0〜5.0) に変換する感度。
// 値を大きくすると、わずかな左右差でも 2 か 5 に張り付きやすくなる。
const SENSITIVITY_LATERAL = 10;
// 前後（奥行き = z）方向は単眼画像からの推定精度が低いため、感度を抑える。
const SENSITIVITY_DEPTH = 6;

const LM = {
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));

function toScore(deviation: number, sensitivity: number): number {
  const raw = 3.5 + clamp(deviation * sensitivity, -1.5, 1.5);
  return Math.round(raw * 2) / 2;
}

function sub(a: Landmark, b: Landmark) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function mid(a: Landmark, b: Landmark): Landmark {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2, visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1) };
}

function dist(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) || 1e-6;
}

function normalize3(v: { x: number; y: number; z: number }) {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function dot3(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** axis 方向に沿って、origin から見た point の位置（符号付き距離）を返す */
function along(axis: { x: number; y: number; z: number }, origin: Landmark, point: Landmark) {
  return dot3(axis, sub(point, origin));
}

const MIN_VISIBILITY = 0.4;

function visible(...points: Landmark[]) {
  return points.every((p) => (p.visibility ?? 1) >= MIN_VISIBILITY);
}

/**
 * @param landmarks MediaPipe PoseLandmarker の `worldLandmarks[0]`（33点・メートル単位）
 */
export function analyzePostureFromLandmarks(landmarks: Landmark[]): PostureAnalysisResult {
  const warnings: string[] = [];
  const result: PostureAnalysisResult = { numeric: {}, meta: {}, warnings };

  if (!landmarks || landmarks.length < 29) {
    warnings.push('姿勢ランドマークを取得できませんでした。写真の写り方（全身が写っているか等）を確認してください。');
    return result;
  }

  const L_SHOULDER = landmarks[LM.LEFT_SHOULDER];
  const R_SHOULDER = landmarks[LM.RIGHT_SHOULDER];
  const L_HIP = landmarks[LM.LEFT_HIP];
  const R_HIP = landmarks[LM.RIGHT_HIP];

  if (!visible(L_SHOULDER, R_SHOULDER, L_HIP, R_HIP)) {
    warnings.push('肩・腰のランドマークの検出信頼度が低いため、解析結果の精度が低い可能性があります。正面から全身が写った写真を推奨します。');
  }

  const shoulderWidth = dist(L_SHOULDER, R_SHOULDER);
  const hipWidth = dist(L_HIP, R_HIP);
  const shoulderMid = mid(L_SHOULDER, R_SHOULDER);
  const hipMid = mid(L_HIP, R_HIP);

  // 体幹に沿った「上」方向と、患者本人から見た「右」方向の軸を、実測点から都度算出する。
  // カメラに対して体が多少傾いていても、体自身の軸を基準にするため影響を受けにくい。
  const up = normalize3(sub(shoulderMid, hipMid));
  const right = normalize3(sub(R_SHOULDER, L_SHOULDER));

  const applySideMeta = (score: number): MetaSide => (score >= 3.5 ? '右' : '左');

  // --- 肩上：肩の高さの左右差 ---
  {
    const heightL = along(up, hipMid, L_SHOULDER);
    const heightR = along(up, hipMid, R_SHOULDER);
    const deviation = (heightR - heightL) / shoulderWidth;
    const score = toScore(deviation, SENSITIVITY_LATERAL);
    result.numeric['肩上'] = score;
    result.meta.肩上_左右 = applySideMeta(score);
  }

  // --- 耳：耳の高さの左右差 ---
  {
    const L_EAR = landmarks[LM.LEFT_EAR];
    const R_EAR = landmarks[LM.RIGHT_EAR];
    if (visible(L_EAR, R_EAR)) {
      const heightL = along(up, hipMid, L_EAR);
      const heightR = along(up, hipMid, R_EAR);
      const deviation = (heightR - heightL) / shoulderWidth;
      result.numeric['耳'] = toScore(deviation, SENSITIVITY_LATERAL);
    } else {
      warnings.push('耳のランドマークが検出できず「耳」のスコアは計算していません。');
    }
  }

  // --- 肘：肘の高さの左右差 ---
  {
    const L_ELBOW = landmarks[LM.LEFT_ELBOW];
    const R_ELBOW = landmarks[LM.RIGHT_ELBOW];
    if (visible(L_ELBOW, R_ELBOW)) {
      const heightL = along(up, hipMid, L_ELBOW);
      const heightR = along(up, hipMid, R_ELBOW);
      const deviation = (heightR - heightL) / shoulderWidth;
      result.numeric['肘'] = toScore(deviation, SENSITIVITY_LATERAL);
    } else {
      warnings.push('肘のランドマークが検出できず「肘」のスコアは計算していません。両腕が写った写真を推奨します。');
    }
  }

  // --- AS（ASIS）：骨盤（腰）の高さの左右差 ---
  {
    const heightL = along(up, hipMid, L_HIP);
    const heightR = along(up, hipMid, R_HIP);
    const deviation = (heightR - heightL) / hipWidth;
    const score = toScore(deviation, SENSITIVITY_LATERAL);
    result.numeric['AS'] = score;
    result.meta.AS_左右 = applySideMeta(score);
  }

  // --- 軸：肩の中心が腰の中心に対して左右どちらへ寄っているか ---
  {
    const deviation = along(right, hipMid, shoulderMid) / shoulderWidth;
    const score = toScore(deviation, SENSITIVITY_LATERAL);
    result.numeric['軸'] = score;
    result.meta.軸_左右 = applySideMeta(score);
  }

  // --- 大転子：骨盤の中心が、足首の中心（支持基底面）に対して左右どちらへ寄っているか ---
  {
    const L_ANKLE = landmarks[LM.LEFT_ANKLE];
    const R_ANKLE = landmarks[LM.RIGHT_ANKLE];
    if (visible(L_ANKLE, R_ANKLE)) {
      const ankleMid = mid(L_ANKLE, R_ANKLE);
      const deviation = along(right, ankleMid, hipMid) / shoulderWidth;
      result.numeric['大転子'] = toScore(deviation, SENSITIVITY_LATERAL);
    } else {
      warnings.push('足首のランドマークが検出できず「大転子」のスコアは計算していません。全身が写った写真を推奨します。');
    }
  }

  // --- 肩：肩の前後の丸まり（奥行き方向、腰に対する肩の前方突出） ---
  {
    const depthL = L_SHOULDER.z - L_HIP.z;
    const depthR = R_SHOULDER.z - R_HIP.z;
    const forwardness = -((depthL + depthR) / 2) / shoulderWidth;
    result.numeric['肩'] = toScore(forwardness, SENSITIVITY_DEPTH);
    warnings.push('「肩」（前後の丸まり）は奥行き方向の推定のため精度が低めです。参考値としてご確認ください。');
  }

  // --- 肩内旋左右：肘が肩よりどれだけ前方に出ているか（内旋の簡易近似） ---
  {
    const L_ELBOW = landmarks[LM.LEFT_ELBOW];
    const R_ELBOW = landmarks[LM.RIGHT_ELBOW];
    if (visible(L_ELBOW, R_ELBOW)) {
      const forwardL = -(L_ELBOW.z - L_SHOULDER.z) / shoulderWidth;
      const forwardR = -(R_ELBOW.z - R_SHOULDER.z) / shoulderWidth;
      result.numeric['肩内旋左'] = toScore(forwardL, SENSITIVITY_DEPTH);
      result.numeric['肩内旋右'] = toScore(forwardR, SENSITIVITY_DEPTH);
      warnings.push('「肩内旋左右」は前腕・手首の向きまでは判定できないため、肘の前方突出量からの簡易近似値です。');
    }
  }

  // --- 顔：傾き（目の高さ差）／捻れ（鼻の左右回転）／スライド（頭部全体の水平移動）のうち最大のものを採用 ---
  {
    const L_EYE = landmarks[LM.LEFT_EYE];
    const R_EYE = landmarks[LM.RIGHT_EYE];
    const L_EAR = landmarks[LM.LEFT_EAR];
    const R_EAR = landmarks[LM.RIGHT_EAR];
    const NOSE = landmarks[LM.NOSE];

    if (visible(L_EYE, R_EYE, L_EAR, R_EAR, NOSE)) {
      const earMid = mid(L_EAR, R_EAR);
      const tilt = (along(up, earMid, R_EYE) - along(up, earMid, L_EYE)) / shoulderWidth;
      const twist = along(right, earMid, NOSE) / shoulderWidth;
      const slideAmount = along(right, shoulderMid, earMid) / shoulderWidth;

      const candidates: { type: FaceType; value: number }[] = [
        { type: '傾き', value: tilt },
        { type: '捻れ', value: twist },
        { type: 'スライド', value: slideAmount },
      ];
      const dominant = candidates.reduce((best, cur) => (Math.abs(cur.value) > Math.abs(best.value) ? cur : best));

      const score = toScore(dominant.value, SENSITIVITY_LATERAL);
      result.numeric['顔'] = score;
      result.meta.顔_種類 = dominant.type;
      result.meta.顔_左右 = applySideMeta(score);
    } else {
      warnings.push('顔のランドマークが検出できず「顔」のスコアは計算していません。');
    }
  }

  return result;
}
