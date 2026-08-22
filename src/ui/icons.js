// 獲得条件と効果をあらわすアイコン。
//
// 小さなSVG（ダイス1個・記号1個）を並べて1つのアイコンにする。
// 並べ方はCSS（.ic-row / .ic-group）に任せているので、幅が足りなければ自動で折り返す。
//
// ダイスの色分け
//   a   … ふつうのダイス
//   b/c … 「別の組」であることを示すための色違い（ペア×2、フルハウスなど）
//   fix … 確定済みのダイス
//   new … 新しく手に入る／追加されるダイス
//   q   … 目が決まっていないダイス

import { el } from './render.js';

const NS = 'http://www.w3.org/2000/svg';

const PIPS = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [1, 3], [3, 1], [3, 3]],
  5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
  6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]],
};

function s(tag, attrs = {}, children = []) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) node.append(c);
  return node;
}

/** ダイス1個。face は 1〜6 / 'same'（目は問わないが他と同じ）/ 'any'（何でもよい）/ 'blank' */
function die(face = 'same', tone = 'a') {
  const kids = [s('rect', { x: 1, y: 1, width: 12, height: 12, rx: 3, class: 'ic-face' })];

  if (typeof face === 'number') {
    for (const [row, col] of PIPS[face]) {
      kids.push(s('circle', { cx: 1.4 + 3.7 * col, cy: 1.4 + 3.7 * row, r: 1.15, class: 'ic-pip' }));
    }
  } else if (face === 'same') {
    kids.push(s('circle', { cx: 7, cy: 7, r: 2.6, class: 'ic-ring' }));
  } else if (face === 'any') {
    kids.push(s('path', { d: 'M5.2 5.6a1.9 1.9 0 1 1 1.9 2v1', class: 'ic-mark' }));
    kids.push(s('circle', { cx: 7.1, cy: 10.4, r: .85, class: 'ic-pip' }));
  }
  return s('svg', { viewBox: '0 0 14 14', class: `ic-die tone-${tone}`, 'aria-hidden': 'true' }, kids);
}

// SVGノードは1つの親にしか付けられないため、呼ばれるたびに作り直す。
// （定数として1度だけ作ると、2枚目以降のアイコンから記号が消える）
const SYMBOLS = {
  // 振り直し
  reroll: () => [
    s('path', { d: 'M6 1.5A4.5 4.5 0 1 1 1.5 6', class: 'ic-stroke' }),
    s('path', { d: 'M6 -0.3 L9.4 1.5 L6 3.3 Z', class: 'ic-fill' }),
  ],
  // 目を増やす
  up: () => [s('path', { d: 'M6 1 L10 6 L7.6 6 L7.6 11 L4.4 11 L4.4 6 L2 6 Z', class: 'ic-fill' })],
  // ダイスを追加する
  plus: () => [s('path', { d: 'M6 1.5 V10.5 M1.5 6 H10.5', class: 'ic-stroke ic-bold' })],
  // 和を変えずに入れ替える
  swap: () => [
    s('path', { d: 'M1 4 H9 M7 2 L9.4 4 L7 6', class: 'ic-stroke' }),
    s('path', { d: 'M11 8 H3 M5 6 L2.6 8 L5 10', class: 'ic-stroke' }),
  ],
  // コピーする
  copy: () => [s('path', { d: 'M1 6 H9 M7 3.6 L10 6 L7 8.4', class: 'ic-stroke' })],
  // 好きな目に変える
  star: () => [s('path', { d: 'M6 0.5 L7.3 4.7 L11.5 6 L7.3 7.3 L6 11.5 L4.7 7.3 L0.5 6 L4.7 4.7 Z', class: 'ic-fill' })],
  // 王冠
  crown: () => [
    s('path', { d: 'M1 10 L2.2 2.6 L5 5.6 L6 1 L7 5.6 L9.8 2.6 L11 10 Z', class: 'ic-fill' }),
    s('rect', { x: 1, y: 10.4, width: 10, height: 1.8, rx: .6, class: 'ic-fill' }),
  ],
  // カードを裏返す
  flip: () => [
    s('rect', { x: 1.2, y: 1.2, width: 6.4, height: 9.6, rx: 1.2, class: 'ic-stroke' }),
    s('path', { d: 'M9.4 3.2 A3.4 3.4 0 1 1 9.4 8.8', class: 'ic-stroke' }),
    s('path', { d: 'M11 1.6 L11.8 4.2 L9.2 4 Z', class: 'ic-fill' }),
  ],
};

function sym(name) {
  return s('svg', { viewBox: '0 0 12 12', class: 'ic-sym', 'aria-hidden': 'true' }, SYMBOLS[name]());
}

/** 同じ組のダイスをまとめる（組と組のあいだに間があく） */
function group(count, { face = 'same', tone = 'a' } = {}) {
  return el('span', { class: 'ic-group' }, Array.from({ length: count }, () => die(face, tone)));
}

function faces(list, tone = 'a') {
  return el('span', { class: 'ic-group' }, list.map((f) => die(f, tone)));
}

