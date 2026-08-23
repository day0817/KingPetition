// エントリポイント。ゲーム状態の保持とイベント配線を行う。
// ルールの判断はすべて engine 側にあり、ここでは対象選択のフローだけを面倒みる。

import { Game, DIFFICULTIES } from '../game/engine.js';
import { CARDS, CARD_BY_ID, cardArt, USED_ART_IDS } from '../game/cards.js';
import { abilitySpec } from '../game/abilities.js';
import { iconLegend } from './icons.js';
import { Rng, hashSeed, todayKey } from '../game/rng.js';
import { getSettings, saveSettings, getHighScores, recordScore } from '../game/storage.js';
import * as R from './render.js';

const $ = (id) => document.getElementById(id);
const dom = {
  screens: { title: $('screen-title'), game: $('screen-game') },
  difficultyPicker: $('difficulty-picker'),
  modePicker: $('mode-picker'),
  highscores: $('highscores'),
  meterRound: $('meter-round'),
  meterDice: $('meter-dice'),
  meterCards: $('meter-cards'),
  fixedDice: $('fixed-dice'),
  activeDice: $('active-dice'),
  fixedCount: $('fixed-count'),
  activeCount: $('active-count'),
  handHint: $('hand-hint'),
  rollActions: $('roll-actions'),
  abilityBanner: $('ability-banner'),
  owned: $('owned-cards'),
  market: $('market'),
  floatingClaim: $('floating-claim'),
  log: $('log'),
  overlay: $('overlay'),
  overlayBody: $('overlay-body'),
};

let game = null;
const ui = {
  difficulty: getSettings().difficulty,
  mode: 'random',
  pending: null,     // 能力の対象選択中
  claimChoice: null, // 獲得フェーズで選択中のカード
};

// =============== タイトル ===============

function renderTitle() {
  dom.difficultyPicker.replaceChildren(...Object.values(DIFFICULTIES).map((d) =>
    R.el('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(ui.difficulty === d.id),
      onclick: () => { ui.difficulty = d.id; saveSettings({ difficulty: d.id }); renderTitle(); },
    }, [
      R.el('span', { text: d.label }),
      R.el('small', { text: `${d.rounds} ラウンド` }),
    ])));

  const modes = [
    { id: 'random', label: 'ランダム', note: '毎回ちがう出目' },
    { id: 'daily', label: '日替わり', note: todayKey() },
  ];
  dom.modePicker.replaceChildren(...modes.map((m) =>
    R.el('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(ui.mode === m.id),
      onclick: () => { ui.mode = m.id; renderTitle(); },
    }, [
      R.el('span', { text: m.label }),
      R.el('small', { text: m.note }),
    ])));

  R.renderHighScores(dom.highscores, getHighScores());
}

function showScreen(name) {
  dom.screens.title.hidden = name !== 'title';
  dom.screens.game.hidden = name !== 'game';
}

function startGame() {
  const seed = ui.mode === 'daily'
    ? hashSeed(`${todayKey()}/${ui.difficulty}`)
    : new Rng(Date.now() ^ Math.floor(Math.random() * 0xffffffff)).seed;
  game = new Game({ seed, difficulty: ui.difficulty });
  ui.pending = null;
  ui.claimChoice = null;
  hideOverlay();
  showScreen('game');
  render();
}

// =============== 描画 ===============

function render() {
  if (!game) return;

  dom.meterRound.textContent = game.isFinalRound ? '最終' : `${game.round} / ${game.maxRounds}`;
  dom.meterDice.textContent = String(game.dice.length);
  dom.meterCards.textContent = `${game.ownedCards.length} 枚`;
  dom.fixedCount.textContent = String(game.fixedDice.length);
  dom.activeCount.textContent = String(game.activeDice.length);

  renderDice();
  renderAbilityBanner();
  renderActions();
  R.renderOwned(dom.owned, game, onUseAbilityCard);
  R.renderLog(dom.log, game.log);
  renderMarket();

  game.justRolled.clear();
}

