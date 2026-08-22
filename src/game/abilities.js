// カード能力の効果適用。
//
// engine から ctx（ダイスへの最小限の操作口）を受け取って動く。
// engine を import しないこと（循環参照になる）。
//
// ctx = {
//   active: [die], fixed: [die],   // die = { id, value, fixed }
//   find(id) -> die|undefined,
//   addDie(value) -> die,          // 未確定のダイスを追加
//   reroll(die) -> void,           // その場で振りなおす
// }

const err = (message) => ({ ok: false, error: message });
const OK = { ok: true };

/**
 * UI が対象選択のために必要とする情報。
 * mode: 'none' | 'pickActive' | 'pickActiveThenFixed' | 'redistribute' | 'chooseValue'
 */
export function abilitySpec(card) {
  const a = card.ability;
  if (!a) return null;
  switch (a.kind) {
    case 'passiveDice':
      return { kind: a.kind, mode: 'none', passive: true };
    case 'addDie':
      return a.value === 'choose'
        ? { kind: a.kind, mode: 'chooseValue', prompt: '追加するダイスの目を選んでください' }
        : { kind: a.kind, mode: 'none', prompt: `目が${a.value}のダイスを追加します` };
    case 'rerollActive':
      return a.count === 'any'
        ? { kind: a.kind, mode: 'pickActive', min: 1, max: Infinity, prompt: '振りなおす未確定のダイスを選んでください（何個でも）' }
        : { kind: a.kind, mode: 'pickActive', min: 1, max: 1, prompt: '振りなおす未確定のダイスを1つ選んでください' };
    case 'bump':
      return { kind: a.kind, mode: 'pickActive', min: 1, max: 1, withAmount: a.max, prompt: '目を増やす未確定のダイスを1つ選んでください' };
    case 'plus':
      return { kind: a.kind, mode: 'pickActive', min: 1, max: Infinity, amount: a.amount, prompt: `＋${a.amount}する未確定のダイスを選んでください（何個でも）` };
    case 'redistribute':
      return { kind: a.kind, mode: 'redistribute', count: a.count, prompt: `未確定のダイスを${a.count}つ選んでください（合計を変えずに目を振り分けます）` };
    case 'copyFixed':
      return { kind: a.kind, mode: 'pickActiveThenFixed', prompt: '目を変える未確定のダイスと、コピー元の確定済みダイスを選んでください' };
    case 'setValue':
      return { kind: a.kind, mode: 'pickActive', min: 1, max: 1, withValue: true, prompt: '目を変える未確定のダイスを1つ選んでください' };
    default:
      throw new Error(`未知の能力: ${a.kind}`);
  }
}

/** 今この能力を使えるか（対象が存在するか）。使えない理由も返す。 */
export function abilityAvailability(card, ctx) {
  const a = card.ability;
  if (!a) return err('効果はありません');
  if (a.kind === 'passiveDice') return err('常時効果です');

  const active = ctx.active;
  switch (a.kind) {
    case 'addDie':
      return OK;
    case 'rerollActive':
    case 'bump':
    case 'setValue':
    case 'redistribute':
      if (a.kind === 'redistribute' && active.length < a.count) {
        return err(`未確定のダイスが${a.count}つ必要です`);
      }
      if (active.length === 0) return err('未確定のダイスがありません');
      return OK;
    case 'plus': {
      if (active.length === 0) return err('未確定のダイスがありません');
      if (!active.some((d) => d.value + a.amount <= 6)) {
        return err(`＋${a.amount}できるダイスがありません`);
      }
      return OK;
    }
    case 'copyFixed':
      if (active.length === 0) return err('未確定のダイスがありません');
      if (ctx.fixed.length === 0) return err('確定済みのダイスがありません');
      return OK;
    default:
      return err('未知の能力です');
  }
}

function pickActive(ctx, ids) {
  const dice = [];
  for (const id of ids ?? []) {
    const d = ctx.find(id);
    if (!d) return { error: 'ダイスが見つかりません' };
    if (d.fixed) return { error: '確定済みのダイスは対象にできません' };
    if (dice.includes(d)) return { error: '同じダイスを重複して選べません' };
    dice.push(d);
  }
  return { dice };
}

