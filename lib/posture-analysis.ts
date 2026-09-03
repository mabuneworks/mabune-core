/**
 * 「マスタープロトコル　物理演算エンジン (The Formula: 美の偏差値)」に基づき、
 * MediaPipe Pose の検出結果を、このカルテアプリの「7段階評価」の各スコアに変換する。
 *
 * プロトコル要点（アップロードされた元文書より）：
 * - 原点は「くるぶしの中心」。レベルは 1.0（完璧・逸脱0cm）〜5.0（最大変形）を
 *   0.5刻みで判定し、項目ごとに「レベル3＝約Xcm」「レベル4＝約Ycm」の実測アンカーが
 *   定義されている（本ファイルの LEVEL_ANCHORS）。
 * - 左右バランス（SYMMETRY）＝ 顔・肩上・ウエスト・AS・左右肩内旋 は正面写真で判定。
 * - 前後バランス（VERTICAL ALIGNMENT）＝ 耳・肩・大転子・肘比率 は「くるぶし垂直線からの
 *   前方偏位」＝側面写真で判定する項目であり、正面写真だけでは確度が出ない。
 * - AS（骨盤の捻れ＝ASIS前後位置）は施術者が実測（触診）して入力する項目であり、
 *   画像単独では確度が出ないため自動解析の対象外（ユーザー指定）。
 *
 * このアプリの UI 側スライダーは 2.0〜5.0 の範囲しか受け付けないため、算出したレベルは
 * 最終的に [2.0, 5.0] にクランプしてから 0.5 刻みに丸めている（本来のプロトコルは 1.0 が
 * 「完璧」だが、UI 側の入力下限に合わせている）。
 */

export type MetaSide = '左' | '右';
export type FaceType = '捻れ' | '傾き' | 'スライド';

export type SymmetryNumericKey = '顔' | '肩上' | '軸' | '肩内旋左' | '肩内旋右';
export type VerticalNumericKey = '大転子' | '肩' | '耳' | '肘';

export interface FrontPostureAnalysis {
  numeric: Partial<Record<SymmetryNumericKey, number>>;
  meta: {
    顔_左右?: MetaSide;
    顔_種類?: FaceType;
    肩上_左右?: MetaSide;
    軸_左右?: MetaSide;
  };
  warnings: string[];
}

export interface SidePostureAnalysis {
  numeric: Partial<Record<VerticalNumericKey, number>>;
  warnings: string[];
}

interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface LevelAnchor {
  /** レベル3.0に相当する逸脱量（cm） */
  level3: number;
  /** レベル4.0に相当する逸脱量（cm） */
  level4: number;
}

// プロトコル文書「4. 査定項目別・物理メトリクス」に記載の実測アンカー。
const SYMMETRY_ANCHORS: Record<SymmetryNumericKey, LevelAnchor> = {
  顔: { level3: 2, level4: 3 },
  肩上: { level3: 3, level4: 4 },
  軸: { level3: 2, level4: 3 }, // プロトコル上は「ウエスト」（左右のくびれラインの深度と高さの差）
  肩内旋左: { level3: 3, level4: 5 }, // プロトコルは「丸い／三角」の形状評価で明示的なcm値なし。近似値。
  肩内旋右: { level3: 3, level4: 5 },
};

const VERTICAL_ANCHORS: Record<VerticalNumericKey, LevelAnchor> = {
  大転子: { level3: 4, level4: 7 },
  肩: { level3: 3, level4: 4 },
  耳: { level3: 4, level4: 7 },
  肘: { level3: 3, level4: 4 }, // プロトコルは肘の前後長さ比で明示的なcm値なし。近似値。
};

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

const MIN_VISIBILITY = 0.4;

function visible(...points: Landmark[]) {
  return points.every((p) => (p.visibility ?? 1) >= MIN_VISIBILITY);
}

function moreVisible(a: Landmark, b: Landmark) {
  return (a.visibility ?? 1) >= (b.visibility ?? 1) ? a : b;
}