function renderDice() {
  const p = ui.pending;
  const rolled = game.justRolled;

  const activeClickable = (die) => {
    if (game.phase !== 'roll') return false;
    if (!p) return true;
    if (p.spec.mode === 'chooseValue') return false;
    if (p.spec.mode === 'plusTargets') return die.value + p.spec.amount <= 6;
    return true;
  };

  R.renderDiceRow(dom.activeDice, game.activeDice, (die) => ({
    state: p
      ? (p.ids.includes(die.id) ? 'is-picked' : (activeClickable(die) ? '' : 'is-disabled'))
      : (game.selection.has(die.id) ? 'is-selected' : ''),
    clickable: activeClickable(die),
    justRolled: rolled.has(die.id),
    onClick: () => onDieClick(die),
  }));

  const fixedClickable = !!p && p.spec.mode === 'pickActiveThenFixed';
  R.renderDiceRow(dom.fixedDice, game.fixedDice, (die) => ({
    state: p && p.fromId === die.id ? 'is-picked' : '',
    clickable: fixedClickable,
    justRolled: false,
    onClick: () => onDieClick(die),
  }));

  dom.activeDice.classList.toggle('is-target', !!p && p.spec.mode !== 'chooseValue');
  dom.fixedDice.classList.toggle('is-target', fixedClickable);
}

function renderMarket() {
  const claiming = game.phase === 'claim';
  const highlight = claiming ? game.claimableIds() : game.previewClaimableIds();
  R.renderMarket(dom.market, game, {
    choosable: highlight,
    chosen: ui.claimChoice,
    onChoose: claiming ? (id) => { ui.claimChoice = id; render(); } : null,
  });
}

function renderActions() {
  const actions = dom.rollActions;

  if (game.phase === 'claim') {
    const ids = game.claimableIds();
    dom.handHint.textContent = ids.length
      ? '獲得するカードを「宮廷」から選んでください。'
      : '獲得できるカードはありません。';
    const chosen = ui.claimChoice && ids.includes(ui.claimChoice) ? ui.claimChoice : null;
    actions.replaceChildren(
      R.el('button', {
        type: 'button', class: 'btn btn-primary', disabled: !chosen,
        text: chosen ? `${CARD_BY_ID[chosen].name} を獲得する` : 'カードを選んでください',
        onclick: () => doClaim(chosen),
      }),
      R.el('button', {
        type: 'button', class: 'btn', text: '獲得しない',
        onclick: () => doClaim(null),
      }),
    );

    // 画面右下のフローティング獲得ボタン（カード選択時に表示）
    if (dom.floatingClaim) {
      if (chosen) {
        dom.floatingClaim.hidden = false;
        dom.floatingClaim.replaceChildren(
          R.el('button', {
            type: 'button',
            class: 'btn btn-primary btn-floating-claim',
            text: `${CARD_BY_ID[chosen].name} を獲得する`,
            onclick: () => doClaim(chosen),
          })
        );
      } else {
        dom.floatingClaim.hidden = true;
        dom.floatingClaim.replaceChildren();
      }
    }
    return;
  }

  if (dom.floatingClaim) {
    dom.floatingClaim.hidden = true;
    dom.floatingClaim.replaceChildren();
  }

  if (game.phase !== 'roll') { actions.replaceChildren(); return; }

  const active = game.activeDice.length;
  const sel = game.selection.size;
  const canReroll = sel >= 1 && sel < active;

  dom.handHint.textContent = ui.pending
    ? ''
    : `未確定のダイスを選んで確定します。残り全部を確定させると手番が終わります。（未確定 ${active}個 / 選択中 ${sel}個）`;

  actions.replaceChildren(...[
    R.el('button', {
      type: 'button', class: 'btn btn-primary', disabled: !canReroll || !!ui.pending,
      text: sel === 0 ? '確定して振り直す' : `${sel}個を確定して残り${active - sel}個を振り直す`,
      onclick: () => { game.confirmFix(); afterEngineStep(); },
    }),
    R.el('button', {
      type: 'button', class: 'btn', disabled: !!ui.pending,
      text: `残り${active}個を全部確定（手番終了）`,
      onclick: () => { game.selectAllActive(); game.confirmFix(); afterEngineStep(); },
    }),
    sel > 0 ? R.el('button', {
      type: 'button', class: 'btn btn-ghost btn-sm', text: '選択解除', disabled: !!ui.pending,
      onclick: () => { game.clearSelection(); render(); },
    }) : null,
  ].filter(Boolean));
}

// =============== 能力の対象選択 ===============

