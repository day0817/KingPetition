import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, BASE_DICE, DIFFICULTIES } from '../src/game/engine.js';

/** テスト用: ダイスの目を固定する */
function setDice(game, values, { fixed = false } = {}) {
  game.dice = values.map((v, i) => ({ id: 1000 + i, value: v, fixed }));
  game._nextDieId = 2000;
}

/** 全部確定させて手番を終える */
function endTurn(game) {
  game.selectAllActive();
  return game.confirmFix();
}

test('初期状態: ダイス3個、ラウンド1、roll フェーズ', () => {
  const g = new Game({ seed: 1 });
  assert.equal(g.dice.length, BASE_DICE);
  assert.equal(g.activeDice.length, BASE_DICE);
  assert.equal(g.round, 1);
  assert.equal(g.phase, 'roll');
  assert.equal(g.maxRounds, DIFFICULTIES.normal.rounds);
});

test('同じシードなら同じ出目になる', () => {
  const a = new Game({ seed: 12345 });
  const b = new Game({ seed: 12345 });
  assert.deepEqual(a.values, b.values);
});

test('確定するダイスを選ばずには進めない', () => {
  const g = new Game({ seed: 1 });
  assert.equal(g.canConfirm(), false);
  assert.equal(g.confirmFix().ok, false);
});

test('一部を確定すると、確定した目は残り、残りだけが振り直される', () => {
  const g = new Game({ seed: 7 });
  const keep = g.dice[0];
  const keptValue = keep.value;
  g.toggleSelect(keep.id);
  const r = g.confirmFix();

  assert.equal(r.ok, true);
  assert.equal(r.turnEnded, false);
  assert.equal(g.phase, 'roll');
  assert.equal(g.dice.find((d) => d.id === keep.id).value, keptValue);
  assert.equal(g.fixedDice.length, 1);
  assert.equal(g.activeDice.length, BASE_DICE - 1);
  assert.equal(g.selection.size, 0);
});

test('残り全部を確定させれば、その時点で手番が終わる（＝好きなタイミングで止められる）', () => {
  const g = new Game({ seed: 7 });
  const r = endTurn(g);
  assert.equal(r.turnEnded, true);
  assert.equal(g.phase, 'claim');
  assert.equal(g.activeDice.length, 0);
});

test('道化師はどんな目でも獲得でき、獲得後は候補から消える', () => {
  const g = new Game({ seed: 3 });
  setDice(g, [1, 4, 6]);
  endTurn(g);
  assert.ok(g.claimableIds().includes('jester'));

  assert.equal(g.claim('jester').ok, true);
  assert.ok(g.owned.has('jester'));

  setDice(g, [1, 4, 6]);
  endTurn(g);
  assert.equal(g.claimableIds().includes('jester'), false);
});

test('ペテン師は道化師を持っているときだけ取れ、道化師は無くなって再取得できない', () => {
  const g = new Game({ seed: 3 });
  setDice(g, [1, 4, 6]);
  endTurn(g);
  assert.equal(g.claimableIds().includes('trickster'), false, '道化師を持っていないうちは取れない');

  g.claim('jester');
  setDice(g, [1, 4, 6]);
  endTurn(g);
  assert.ok(g.claimableIds().includes('trickster'));

  g.claim('trickster');
  assert.ok(g.owned.has('trickster'));
  assert.equal(g.owned.has('jester'), false, '道化師は裏返されて無くなる');

  setDice(g, [1, 4, 6]);
  endTurn(g);
  assert.equal(g.claimableIds().includes('jester'), false, '1枚しかないので再取得できない');
});

test('常時効果のカードで、手番の最初に振るダイスが増える', () => {
  const g = new Game({ seed: 5 });
  assert.equal(g.baseDiceCount(), 3);

  setDice(g, [4, 4, 1]);
  endTurn(g);
  g.claim('farmer');                       // 農夫 +1
  assert.equal(g.baseDiceCount(), 4);
  assert.equal(g.dice.length, 4, '次のラウンドは4個で始まる');

  g.owned.add('general');                  // 将軍 +2
  assert.equal(g.baseDiceCount(), 6);
});

test('国王を獲得すると王妃も手に入り、最終ラウンドの案内に移る', () => {
  const g = new Game({ seed: 9 });
  setDice(g, new Array(7).fill(4));
  endTurn(g);
  assert.ok(g.claimableIds().includes('king'));

  g.claim('king');
  assert.ok(g.owned.has('king'));
  assert.ok(g.owned.has('queen'), '王妃も一緒に獲得する');
  assert.equal(g.kingRound, 1);
  assert.equal(g.phase, 'finalIntro');
});

test('最終ラウンドは出目の強さを記録して結果へ進む', () => {
  const g = new Game({ seed: 9 });
  setDice(g, new Array(7).fill(4));
  endTurn(g);
  g.claim('king');

  assert.equal(g.startFinalRound(), true);
  assert.equal(g.phase, 'roll');
  assert.equal(g.isFinalRound, true);

  setDice(g, [6, 6, 6, 6, 2, 1]);
  endTurn(g);
  assert.equal(g.phase, 'result');
  assert.deepEqual(g.crown, { count: 4, value: 6 });

  const r = g.result();
  assert.equal(r.success, true);
  assert.ok(r.total > 0);
});

test('ラウンドを使い切ると請願失敗で終わる', () => {
  const g = new Game({ seed: 11, difficulty: 'hard' });
  assert.equal(g.maxRounds, 10);
  for (let i = 0; i < 10; i++) {
    endTurn(g);
    g.claim(null);
  }
  assert.equal(g.phase, 'result');
  assert.equal(g.result().success, false);
  assert.equal(g.crown, null);
});

test('獲得できないカードは claim できない', () => {
  const g = new Game({ seed: 4 });
  setDice(g, [1, 2, 3]);
  endTurn(g);
  assert.equal(g.claim('king').ok, false);
  assert.equal(g.claim('queen').ok, false, '王妃は直接獲得できない');
});

test('ハイスコア詳細表記のフォーマット', async () => {
  const { formatHighScoreDetail } = await import('../src/ui/render.js');
  assert.equal(
    formatHighScoreDetail({ kingRound: 8, crown: { value: 6, count: 8 } }),
    '8ラウンドに6を8コ集めた'
  );
  assert.equal(formatHighScoreDetail(null), '');
  assert.equal(formatHighScoreDetail({ total: 300 }), '');
  assert.equal(formatHighScoreDetail({ success: false, kingRound: null, crown: null }), '');
});

