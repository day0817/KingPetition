// ゲーム進行のステートマシン。DOM には一切触らない。
//
// ルールの根拠は docs/rules/ 配下:
//   - 手番の流れ            01-overview.md
//   - カードの獲得条件と効果 02-cards.md
//   - 最終ラウンド           03-endgame.md
//   - ソロ用の目標とスコア   04-solo.md
//
// 手番の要点:
//   全部振る → 未確定のダイスから「少なくとも1つ」を確定 → 残りを振りなおす、を繰り返す。
//   残り全部を確定させればその時点で手番終了（＝好きなタイミングで止められる）。

import { Rng } from './rng.js';
import { CARDS, CARD_BY_ID } from './cards.js';
import { meets, bestOfAKind } from './requirements.js';
import { applyAbility, abilityAvailability } from './abilities.js';
import { computeScore } from './score.js';

export const BASE_DICE = 3;

export const DIFFICULTIES = {
  easy: { id: 'easy', label: 'やさしい', rounds: 15 },
  normal: { id: 'normal', label: 'ふつう', rounds: 12 },
  hard: { id: 'hard', label: 'むずかしい', rounds: 10 },
};

export class Game {
  constructor({ seed, difficulty = 'normal' } = {}) {
    const diff = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
    this.difficulty = diff;
    this.maxRounds = diff.rounds;
    this.rng = new Rng(seed);
    this.seed = this.rng.seed;

    this.round = 1;
    this.phase = 'roll';         // 'roll' | 'claim' | 'finalIntro' | 'result'
    this.isFinalRound = false;
    this.kingRound = null;
    this.crown = null;           // { count, value }

    this.dice = [];
    this._nextDieId = 1;
    this.selection = new Set();
    this.usedAbilities = new Set();
    this.justRolled = new Set(); // 直前に振られたダイス（UIの演出用）

    this.owned = new Set();
    this.pool = new Set(CARDS.map((c) => c.id));
    this.log = [];

    this._startRound();
  }

  // ---------- 参照 ----------

  get activeDice() { return this.dice.filter((d) => !d.fixed); }
  get fixedDice() { return this.dice.filter((d) => d.fixed); }
  get values() { return this.dice.map((d) => d.value); }
  get ownedCards() { return CARDS.filter((c) => this.owned.has(c.id)); }
  get roundsLeft() { return Math.max(0, this.maxRounds - this.round); }
  get hasKing() { return this.owned.has('king'); }

  /** 手番の最初に振るダイスの数（常時効果を合算） */
  baseDiceCount() {
    let n = BASE_DICE;
    for (const card of this.ownedCards) {
      if (card.ability?.kind === 'passiveDice') n += card.ability.amount;
    }
    return n;
  }

  /** 今この手番でそのカードの能力を使えるか */
  abilityState(card) {
    if (!this.owned.has(card.id)) return { usable: false, reason: 'そのカードを持っていません' };
    if (!card.ability || card.ability.kind === 'passiveDice') {
      return { usable: false, reason: '常時効果' };
    }
    if (this.phase !== 'roll') return { usable: false, reason: '手番中のみ使えます' };
    if (this.usedAbilities.has(card.id)) return { usable: false, reason: 'この手番では使用済み' };
    const gate = abilityAvailability(card, this._ctx());
    return gate.ok ? { usable: true } : { usable: false, reason: gate.error };
  }

  /** 今の出目で獲得できるカードのID一覧（claim フェーズのみ） */
  claimableIds() {
    return this.phase === 'claim' ? this._claimableFor(this.values) : [];
  }

  /** 手番中に「今この出目なら何が取れるか」を示すための先読み */
  previewClaimableIds() {
    return this._claimableFor(this.values);
  }

  _claimableFor(values) {
    return CARDS.filter((card) => {
      if (!this.pool.has(card.id) || this.owned.has(card.id)) return false;
      if (card.special === 'queen') return false;              // 国王と一緒にしか手に入らない
      if (card.special === 'trickster') return this.owned.has('jester');
      if (card.special === 'jester' && this.owned.has('trickster')) return false;
      return meets(card.req, values);
    }).map((c) => c.id);
  }

  // ---------- 操作 ----------

  toggleSelect(id) {
    if (this.phase !== 'roll') return false;
    const die = this.dice.find((d) => d.id === id);
    if (!die || die.fixed) return false;
    if (this.selection.has(id)) this.selection.delete(id);
    else this.selection.add(id);
    return true;
  }

  selectAllActive() {
    if (this.phase !== 'roll') return;
    for (const d of this.activeDice) this.selection.add(d.id);
  }

  clearSelection() { this.selection.clear(); }

  canConfirm() { return this.phase === 'roll' && this.selection.size >= 1; }