function onUseAbilityCard(card) {
  const spec = abilitySpec(card);
  if (!spec || spec.passive) return;

  // 対象を選ぶ必要がないもの（目が固定のダイス追加）は即座に使う
  if (spec.mode === 'none') {
    applyAbility(card, {});
    return;
  }
  ui.pending = { card, spec: normalizeSpec(spec), ids: [], fromId: null, value: null, amount: 1, values: [] };
  render();
}

/** plus 系は「+できるダイスだけ選べる」ので mode を分けておく */
function normalizeSpec(spec) {
  if (spec.kind === 'plus') return { ...spec, mode: 'plusTargets' };
  return spec;
}

function onDieClick(die) {
  const p = ui.pending;
  if (!p) {
    game.toggleSelect(die.id);
    render();
    return;
  }
  const mode = p.spec.mode;

  if (mode === 'pickActiveThenFixed' && die.fixed) {
    p.fromId = p.fromId === die.id ? null : die.id;
    render();
    return;
  }
  if (die.fixed) return;

  if (mode === 'redistribute') {
    togglePick(p, die.id, p.spec.count);
    p.values = p.ids.map((id) => game.dice.find((d) => d.id === id).value);
  } else if (mode === 'plusTargets') {
    if (die.value + p.spec.amount > 6) return;
    togglePick(p, die.id, Infinity);
  } else if (mode === 'pickActiveThenFixed') {
    p.ids = p.ids[0] === die.id ? [] : [die.id];
  } else {
    togglePick(p, die.id, p.spec.max ?? 1);
  }
  render();
}

function togglePick(p, id, max) {
  const i = p.ids.indexOf(id);
  if (i >= 0) { p.ids.splice(i, 1); return; }
  if (max === 1) { p.ids = [id]; return; }
  if (p.ids.length >= max) return;
  p.ids.push(id);
}

function pendingPayload(p) {
  switch (p.spec.kind) {
    case 'addDie': return { value: p.value };
    case 'rerollActive': return { ids: p.ids };
    case 'bump': return { ids: p.ids, amount: p.amount };
    case 'plus': return { ids: p.ids };
    case 'redistribute': return { ids: p.ids, values: p.values };
    case 'copyFixed': return { ids: p.ids, fromId: p.fromId };
    case 'setValue': return { ids: p.ids, value: p.value };
    default: return {};
  }
}

function pendingReady(p) {
  switch (p.spec.kind) {
    case 'addDie': return Number.isInteger(p.value);
    case 'rerollActive':
    case 'plus': return p.ids.length >= 1;
    case 'bump': return p.ids.length === 1 && p.amount >= 1
      && game.dice.find((d) => d.id === p.ids[0]).value + p.amount <= 6;
    case 'setValue': return p.ids.length === 1 && Number.isInteger(p.value);
    case 'copyFixed': return p.ids.length === 1 && p.fromId !== null;
    case 'redistribute': {
      if (p.ids.length !== p.spec.count) return false;
      const before = p.ids.reduce((s, id) => s + game.dice.find((d) => d.id === id).value, 0);
      return p.values.reduce((s, v) => s + v, 0) === before;
    }
    default: return false;
  }
}

function renderAbilityBanner() {
  const p = ui.pending;
  const banner = dom.abilityBanner;
  if (!p) { banner.hidden = true; banner.replaceChildren(); return; }
  banner.hidden = false;

  const parts = [
    R.el('h3', { text: `${p.card.name} — ${p.card.abilityText}` }),
    R.el('p', { text: p.spec.prompt }),
  ];

  if (p.spec.kind === 'addDie' || p.spec.withValue) {
    parts.push(valueRow(p, '目を選ぶ'));
  }
  if (p.spec.kind === 'bump' && p.ids.length === 1) {
    parts.push(amountRow(p));
  }
  if (p.spec.kind === 'redistribute' && p.ids.length === p.spec.count) {
    parts.push(redistRow(p));
  }

  parts.push(R.el('div', { class: 'actions' }, [
    R.el('button', {
      type: 'button', class: 'btn btn-primary', disabled: !pendingReady(p), text: 'この内容で使う',
      onclick: () => applyAbility(p.card, pendingPayload(p)),
    }),
    R.el('button', {
      type: 'button', class: 'btn', text: 'やめる',
      onclick: () => { ui.pending = null; render(); },
    }),
  ]));

  banner.replaceChildren(...parts);
}

