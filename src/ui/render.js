// 画面の描画。状態を受け取ってDOMを組み立てるだけで、ゲームの判断はしない。

import { CARDS, LEVEL_LABELS, cardArt } from '../game/cards.js';
import { describeReq } from '../game/requirements.js';
import { DIFFICULTIES } from '../game/engine.js';

const PIPS = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [1, 3], [3, 1], [3, 3]],
  5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
  6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]],
};

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}

export function reqText(card) {
  return card.reqText ?? describeReq(card.req);
}

/** ダイス1つ */
export function dieEl(die, { state = '', clickable = false, justRolled = false, onClick } = {}) {
  const node = el('button', {
    type: 'button',
    class: ['die', die.fixed ? 'is-fixed' : '', state, clickable ? 'is-clickable' : '', justRolled ? 'just-rolled' : '']
      .filter(Boolean).join(' '),
    disabled: !clickable,
    'aria-label': `${die.value}の目${die.fixed ? '（確定済み）' : ''}`,
    onclick: onClick,
  });
  for (const [row, col] of PIPS[die.value] ?? []) {
    node.append(el('span', { class: 'pip', style: `grid-row:${row};grid-column:${col}` }));
  }
  return node;
}

export function renderDiceRow(container, dice, opts) {
  container.replaceChildren(...dice.map((d) => dieEl(d, opts(d))));
}

/** 所持カード（能力ボタン） */
export function renderOwned(container, game, onUse) {
  const cards = game.ownedCards;
  if (cards.length === 0) {
    container.replaceChildren(el('p', { class: 'owned-empty', text: 'まだ味方はいない' }));
    return;
  }
  container.replaceChildren(...cards.map((card) => {
    const st = game.abilityState(card);
    const passive = card.ability?.kind === 'passiveDice';
    const tag = passive ? `常時 ダイス+${card.ability.amount}`
      : st.usable ? '使える' : st.reason;
    return el('button', {
      type: 'button',
      class: `owned-card${st.usable ? ' is-usable' : ''}`,
      disabled: !st.usable,
      title: card.abilityText,
      onclick: () => onUse(card),
    }, [
      el('img', { src: cardArt(card.id), alt: '' }),
      el('span', {}, [
        el('span', { class: 'oc-name', text: card.name }),
        el('span', { class: 'oc-tag', text: tag }),
      ]),
    ]);
  }));
}

/** 宮廷（カード一覧） */
export function renderMarket(container, game, { choosable = [], chosen = null, onChoose } = {}) {
  const byLevel = new Map();
  for (const card of CARDS) {
    if (!byLevel.has(card.level)) byLevel.set(card.level, []);
    byLevel.get(card.level).push(card);
  }
  const claimable = new Set(choosable);

  container.replaceChildren(...[...byLevel.entries()].map(([level, cards]) =>
    el('div', { class: 'market-level' }, [
      el('div', { class: 'level-badge', text: LEVEL_LABELS[level] }),
      el('div', { class: 'level-cards' }, cards.map((card) => {
        const owned = game.owned.has(card.id);
        const gone = !game.pool.has(card.id) && !owned;
        const canPick = claimable.has(card.id);
        const classes = ['card-tile'];
        if (owned) classes.push('is-owned');
        if (gone) classes.push('is-gone');
        if (canPick) classes.push('is-claimable');
        if (canPick && onChoose) classes.push('is-choosable');
        if (chosen === card.id) classes.push('is-chosen');

        return el('div', {
          class: classes.join(' '),
          title: `${card.name}\n条件: ${reqText(card)}\n効果: ${card.abilityText}`,
          onclick: canPick && onChoose ? () => onChoose(card.id) : null,
        }, [
          el('img', { src: cardArt(card.id), alt: card.name, loading: 'lazy' }),
          el('div', { class: 'ct-name', text: card.name }),
          el('div', { class: 'ct-req', text: reqText(card) }),
          owned ? el('span', { class: 'ct-badge owned', text: '獲得済み' })
            : gone ? el('span', { class: 'ct-badge gone', text: '無し' }) : null,
        ]);
      })),
    ])));
}

export function renderLog(container, log) {
  container.replaceChildren(...log.slice(-60).reverse().map((entry) =>
    el('div', { class: 'log-line' }, [
      el('b', { text: entry.final ? '最終 ' : `R${entry.round} ` }),
      document.createTextNode(entry.text),
    ])));
}

export function renderHighScores(container, scores) {
  const rows = Object.values(DIFFICULTIES).map((d) => {
    const s = scores[d.id];
    return el('div', { class: 'hs-row' }, [
      el('span', { text: d.label }),
      el('b', { text: s ? `${s.total} 点` : '—' }),
    ]);
  });
  container.replaceChildren(
    el('h3', { text: 'ハイスコア' }),
    ...(Object.keys(scores).length ? rows : [el('p', { class: 'hs-empty', text: 'まだ記録がありません' })]),
  );
}