/**
 * 能力を適用する。payload の形は abilitySpec の mode に対応。
 *   rerollActive : { ids }
 *   addDie       : {} または { value }
 *   bump         : { ids:[1つ], amount }
 *   plus         : { ids }
 *   redistribute : { ids, values }
 *   copyFixed    : { ids:[1つ], fromId }
 *   setValue     : { ids:[1つ], value }
 */
export function applyAbility(card, payload, ctx) {
  const a = card.ability;
  const gate = abilityAvailability(card, ctx);
  if (!gate.ok) return gate;

  switch (a.kind) {
    case 'addDie': {
      let value = a.value;
      if (value === 'choose') {
        value = payload?.value;
        if (!Number.isInteger(value) || value < 1 || value > 6) return err('1〜6の目を選んでください');
      }
      const die = ctx.addDie(value);
      return { ok: true, detail: `目が${die.value}のダイスを追加` };
    }

    case 'rerollActive': {
      const { dice, error } = pickActive(ctx, payload?.ids);
      if (error) return err(error);
      const max = a.count === 'any' ? Infinity : a.count;
      if (dice.length < 1 || dice.length > max) return err('選んだダイスの数が正しくありません');
      for (const d of dice) ctx.reroll(d);
      return { ok: true, detail: `${dice.length}個のダイスを振りなおし` };
    }

    case 'bump': {
      const { dice, error } = pickActive(ctx, payload?.ids);
      if (error) return err(error);
      if (dice.length !== 1) return err('ダイスを1つ選んでください');
      const amount = payload?.amount;
      if (!Number.isInteger(amount) || amount < 1 || amount > a.max) {
        return err(`＋1〜＋${a.max} の範囲で選んでください`);
      }
      const die = dice[0];
      if (die.value + amount > 6) return err('目が6を超える指定はできません');
      die.value += amount;
      return { ok: true, detail: `ダイスの目を＋${amount}（→${die.value}）` };
    }

    case 'plus': {
      const { dice, error } = pickActive(ctx, payload?.ids);
      if (error) return err(error);
      if (dice.length < 1) return err('ダイスを1つ以上選んでください');
      for (const d of dice) {
        if (d.value + a.amount > 6) return err(`目が${d.value}のダイスには＋${a.amount}できません`);
      }
      for (const d of dice) d.value += a.amount;
      return { ok: true, detail: `${dice.length}個のダイスに＋${a.amount}` };
    }

    case 'redistribute': {
      const { dice, error } = pickActive(ctx, payload?.ids);
      if (error) return err(error);
      if (dice.length !== a.count) return err(`ダイスを${a.count}つ選んでください`);
      const values = payload?.values;
      if (!Array.isArray(values) || values.length !== a.count) return err('目の指定が正しくありません');
      if (!values.every((v) => Number.isInteger(v) && v >= 1 && v <= 6)) return err('目は1〜6にしてください');
      const before = dice.reduce((s, d) => s + d.value, 0);
      const after = values.reduce((s, v) => s + v, 0);
      if (before !== after) return err(`合計を変えられません（${before} → ${after}）`);
      dice.forEach((d, i) => { d.value = values[i]; });
      return { ok: true, detail: `${a.count}つのダイスを ${values.join('・')} に振り分け` };
    }

    case 'copyFixed': {
      const { dice, error } = pickActive(ctx, payload?.ids);
      if (error) return err(error);
      if (dice.length !== 1) return err('未確定のダイスを1つ選んでください');
      const from = ctx.find(payload?.fromId);
      if (!from || !from.fixed) return err('確定済みのダイスを1つ選んでください');
      dice[0].value = from.value;
      return { ok: true, detail: `確定済みの${from.value}をコピー` };
    }

    case 'setValue': {
      const { dice, error } = pickActive(ctx, payload?.ids);
      if (error) return err(error);
      if (dice.length !== 1) return err('ダイスを1つ選んでください');
      const value = payload?.value;
      if (!Number.isInteger(value) || value < 1 || value > 6) return err('1〜6の目を選んでください');
      dice[0].value = value;
      return { ok: true, detail: `ダイスの目を${value}に変更` };
    }

    default:
      return err('未知の能力です');
  }
}