function valueRow(p, label) {
  return R.el('div', {}, [
    R.el('p', { text: label }),
    R.el('div', { class: 'value-row' }, [1, 2, 3, 4, 5, 6].map((v) =>
      R.el('button', {
        type: 'button', class: 'value-btn', 'aria-pressed': String(p.value === v), text: String(v),
        onclick: () => { p.value = v; render(); },
      }))),
  ]);
}

function amountRow(p) {
  const die = game.dice.find((d) => d.id === p.ids[0]);
  return R.el('div', {}, [
    R.el('p', { text: `いくつ増やす？（今の目は ${die.value}）` }),
    R.el('div', { class: 'value-row' }, [1, 2, 3].map((n) =>
      R.el('button', {
        type: 'button', class: 'value-btn',
        disabled: die.value + n > 6,
        'aria-pressed': String(p.amount === n), text: `+${n}`,
        onclick: () => { p.amount = n; render(); },
      }))),
  ]);
}

function redistRow(p) {
  const before = p.ids.reduce((s, id) => s + game.dice.find((d) => d.id === id).value, 0);
  const now = p.values.reduce((s, v) => s + v, 0);
  const step = (i, delta) => {
    const next = p.values[i] + delta;
    if (next < 1 || next > 6) return;
    p.values[i] = next;
    render();
  };
  return R.el('div', {}, [
    R.el('div', { class: 'redist' }, p.values.map((v, i) =>
      R.el('div', { class: 'redist-item' }, [
        R.el('button', { type: 'button', class: 'btn btn-sm', text: '−', disabled: v <= 1, onclick: () => step(i, -1) }),
        R.el('output', { text: String(v) }),
        R.el('button', { type: 'button', class: 'btn btn-sm', text: '＋', disabled: v >= 6, onclick: () => step(i, 1) }),
      ]))),
    R.el('p', {
      class: `redist-sum ${now === before ? 'is-ok' : 'is-bad'}`,
      text: `合計 ${now} / ${before}${now === before ? '' : '（元の合計に合わせてください）'}`,
    }),
  ]);
}

function applyAbility(card, payload) {
  const result = game.useAbility(card.id, payload);
  if (!result.ok) {
    dom.handHint.textContent = `使えません: ${result.error}`;
    return;
  }
  ui.pending = null;
  render();
}

// =============== 進行 ===============