function block(parts, note) {
  return el('span', { class: 'ic-block' }, [
    el('span', { class: 'ic-row' }, parts),
    note ? el('span', { class: 'ic-note', text: note }) : null,
  ]);
}

const GROUP_TONES = ['a', 'b', 'c'];

/** 獲得条件のアイコン */
export function conditionIcon(card) {
  switch (card.id) {
    case 'jester':
      return block([die('any', 'q')], 'どんな目でも');
    case 'trickster':
      return block([sym('flip'), die('any', 'q')], '道化師を裏返す');
    case 'queen':
      return block([sym('crown')], '国王と同時');
    default:
      break;
  }

  const req = card.req;
  switch (req.t) {
    case 'ofAKind':
      return block([group(req.n)], `同じ目 ${req.n}つ`);
    case 'sum':
      return block([group(3, { face: 'blank' })], `合計 ${req.n}以上`);
    case 'pairs':
      return block(
        Array.from({ length: req.n }, (_, i) => group(2, { tone: GROUP_TONES[i % 3] })),
        `ペア ${req.n}組`);
    case 'triples':
      return block(
        Array.from({ length: req.n }, (_, i) => group(3, { tone: GROUP_TONES[i % 3] })),
        `3つ組 ${req.n}組`);
    case 'fullHouse':
      return block([group(3, { tone: 'a' }), group(2, { tone: 'b' })], '3つ組＋ペア');
    case 'allParity':
      return req.p === 'odd'
        ? block([faces([1, 3, 5])], '全て奇数')
        : block([faces([2, 4, 6])], '全て偶数');
    case 'runs': {
      const run = req.runs[0];
      const note = req.runs.length > 1
        ? req.runs.map((r) => r.join('')).join(' か ')
        : `${run.join('')} をそろえる`;
      return block([faces(run)], note);
    }
    default:
      return block([die('blank')], '');
  }
}

/** 効果のアイコン */
export function effectIcon(card) {
  const a = card.ability;
  if (!a) return block([sym('crown')], '持っていれば勝利');

  switch (a.kind) {
    case 'passiveDice':
      return block([sym('plus'), group(a.amount, { tone: 'new' })], `常時 ダイス＋${a.amount}`);
    case 'rerollActive':
      return a.count === 'any'
        ? block([group(3), sym('reroll')], '好きな数を振り直す')
        : block([group(1), sym('reroll')], '1つを振り直す');
    case 'addDie':
      return a.value === 'choose'
        ? block([sym('plus'), die('any', 'q')], '好きな目を追加')
        : block([sym('plus'), die(a.value, 'new')], `${a.value}の目を追加`);
    case 'bump':
      return block([group(1), sym('up')], `1つに ＋1〜＋${a.max}`);
    case 'plus':
      return block([group(2), sym('up')], `何個でも ＋${a.amount}`);
    case 'redistribute':
      return block([group(a.count), sym('swap')], `${a.count}つを和そのままで`);
    case 'copyFixed':
      return block([die('same', 'fix'), sym('copy'), die('same', 'a')], '確定の目をコピー');
    case 'setValue':
      return block([group(1), sym('star')], '1つを好きな目に');
    default:
      return block([die('blank')], '');
  }
}

/** 遊び方に出すアイコンの凡例 */
export function iconLegend(cards) {
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
  const rows = (title, list, iconOf) => el('div', { class: 'legend-block' }, [
    el('h3', { text: title }),
    el('div', { class: 'legend-grid' }, list.map(({ id, label }) =>
      el('div', { class: 'legend-item' }, [iconOf(byId[id]), el('span', { class: 'legend-label', text: label })]))),
  ]);

  return el('div', { class: 'legend' }, [
    rows('獲得条件のアイコン', [
      { id: 'guard', label: '同じ目をそろえる（数はダイスの個数）' },
      { id: 'astronomer', label: '同じ目のペアを組で数える' },
      { id: 'court_lady', label: '色が違う＝別の組（3つ組＋ペア）' },
      { id: 'craftsman', label: '目の合計（白いダイスは目を問わない）' },
      { id: 'maid', label: '全部が奇数／偶数' },
      { id: 'magician', label: '書かれた並びをそろえる' },
      { id: 'jester', label: '？のダイス＝どんな目でもよい' },
    ], conditionIcon),
    rows('効果のアイコン', [
      { id: 'farmer', label: '＋と金のダイス＝手番の最初に振る数が増える（常時）' },
      { id: 'bishop', label: '＋と目つきのダイス＝その目のダイスを1つ追加' },
      { id: 'jester', label: '回る矢印＝未確定のダイスを振り直す' },
      { id: 'maid', label: '上向き矢印＝目を増やす' },
      { id: 'philosopher', label: '入れ替え矢印＝合計を変えずに目を振り分ける' },
      { id: 'astronomer', label: '緑のダイス＝確定済み。その目をコピーする' },
      { id: 'magician', label: '星＝好きな目に変える' },
    ], effectIcon),
  ]);
}
