// 出目条件の判定と説明文。
//
// 原典の補足より、判定は「条件を満たす組み合わせが出目に含まれるか」で行う。
// 排他的に分割する必要はない（1111 は「同じ目4つ」かつ「2ペア」として扱う）。
// 詳細は docs/rules/02-cards.md 末尾の表を参照。

/** 目ごとの個数。index 1〜6 を使う。 */
export function tally(values) {
  const t = [0, 0, 0, 0, 0, 0, 0];
  for (const v of values) t[v]++;
  return t;
}

/** 最も多く出ている目とその個数。同数なら目が大きいほうを採用（最終ラウンドの強さ判定に合わせる）。 */
export function bestOfAKind(values) {
  const t = tally(values);
  let count = 0;
  let value = 0;
  for (let v = 1; v <= 6; v++) {
    if (t[v] > count || (t[v] === count && t[v] > 0 && v > value)) {
      count = t[v];
      value = v;
    }
  }
  return { count, value };
}

export function sumOf(values) {
  return values.reduce((a, b) => a + b, 0);
}

/** ペアの組数（Σ floor(個数 / 2)） */
export function pairCount(values) {
  const t = tally(values);
  let n = 0;
  for (let v = 1; v <= 6; v++) n += Math.floor(t[v] / 2);
  return n;
}

/** 3つ組の数（Σ floor(個数 / 3)）。555555 は2組として扱う。 */
export function tripleCount(values) {
  const t = tally(values);
  let n = 0;
  for (let v = 1; v <= 6; v++) n += Math.floor(t[v] / 3);
  return n;
}

/** フルハウス。22222 のように同じ目5個でも成立する（原典の補足より）。 */
export function hasFullHouse(values) {
  const t = tally(values);
  for (let v = 1; v <= 6; v++) {
    if (t[v] < 3) continue;
    if (t[v] - 3 >= 2) return true;
    for (let u = 1; u <= 6; u++) {
      if (u !== v && t[u] >= 2) return true;
    }
  }
  return false;
}

/** 条件を満たすか。req は cards.js が持つ条件オブジェクト。 */
export function meets(req, values) {
  switch (req.t) {
    case 'any':
      return true;
    case 'never':
      return false;
    case 'ofAKind':
      return bestOfAKind(values).count >= req.n;
    case 'sum':
      return sumOf(values) >= req.n;
    case 'pairs':
      return pairCount(values) >= req.n;
    case 'triples':
      return tripleCount(values) >= req.n;
    case 'fullHouse':
      return hasFullHouse(values);
    case 'allParity': {
      if (values.length === 0) return false;
      const want = req.p === 'odd' ? 1 : 0;
      return values.every((v) => v % 2 === want);
    }
    case 'runs': {
      const t = tally(values);
      return req.runs.some((run) => run.every((v) => t[v] >= 1));
    }
    default:
      throw new Error(`未知の条件タイプ: ${req.t}`);
  }
}

export function describeReq(req) {
  switch (req.t) {
    case 'any':
      return 'どんな目でも取れる';
    case 'never':
      return '直接は獲得できない';
    case 'ofAKind':
      return `${req.n}つのダイスの目が同じ`;
    case 'sum':
      return `ダイスの目の合計が${req.n}以上`;
    case 'pairs':
      return `同じ目のペアが${req.n}つ以上`;
    case 'triples':
      return `3つ同じ組が${req.n}つ`;
    case 'fullHouse':
      return '2つ同じ組と3つ同じ組が1つずつ';
    case 'allParity':
      return req.p === 'odd' ? 'ダイスの目が全て奇数' : 'ダイスの目が全て偶数';
    case 'runs':
      return req.runs.map((r) => r.join('')).join(' または ') + ' の目がある';
    default:
      return '';
  }
}