function afterEngineStep() {
  ui.pending = null;
  ui.claimChoice = null;
  render();
  if (game.phase === 'claim') {
    dom.market.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else if (game.phase === 'finalIntro') {
    showFinalIntro();
  } else if (game.phase === 'result') {
    showResult();
  }
}

function doClaim(cardId) {
  const r = game.claim(cardId);
  if (!r.ok) { dom.handHint.textContent = r.error; return; }
  afterEngineStep();
}

// =============== オーバーレイ ===============

function showOverlay(...nodes) {
  dom.overlayBody.replaceChildren(...nodes.filter(Boolean));
  dom.overlay.hidden = false;
}
function hideOverlay() { dom.overlay.hidden = true; dom.overlayBody.replaceChildren(); }

function showFinalIntro() {
  showOverlay(
    R.el('h2', { text: '国王を説得した' }),
    R.el('p', { class: 'ov-lead', text: '王妃も味方についた。最後にもう一度だけダイスを振り、王冠にふさわしい出目を示せ。' }),
    R.el('div', { class: 'value-row' }, USED_ART_IDS.map((id) =>
      R.el('img', { src: cardArt(id), alt: '', style: 'width:98px;height:108px;border-radius:8px;object-fit:cover' }))),
    R.el('p', { class: 'ov-lead', text: '最終ラウンドは同じ目をできるだけ多く揃えるのが目的。数が同じなら目が大きいほうが強い。' }),
    R.el('div', { class: 'ov-actions' }, [
      R.el('button', {
        type: 'button', class: 'btn btn-primary', text: '最終ラウンドへ',
        onclick: () => { game.startFinalRound(); hideOverlay(); render(); },
      }),
    ]),
  );
}

function showResult() {
  const r = game.result();
  const entry = {
    total: r.total,
    success: r.success,
    kingRound: game.kingRound,
    crown: r.crown ? { value: r.crown.value, count: r.crown.count } : null,
    at: new Date().toISOString(),
    seed: game.seed,
  };
  const isBest = recordScore(game.difficulty.id, entry);

  const table = R.el('table', { class: 'score-table' },
    r.rows.map((row) => R.el('tr', {}, [
      R.el('td', {}, [
        R.el('div', { text: row.label }),
        R.el('div', { class: 'sc-detail', text: row.detail }),
      ]),
      R.el('td', { text: String(row.points) }),
    ])));

  showOverlay(
    R.el('h2', { text: r.success ? '請願は聞き届けられた' : '請願は届かなかった' }),
    R.el('p', {
      class: 'ov-lead',
      text: r.success
        ? `${game.kingRound} ラウンド目で国王を獲得。`
        : `${game.maxRounds} ラウンドでは国王に届かなかった。`,
    }),
    table,
    R.el('div', { class: 'score-total' }, [
      R.el('span', {}, [
        document.createTextNode('合計 '),
        isBest ? R.el('span', { class: 'badge-new', text: '自己ベスト' }) : null,
      ]),
      R.el('b', { text: String(r.total) }),
    ]),
    R.el('div', { class: 'ov-actions' }, [
      R.el('button', { type: 'button', class: 'btn btn-primary', text: 'もう一度', onclick: startGame }),
      R.el('button', {
        type: 'button', class: 'btn', text: 'タイトルへ',
        onclick: () => { hideOverlay(); renderTitle(); showScreen('title'); },
      }),
    ]),
  );
}

function showRules() {
  showOverlay(
    R.el('h2', { text: '遊び方' }),
    R.el('div', { class: 'rules-body', html: `
      <h3>目的</h3>
      <p>ダイスを振って条件を満たし、廷臣のカードを集めます。カードはダイスを増やしたり目を操作したりしてくれます。
      最終的に<strong>同じ目を7つ</strong>揃えて<strong>国王</strong>を獲得するのが目的です。</p>

      <h3>手番の流れ</h3>
      <ol>
        <li>手持ちのダイスをすべて振る</li>
        <li>未確定のダイスから<strong>1つ以上</strong>を選んで確定する</li>
        <li>確定しなかったダイスが振り直される</li>
        <li>これを繰り返し、<strong>残り全部を確定させると手番が終わる</strong></li>
        <li>確定した全ダイスの出目で、カードを1枚獲得する</li>
      </ol>
      <p>つまり「どこで手を止めるか」は自分で決められます。欲張るほど良い目が崩れる危険も増えます。</p>

      <h3>カードの効果</h3>
      <ul>
        <li><strong>常時</strong>… 手番の最初に振るダイスが増える（農夫・ペテン師・将軍）</li>
        <li><strong>1回</strong>… 1手番に1回だけ使える。効果の対象は原則<strong>未確定のダイス</strong></li>
      </ul>
      <p>獲得できるのは1手番につき1枚、まだ持っていないカードだけです。国王を取ると王妃も一緒に手に入ります。</p>

      <h3>ソロの目標</h3>
      <p>制限ラウンド内に国王を獲得すれば成功。そのあと最終ラウンドを1回行い、
      同じ目をできるだけ多く揃えると王冠ボーナスが増えます。</p>

      <h3>カードの見かた</h3>
      <p>まだ持っていないカードには<strong>獲得条件</strong>と<strong>効果</strong>、
      手に入れたカードには<strong>効果</strong>だけが表示されます。</p>
    ` }),
    iconLegend(CARDS),
    R.el('div', { class: 'ov-actions' }, [
      R.el('button', { type: 'button', class: 'btn btn-primary', text: '閉じる', onclick: hideOverlay }),
    ]),
  );
}

// =============== 起動 ===============

$('btn-start').addEventListener('click', startGame);
$('btn-rules').addEventListener('click', showRules);
$('btn-rules-2').addEventListener('click', showRules);
$('btn-title').addEventListener('click', () => {
  if (game && game.phase !== 'result' && !confirm('タイトルに戻ると、この請願は取り下げになります。よろしいですか？')) return;
  hideOverlay();
  renderTitle();
  showScreen('title');
});
dom.overlay.addEventListener('click', (e) => {
  // 背景クリックで閉じられるのは「遊び方」だけ
  if (e.target === dom.overlay && dom.overlayBody.querySelector('.rules-body')) hideOverlay();
});

// 動作確認用のフック。?debug 付きで開いたときだけ有効。
if (new URLSearchParams(location.search).has('debug')) {
  window.__kp = { get game() { return game; }, get ui() { return ui; }, render };
}

renderTitle();
showScreen('title');
