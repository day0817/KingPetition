import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/engine.js';

/** 指定のカードを所持した状態で、ダイスを固定してゲームを作る */
function withCards(cardIds, dice, { fixedCount = 0, seed = 1 } = {}) {
  const g = new Game({ seed });
  for (const id of cardIds) g.owned.add(id);
  g.dice = dice.map((v, i) => ({ id: 1000 + i, value: v, fixed: i < fixedCount }));
  g._nextDieId = 2000;
  return g;
}
const ids = (g, ...indexes) => indexes.map((i) => g.dice[i].id);

test('下女: 未確定のダイス1つに +1〜+3。6を超える指定は弾く', () => {
  const g = withCards(['maid'], [2, 5, 5]);
  assert.equal(g.useAbility('maid', { ids: ids(g, 0), amount: 3 }).ok, true);
  assert.equal(g.dice[0].value, 5);

  const h = withCards(['maid'], [5, 1, 1]);
  assert.equal(h.useAbility('maid', { ids: ids(h, 0), amount: 3 }).ok, false, '5+3=8 は不可');
  assert.equal(h.useAbility('maid', { ids: ids(h, 0), amount: 4 }).ok, false, '+4 は範囲外');
});

test('能力は1手番に1回だけ', () => {
  const g = withCards(['maid'], [1, 1, 1]);
  assert.equal(g.useAbility('maid', { ids: ids(g, 0), amount: 1 }).ok, true);
  const second = g.useAbility('maid', { ids: ids(g, 1), amount: 1 });
  assert.equal(second.ok, false);
  assert.match(second.error, /使用済み/);
});

test('哲学者: 2つの未確定ダイスを、和を変えない範囲で振り分ける', () => {
  const g = withCards(['philosopher'], [2, 4, 1]);
  assert.equal(g.useAbility('philosopher', { ids: ids(g, 0, 1), values: [3, 3] }).ok, true);
  assert.deepEqual([g.dice[0].value, g.dice[1].value], [3, 3]);

  const h = withCards(['philosopher'], [2, 4, 1]);
  const bad = h.useAbility('philosopher', { ids: ids(h, 0, 1), values: [3, 4] });
  assert.equal(bad.ok, false, '合計が変わる指定は不可');
  assert.match(bad.error, /合計/);
});

test('哲学者・錬金術師の対象は未確定のダイス限定（利用者確認済）', () => {
  const g = withCards(['philosopher'], [2, 4, 1], { fixedCount: 1 });
  const r = g.useAbility('philosopher', { ids: ids(g, 0, 1), values: [3, 3] });
  assert.equal(r.ok, false);
  assert.match(r.error, /確定済み/);
});

test('錬金術師: 3つのダイスを和を変えずに振り分ける', () => {
  const g = withCards(['alchemist'], [1, 2, 6, 3]);
  assert.equal(g.useAbility('alchemist', { ids: ids(g, 0, 1, 2), values: [3, 3, 3] }).ok, true);
  assert.deepEqual(g.dice.slice(0, 3).map((d) => d.value), [3, 3, 3]);

  const h = withCards(['alchemist'], [1, 1, 1]);
  assert.equal(h.useAbility('alchemist', { ids: ids(h, 0, 1), values: [1, 2] }).ok, false, '3つ選ぶ必要がある');
});

test('女官: 好きな数のダイスに +1。6の目には使えない', () => {
  const g = withCards(['court_lady'], [1, 3, 6]);
  assert.equal(g.useAbility('court_lady', { ids: ids(g, 0, 1) }).ok, true);
  assert.deepEqual(g.values, [2, 4, 6]);

  const h = withCards(['court_lady'], [1, 6, 6]);
  assert.equal(h.useAbility('court_lady', { ids: ids(h, 0, 1) }).ok, false);
});

test('貴族: +2 は 5・6 の目には使えない', () => {
  const g = withCards(['noble'], [3, 4, 5]);
  assert.equal(g.useAbility('noble', { ids: ids(g, 0, 1) }).ok, true);
  assert.deepEqual(g.values, [5, 6, 5]);

  const h = withCards(['noble'], [5, 1, 1]);
  assert.equal(h.useAbility('noble', { ids: ids(h, 0) }).ok, false);
  const i = withCards(['noble'], [6, 1, 1]);
  assert.equal(i.useAbility('noble', { ids: ids(i, 0) }).ok, false);
});

test('天文学者: 確定済みの目をコピーする。確定済みが無ければ使えない', () => {
  const g = withCards(['astronomer'], [4, 1, 2], { fixedCount: 1 });
  assert.equal(g.useAbility('astronomer', { ids: ids(g, 1), fromId: g.dice[0].id }).ok, true);
  assert.equal(g.dice[1].value, 4);

  const h = withCards(['astronomer'], [4, 1, 2]);
  const r = h.useAbility('astronomer', { ids: ids(h, 1), fromId: h.dice[0].id });
  assert.equal(r.ok, false);
  assert.match(r.error, /確定済み/);
});

test('魔術師: 未確定のダイス1つを好きな目に変える', () => {
  const g = withCards(['magician'], [1, 1, 1]);
  assert.equal(g.useAbility('magician', { ids: ids(g, 0), value: 6 }).ok, true);
  assert.equal(g.dice[0].value, 6);
  const h = withCards(['magician'], [1, 1, 1]);
  assert.equal(h.useAbility('magician', { ids: ids(h, 0), value: 7 }).ok, false);
});

test('ダイス追加系: 指定の目の未確定ダイスが増える', () => {
  const g = withCards(['bishop'], [1, 1, 1]);
  assert.equal(g.useAbility('bishop').ok, true);
  assert.equal(g.dice.length, 4);
  assert.equal(g.dice[3].value, 6);
  assert.equal(g.dice[3].fixed, false, '追加されたダイスは未確定');
});

test('王妃: 好きな目のダイスを追加できる', () => {
  const g = withCards(['queen'], [1, 1, 1]);
  assert.equal(g.useAbility('queen', { value: 5 }).ok, true);
  assert.equal(g.dice[3].value, 5);
  const h = withCards(['queen'], [1, 1, 1]);
  assert.equal(h.useAbility('queen', {}).ok, false, '目の指定が必要');
});

test('商人: 好きな数の未確定ダイスを振りなおす', () => {
  const g = withCards(['merchant'], [1, 1, 1, 1]);
  assert.equal(g.useAbility('merchant', { ids: ids(g, 0, 1, 2) }).ok, true);
  assert.equal(g.dice.length, 4);
  const h = withCards(['merchant'], [1, 1, 1]);
  assert.equal(h.useAbility('merchant', { ids: [] }).ok, false, '1つ以上必要');
});

test('道化師: 未確定のダイスを1つだけ振りなおせる', () => {
  const g = withCards(['jester'], [1, 1, 1]);
  assert.equal(g.useAbility('jester', { ids: ids(g, 0, 1) }).ok, false, '2つは選べない');
  assert.equal(g.useAbility('jester', { ids: ids(g, 0) }).ok, true);
});

test('持っていないカードの能力は使えない', () => {
  const g = withCards([], [1, 1, 1]);
  assert.equal(g.useAbility('magician', { ids: ids(g, 0), value: 6 }).ok, false);
});

test('常時効果のカードは能動的に使えない', () => {
  const g = withCards(['farmer'], [1, 1, 1]);
  assert.equal(g.useAbility('farmer').ok, false);
});