  /** 選んだダイスを確定し、残りを振りなおす。残りが無ければ手番終了。 */
  confirmFix() {
    if (!this.canConfirm()) return { ok: false, error: 'ダイスを1つ以上選んでください' };

    const fixedNow = [];
    for (const die of this.dice) {
      if (this.selection.has(die.id)) {
        die.fixed = true;
        fixedNow.push(die.value);
      }
    }
    this.selection.clear();
    this._log(`${fixedNow.length}個を確定（${fixedNow.join('・')}）`);

    const rest = this.activeDice;
    if (rest.length === 0) {
      this._finishRolling();
      return { ok: true, turnEnded: true };
    }
    this._rollDice(rest);
    return { ok: true, turnEnded: false };
  }

  useAbility(cardId, payload = {}) {
    const card = CARD_BY_ID[cardId];
    if (!card) return { ok: false, error: 'カードが見つかりません' };
    const state = this.abilityState(card);
    if (!state.usable) return { ok: false, error: state.reason };

    const result = applyAbility(card, payload, this._ctx());
    if (!result.ok) return result;

    this.usedAbilities.add(cardId);
    this._log(`${card.name}: ${result.detail}`);
    return result;
  }

  /** cardId が null なら獲得しない */
  claim(cardId) {
    if (this.phase !== 'claim') return { ok: false, error: '獲得できる場面ではありません' };

    if (cardId === null) {
      this._log('カードを獲得しなかった');
      this._afterClaim();
      return { ok: true };
    }
    if (!this.claimableIds().includes(cardId)) {
      return { ok: false, error: 'そのカードは獲得できません' };
    }

    const card = CARD_BY_ID[cardId];
    this.owned.add(cardId);
    this.pool.delete(cardId);

    if (card.special === 'trickster') {
      // 道化師を裏返してペテン師にする。道化師は無くなり、プールにも戻らない。
      this.owned.delete('jester');
      this.pool.delete('jester');
      this._log('道化師を裏返してペテン師を獲得');
    } else if (card.special === 'king') {
      this.owned.add('queen');
      this.pool.delete('queen');
      this.kingRound = this.round;
      this._log('国王を獲得（王妃も一緒に獲得）');
    } else {
      this._log(`${card.name}（LV${card.level}）を獲得`);
    }

    this._afterClaim();
    return { ok: true, card };
  }

  /** 最終ラウンドを開始する（phase === 'finalIntro' のとき） */
  startFinalRound() {
    if (this.phase !== 'finalIntro') return false;
    this.isFinalRound = true;
    this._log('--- 最終ラウンド ---');
    this._startRound();
    return true;
  }

  /** リザルト用のスコア */
  result() {
    const levelSum = this.ownedCards.reduce((s, c) => s + c.level, 0);
    const remainingRounds = this.hasKing ? Math.max(0, this.maxRounds - this.kingRound) : 0;
    const score = computeScore({
      levelSum,
      kingObtained: this.hasKing,
      remainingRounds,
      crown: this.crown,
    });
    return {
      success: this.hasKing,
      levelSum,
      remainingRounds,
      crown: this.crown,
      ...score,
    };
  }

  // ---------- 内部 ----------

  _ctx() {
    const self = this;
    return {
      get active() { return self.activeDice; },
      get fixed() { return self.fixedDice; },
      find: (id) => self.dice.find((d) => d.id === id),
      addDie: (value) => {
        const die = { id: self._nextDieId++, value, fixed: false };
        self.dice.push(die);
        return die;
      },
      reroll: (die) => {
        die.value = self.rng.die();
        self.justRolled.add(die.id);
      },
    };
  }

  _startRound() {
    this.phase = 'roll';
    this.selection.clear();
    this.usedAbilities.clear();
    this.justRolled.clear();
    this.dice = [];
    const n = this.baseDiceCount();
    for (let i = 0; i < n; i++) {
      this.dice.push({ id: this._nextDieId++, value: 1, fixed: false });
    }
    this._rollDice(this.dice);
    const label = this.isFinalRound ? '最終ラウンド' : `ラウンド ${this.round}/${this.maxRounds}`;
    this._log(`${label} — ${n}個のダイスを振った`);
  }

  _rollDice(dice) {
    this.justRolled.clear();
    for (const die of dice) {
      die.value = this.rng.die();
      this.justRolled.add(die.id);
    }
  }

  _finishRolling() {
    if (this.isFinalRound) {
      this.crown = bestOfAKind(this.values);
      this._log(`最終結果: ${this.crown.value} が ${this.crown.count}個`);
      this.phase = 'result';
      return;
    }
    this.phase = 'claim';
  }

  _afterClaim() {
    if (this.hasKing) {
      this.phase = 'finalIntro';
      return;
    }
    if (this.round >= this.maxRounds) {
      this.phase = 'result';
      this._log('ラウンドを使い切った — 請願は届かなかった');
      return;
    }
    this.round += 1;
    this._startRound();
  }

  _log(text) {
    this.log.push({ round: this.round, final: this.isFinalRound, text });
    if (this.log.length > 200) this.log.shift();
  }
}
