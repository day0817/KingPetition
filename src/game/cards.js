// キャラクターカード20種の定義。
//
// 元データ: docs/rules/02-cards.md（peca卓ゲwiki のカード一覧より）
// 画像:     assets/cards/<id>.jpg
//
// ルールを直すときは、まず docs/rules/02-cards.md を直してからここに反映すること。
//
// ability.kind の一覧
//   passiveDice   常時。手番の最初に振るダイスが増える
//   rerollActive  未確定のダイスを振りなおす（count: 1 または 'any'）
//   addDie        未確定のダイスを追加する（value: 1〜6 または 'choose'）
//   bump          未確定のダイス1つの目に +1〜+max
//   plus          好きな数の未確定のダイスの目に +amount
//   redistribute  count個の未確定のダイスの目を、和を変えない範囲で変更
//   copyFixed     未確定のダイス1つの目を、確定済みのダイス1つの目に変更
//   setValue      未確定のダイス1つの目を好きな目に変更

export const LEVEL_LABELS = ['0', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];

export const CARDS = [
  // ---- LV 0 ----
  {
    id: 'jester', name: '道化師', level: 0, special: 'jester',
    req: { t: 'any' },
    reqText: 'どんな目でも取れる（道化師を持っていない場合に限る）',
    ability: { kind: 'rerollActive', count: 1 },
    abilityText: '未確定のダイス1つを振りなおすことができる。',
  },
  {
    id: 'trickster', name: 'ペテン師', level: 0, special: 'trickster',
    req: { t: 'any' },
    reqText: '道化師を持っている場合、どんな目でも取れる（道化師は無くなる）',
    ability: { kind: 'passiveDice', amount: 1 },
    abilityText: '手番の最初に振るダイスが1つ追加される。',
  },

  // ---- LV Ⅰ ----
  {
    id: 'farmer', name: '農夫', level: 1,
    req: { t: 'ofAKind', n: 2 },
    ability: { kind: 'passiveDice', amount: 1 },
    abilityText: '手番の最初に振るダイスが1つ追加される。',
  },
  {
    id: 'maid', name: '下女', level: 1,
    req: { t: 'allParity', p: 'odd' },
    ability: { kind: 'bump', max: 3 },
    abilityText: '未確定のダイス1つの目に＋1〜＋3できる。',
  },
  {
    id: 'philosopher', name: '哲学者', level: 1,
    req: { t: 'allParity', p: 'even' },
    ability: { kind: 'redistribute', count: 2 },
    abilityText: '2つの未確定のダイスの目を、その和を変えない範囲で変更できる。',
  },
  {
    id: 'craftsman', name: '職人', level: 1,
    req: { t: 'sum', n: 15 },
    ability: { kind: 'addDie', value: 1 },
    abilityText: '目が1の未確定のダイスを追加できる。',
  },
  {
    id: 'guard', name: '衛兵', level: 1,
    req: { t: 'ofAKind', n: 3 },
    ability: { kind: 'addDie', value: 2 },
    abilityText: '目が2の未確定のダイスを追加できる。',
  },

  // ---- LV Ⅱ ----
  {
    id: 'hunter', name: '狩人', level: 2,
    req: { t: 'ofAKind', n: 4 },
    ability: { kind: 'addDie', value: 3 },
    abilityText: '目が3の未確定のダイスを追加できる。',
  },
  {
    id: 'merchant', name: '商人', level: 2,
    req: { t: 'sum', n: 20 },
    ability: { kind: 'rerollActive', count: 'any' },
    abilityText: '好きな数の未確定のダイスを振りなおすことができる。',
  },
  {
    id: 'astronomer', name: '天文学者', level: 2,
    req: { t: 'pairs', n: 2 },
    ability: { kind: 'copyFixed' },
    abilityText: '未確定のダイス1つの目を、確定済みのダイス1つの目に変更できる。',
  },

  // ---- LV Ⅲ ----
  {
    id: 'court_lady', name: '女官', level: 3,
    req: { t: 'fullHouse' },
    reqText: '2つ同じ組と3つ同じ組が1つずつ（22555、11166 など）',
    ability: { kind: 'plus', amount: 1 },
    abilityText: '好きな数の未確定のダイスの目に＋1できる（6の目には＋できない）。',
  },
  {
    id: 'pawnbroker', name: '質屋', level: 3,
    req: { t: 'sum', n: 30 },
    ability: { kind: 'addDie', value: 4 },
    abilityText: '目が4の未確定のダイスを追加できる。',
  },
  {
    id: 'knight', name: '騎士', level: 3,
    req: { t: 'ofAKind', n: 5 },
    ability: { kind: 'addDie', value: 5 },
    abilityText: '目が5の未確定のダイスを追加できる。',
  },
  {
    id: 'magician', name: '魔術師', level: 3,
    req: { t: 'runs', runs: [[1, 2, 3, 4, 5], [2, 3, 4, 5, 6]] },
    reqText: '12345 または 23456 の目が確定されている',
    ability: { kind: 'setValue' },
    abilityText: '未確定のダイス1つの目を好きな目に変更できる。',
  },

  // ---- LV Ⅳ ----
  {
    id: 'alchemist', name: '錬金術師', level: 4,
    req: { t: 'runs', runs: [[1, 2, 3, 4, 5, 6]] },
    reqText: '123456 の目が確定されている',
    ability: { kind: 'redistribute', count: 3 },
    abilityText: '3つの未確定のダイスの目を、その和を変えない範囲で変更できる。',
  },
  {
    id: 'bishop', name: '司教', level: 4,
    req: { t: 'pairs', n: 3 },
    ability: { kind: 'addDie', value: 6 },
    abilityText: '目が6の未確定のダイスを追加できる。',
  },
  {
    id: 'noble', name: '貴族', level: 4,
    req: { t: 'triples', n: 2 },
    reqText: '3つ同じ組が2つある（111222、333555 など）',
    ability: { kind: 'plus', amount: 2 },
    abilityText: '好きな数の未確定のダイスの目に＋2できる（5・6の目には＋できない）。',
  },
  {
    id: 'general', name: '将軍', level: 4,
    req: { t: 'ofAKind', n: 6 },
    ability: { kind: 'passiveDice', amount: 2 },
    abilityText: '手番の最初に振るダイスが2つ追加される。',
  },

  // ---- LV Ⅴ ----
  {
    id: 'king', name: '国王', level: 5, special: 'king',
    req: { t: 'ofAKind', n: 7 },
    ability: null,
    abilityText: '最後に国王を持っているプレイヤーの勝利。',
  },
  {
    id: 'queen', name: '王妃', level: 5, special: 'queen',
    req: { t: 'never' },
    reqText: '最初に国王を取ると一緒に貰える',
    ability: { kind: 'addDie', value: 'choose' },
    abilityText: '好きな目の未確定のダイスを追加できる。',
  },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export function cardArt(id) {
  return `assets/cards/${id}.jpg`;
}