function sub(a: Landmark, b: Landmark) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function mid(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

function dist3(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function dist2(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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

/**
 * worldLandmarks（実寸・メートル単位）上のある2点間の距離を「ものさし」として、
 * 同じ2点の imageLandmarks（画像正規化座標）上の距離との比から
 * 「画像正規化座標 1 単位 ＝ 何cmか」を算出する。
 */
function cmPerImageUnit(imgA: Landmark, imgB: Landmark, worldA: Landmark, worldB: Landmark): number | null {
  const imgDist = dist2(imgA, imgB);
  if (imgDist < 1e-6) return null;
  const worldCm = dist3(worldA, worldB) * 100;
  return worldCm / imgDist;
}

/** 逸脱量（cm、符号なし）をプロトコルのレベル（1.0〜5.0）に変換する */
function cmToLevel(cm: number, anchor: LevelAnchor): number {
  const abs = Math.abs(cm);
  if (abs <= anchor.level3) {
    return 1.0 + (abs / anchor.level3) * 2.0;
  }
  const slope = 1.0 / (anchor.level4 - anchor.level3);
  return 3.0 + (abs - anchor.level3) * slope;
}

/** UIのスライダーが受け付ける範囲（2.0〜5.0、0.5刻み）に丸める */
function toUiScore(level: number): number {
  const clamped = Math.max(2.0, Math.min(5.0, level));
  return Math.round(clamped * 2) / 2;
}

/**
 * 正面写真から「左右バランス」グループ（顔・肩上・軸＝ウエスト・肩内旋左右）を判定する。
 * AS（骨盤の捻れ）はプロトコル上、触診による実測が前提のため対象外。
 *
 * @param imageLandmarks MediaPipe PoseLandmarker の `landmarks[0]`（画像正規化座標）
 * @param worldLandmarks 同 `worldLandmarks[0]`（実寸・メートル単位）
 */
export function analyzeFrontPosture(imageLandmarks: Landmark[], worldLandmarks: Landmark[]): FrontPostureAnalysis {
  const warnings: string[] = [];
  const result: FrontPostureAnalysis = { numeric: {}, meta: {}, warnings };

  if (!imageLandmarks || imageLandmarks.length < 29 || !worldLandmarks || worldLandmarks.length < 29) {
    warnings.push('姿勢ランドマークを取得できませんでした。正面から全身が写った写真かご確認ください。');
    return result;
  }

  const L_SHOULDER = imageLandmarks[LM.LEFT_SHOULDER];
  const R_SHOULDER = imageLandmarks[LM.RIGHT_SHOULDER];
  const L_HIP = imageLandmarks[LM.LEFT_HIP];
  const R_HIP = imageLandmarks[LM.RIGHT_HIP];
  const wL_SHOULDER = worldLandmarks[LM.LEFT_SHOULDER];
  const wR_SHOULDER = worldLandmarks[LM.RIGHT_SHOULDER];

  if (!visible(L_SHOULDER, R_SHOULDER, L_HIP, R_HIP)) {
    warnings.push('肩・腰のランドマークの検出信頼度が低く、精度が低い可能性があります。');
  }

  const scale = cmPerImageUnit(L_SHOULDER, R_SHOULDER, wL_SHOULDER, wR_SHOULDER);
  if (!scale) {
    warnings.push('体格スケールを推定できず解析を中止しました。');
    return result;
  }

  const shoulderMid = mid(L_SHOULDER, R_SHOULDER);
  const hipMid = mid(L_HIP, R_HIP);

  // 体幹に沿った「上」方向と、患者本人から見た「右」方向の軸を、実測点から都度算出する。
  // カメラに対して体が多少傾いていても、体自身の軸を基準にするため影響を受けにくい。
  const up = normalize3(sub(shoulderMid, hipMid));
  const right = normalize3(sub(R_SHOULDER, L_SHOULDER));

  const setSymmetryItem = (key: SymmetryNumericKey, diffCm: number, sideKey?: '顔_左右' | '肩上_左右' | '軸_左右') => {
    result.numeric[key] = toUiScore(cmToLevel(diffCm, SYMMETRY_ANCHORS[key]));
    if (sideKey) {
      result.meta[sideKey] = diffCm >= 0 ? '右' : '左';
    }
  };

  // --- 肩上：左右の肩峰（肩の頂点）の高さの差 ---
  {
    const heightL = along(up, hipMid, L_SHOULDER);
    const heightR = along(up, hipMid, R_SHOULDER);
    const diffCm = (heightR - heightL) * scale;
    setSymmetryItem('肩上', diffCm, '肩上_左右');
  }

  // --- 軸（プロトコル上は「ウエスト」）：左右の腰（股関節）の高さの差 ---
  // ウエストのくびれ「深度」は骨格ランドマークだけでは測れないため、高さの差のみで近似。
  {
    const heightL = along(up, hipMid, L_HIP);
    const heightR = along(up, hipMid, R_HIP);
    const diffCm = (heightR - heightL) * scale;
    setSymmetryItem('軸', diffCm, '軸_左右');
    warnings.push('「軸」はプロトコル上「ウエスト」（左右のくびれの深さ・高さの差）に該当し、骨格点からは高さの差のみを近似計算しています。');
  }

  // --- 肩内旋左右：肘が肩よりどれだけ前方に出ているか（形状評価の簡易近似） ---
  // プロトコル本来の定義は「鎖骨下〜上腕のカーブが丸い／三角」という輪郭形状の評価であり、
  // 骨格ランドマークだけでは判定できないため、内旋すると肘が前方に出やすいことを利用した近似値。
  {
    const L_ELBOW = imageLandmarks[LM.LEFT_ELBOW];
    const R_ELBOW = imageLandmarks[LM.RIGHT_ELBOW];
    const wL_ELBOW = worldLandmarks[LM.LEFT_ELBOW];
    const wR_ELBOW = worldLandmarks[LM.RIGHT_ELBOW];
    if (visible(L_ELBOW, R_ELBOW)) {
      const forwardL = -(wL_ELBOW.z - wL_SHOULDER.z) * 100;
      const forwardR = -(wR_ELBOW.z - wR_SHOULDER.z) * 100;
      result.numeric['肩内旋左'] = toUiScore(cmToLevel(Math.max(0, forwardL), SYMMETRY_ANCHORS.肩内旋左));
      result.numeric['肩内旋右'] = toUiScore(cmToLevel(Math.max(0, forwardR), SYMMETRY_ANCHORS.肩内旋右));
      warnings.push('「肩内旋左右」は輪郭形状ではなく肘の前方突出量からの簡易近似のため、精度が低めです。');
    } else {
      warnings.push('肘のランドマークが検出できず「肩内旋左右」は計算していません。');
    }
  }

  // --- 顔：傾き（目の高さ差）／捻れ（鼻の左右回転）／スライド（頭部全体の水平移動）のうち最大のものを採用 ---
  {
    const L_EYE = imageLandmarks[LM.LEFT_EYE];
    const R_EYE = imageLandmarks[LM.RIGHT_EYE];
    const L_EAR = imageLandmarks[LM.LEFT_EAR];
    const R_EAR = imageLandmarks[LM.RIGHT_EAR];
    const NOSE = imageLandmarks[LM.NOSE];

    if (visible(L_EYE, R_EYE, L_EAR, R_EAR, NOSE)) {
      const earMid = mid(L_EAR, R_EAR);
      const tiltCm = (along(up, earMid, R_EYE) - along(up, earMid, L_EYE)) * scale;
      const twistCm = along(right, earMid, NOSE) * scale;
      const slideCm = along(right, shoulderMid, earMid) * scale;

      const candidates: { type: FaceType; value: number }[] = [
        { type: '傾き', value: tiltCm },
        { type: '捻れ', value: twistCm },
        { type: 'スライド', value: slideCm },
      ];
      const dominant = candidates.reduce((best, cur) => (Math.abs(cur.value) > Math.abs(best.value) ? cur : best));

      setSymmetryItem('顔', dominant.value, '顔_左右');
      result.meta.顔_種類 = dominant.type;
    } else {
      warnings.push('顔のランドマークが検出できず「顔」のスコアは計算していません。');
    }
  }

  return result;
}

/**
 * 側面写真から「前後バランス」グループ（耳・肩・大転子・肘）を判定する。
 * プロトコル定義：各項目とも「くるぶしの中心を通る垂直線」からの前方偏位（cm）。
 *
 * @param imageLandmarks MediaPipe PoseLandmarker の `landmarks[0]`（画像正規化座標）
 * @param worldLandmarks 同 `worldLandmarks[0]`（実寸・メートル単位）
 */
export function analyzeSidePosture(imageLandmarks: Landmark[], worldLandmarks: Landmark[]): SidePostureAnalysis {
  const warnings: string[] = [];
  const result: SidePostureAnalysis = { numeric: {}, warnings };

  if (!imageLandmarks || imageLandmarks.length < 29 || !worldLandmarks || worldLandmarks.length < 29) {
    warnings.push('姿勢ランドマークを取得できませんでした。体の真横から全身が写った写真かご確認ください。');
    return result;
  }

  // 側面写真では奥にある側の左右ランドマークの検出精度が落ちるため、
  // 手前（カメラに近い＝visibilityが高い）側のランドマークを各部位ごとに採用する。
  const shoulder = moreVisible(imageLandmarks[LM.LEFT_SHOULDER], imageLandmarks[LM.RIGHT_SHOULDER]);
  const hip = moreVisible(imageLandmarks[LM.LEFT_HIP], imageLandmarks[LM.RIGHT_HIP]);
  const ear = moreVisible(imageLandmarks[LM.LEFT_EAR], imageLandmarks[LM.RIGHT_EAR]);
  const elbow = moreVisible(imageLandmarks[LM.LEFT_ELBOW], imageLandmarks[LM.RIGHT_ELBOW]);
  const nose = imageLandmarks[LM.NOSE];
  const ankleL = imageLandmarks[LM.LEFT_ANKLE];
  const ankleR = imageLandmarks[LM.RIGHT_ANKLE];

  if (!visible(shoulder, hip, ankleL, ankleR)) {
    warnings.push('体の側面全体（肩・腰・足首）が写っていないため、精度が低い可能性があります。');
  }

  const wShoulder = worldLandmarks[shoulder === imageLandmarks[LM.LEFT_SHOULDER] ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER];
  const wHip = worldLandmarks[hip === imageLandmarks[LM.LEFT_HIP] ? LM.LEFT_HIP : LM.RIGHT_HIP];
  const scale = cmPerImageUnit(shoulder, hip, wShoulder, wHip);
  if (!scale) {
    warnings.push('体格スケールを推定できず解析を中止しました。');
    return result;
  }

  const ankleMid = mid(ankleL, ankleR);

  // 鼻は顔が向いている方向＝体の前方に位置するため、耳との位置関係から「前方」の符号を決める。
  const forwardSign = Math.sign(nose.x - ear.x) || 1;

  const forwardOffsetCm = (point: Landmark) => (point.x - ankleMid.x) * forwardSign * scale;

  result.numeric['大転子'] = toUiScore(cmToLevel(forwardOffsetCm(hip), VERTICAL_ANCHORS.大転子));
  result.numeric['肩'] = toUiScore(cmToLevel(forwardOffsetCm(shoulder), VERTICAL_ANCHORS.肩));

  if (visible(ear)) {
    result.numeric['耳'] = toUiScore(cmToLevel(forwardOffsetCm(ear), VERTICAL_ANCHORS.耳));
  } else {
    warnings.push('耳のランドマークが検出できず「耳」のスコアは計算していません。');
  }

  if (visible(elbow)) {
    result.numeric['肘'] = toUiScore(cmToLevel(forwardOffsetCm(elbow), VERTICAL_ANCHORS.肘));
    warnings.push('「肘」はプロトコル上「肘比率」（前後の長さ比）の近似として、くるぶし垂直線からの前方偏位で代用しています。');
  } else {
    warnings.push('肘のランドマークが検出できず「肘」のスコアは計算していません。');
  }

  return result;
}
