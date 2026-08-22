import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meets, pairCount, tripleCount, hasFullHouse, bestOfAKind } from '../src/game/requirements.js';
import { CARD_BY_ID } from '../src/game/cards.js';

const req = (id) => CARD_BY_ID[id].req;

test('原典の補足: 1111 は「同じ目4つ」かつ「2ペア」', () => {
  const v = [1, 1, 1, 1];
  assert.equal(meets(req('hunter'), v), true, '狩人（4つ同じ）');
  assert.equal(meets(req('astronomer'), v), true, '天文学者（2ペア）');
  assert.equal(pairCount(v), 2);
});

test('原典の補足: 22222 は騎士も女官も取れる', () => {
  const v = [2, 2, 2, 2, 2];
  assert.equal(meets(req('knight'), v), true, '騎士（5つ同じ）');
  assert.equal(meets(req('court_lady'), v), true, '女官（フルハウス）');
});

test('原典の補足: 555555 は司教も貴族も将軍も取れる', () => {
  const v = [5, 5, 5, 5, 5, 5];
  assert.equal(meets(req('bishop'), v), true, '司教（3ペア）');
  assert.equal(meets(req('noble'), v), true, '貴族（3つ組が2つ）');
  assert.equal(meets(req('general'), v), true, '将軍（6つ同じ）');
  assert.equal(tripleCount(v), 2);
});

test('フルハウス', () => {
  assert.equal(hasFullHouse([2, 2, 5, 5, 5]), true);
  assert.equal(hasFullHouse([1, 1, 1, 6, 6]), true);
  assert.equal(hasFullHouse([1, 2, 3, 4, 5]), false);
  assert.equal(hasFullHouse([1, 1, 1, 2, 3]), false, '3つ組だけではフルハウスにならない');
});

test('全て奇数 / 全て偶数', () => {
  assert.equal(meets(req('maid'), [1, 3, 5]), true);
  assert.equal(meets(req('maid'), [1, 3, 4]), false);
  assert.equal(meets(req('philosopher'), [2, 4, 6]), true);
  assert.equal(meets(req('philosopher'), [2, 4, 5]), false);
});

test('合計', () => {
  assert.equal(meets(req('craftsman'), [5, 5, 5]), true, '15以上');
  assert.equal(meets(req('craftsman'), [5, 5, 4]), false);
  assert.equal(meets(req('merchant'), [6, 6, 6, 2]), true, '20以上');
  assert.equal(meets(req('pawnbroker'), [6, 6, 6, 6, 6]), true, '30以上');
  assert.equal(meets(req('pawnbroker'), [6, 6, 6, 6, 5]), false);
});

test('ストレート（魔術師 12345/23456・錬金術師 123456）', () => {
  assert.equal(meets(req('magician'), [1, 2, 3, 4, 5]), true);
  assert.equal(meets(req('magician'), [2, 3, 4, 5, 6]), true);
  assert.equal(meets(req('magician'), [1, 2, 3, 4, 6]), false);
  assert.equal(meets(req('magician'), [1, 2, 3, 4, 5, 5]), true, '余分なダイスがあってもよい');
  assert.equal(meets(req('alchemist'), [1, 2, 3, 4, 5, 6]), true);
  assert.equal(meets(req('alchemist'), [1, 2, 3, 4, 5, 5]), false);
});

test('国王は7つ同じ目', () => {
  assert.equal(meets(req('king'), new Array(7).fill(3)), true);
  assert.equal(meets(req('king'), new Array(6).fill(3)), false);
});

test('王妃は直接獲得できない', () => {
  assert.equal(meets(req('queen'), new Array(7).fill(3)), false);
});

test('bestOfAKind は同数なら大きい目を採る（最終ラウンドの強さ判定）', () => {
  assert.deepEqual(bestOfAKind([2, 2, 5, 5, 1]), { count: 2, value: 5 });
  assert.deepEqual(bestOfAKind([4, 4, 4, 6, 6]), { count: 3, value: 4 });
});
