// ソロモードのスコア計算。設計は docs/rules/04-solo.md。
// バランス調整はこの定数だけを触ればよい。

export const SCORE = {
  perCardLevel: 10,   // 獲得カードのレベル合計 × これ
  king: 200,          // 国王を獲得したら
  perRemainingRound: 25, // 残りラウンド数 × これ（国王獲得時のみ）
  perCrownDie: 15,    // 最終ラウンドの最大同目数 × これ
  perCrownValue: 1,   // その目の値 × これ（同目数タイの差をつけるため）
};

/**
 * @param {object} p
 * @param {number} p.levelSum        獲得カードのレベル合計
 * @param {boolean} p.kingObtained   国王を獲得したか
 * @param {number} p.remainingRounds 残りラウンド数
 * @param {?{count:number, value:number}} p.crown 最終ラウンドの出目（未実施なら null）
 */
export function computeScore({ levelSum, kingObtained, remainingRounds, crown }) {
  const rows = [];
  const push = (label, detail, points) => rows.push({ label, detail, points });

  push('獲得カード', `レベル合計 ${levelSum}`, levelSum * SCORE.perCardLevel);

  if (kingObtained) {
    push('国王を獲得', '請願成功', SCORE.king);
    push('残りラウンド', `${remainingRounds} ラウンド`, remainingRounds * SCORE.perRemainingRound);
  }

  if (crown && crown.count > 0) {
    push('王冠の出目', `${crown.value} が ${crown.count}個`,
      crown.count * SCORE.perCrownDie + crown.value * SCORE.perCrownValue);
  }

  const total = rows.reduce((s, r) => s + r.points, 0);
  return { rows, total };
}
