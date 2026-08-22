# assets/cards/ — キャラクターカード画像

20種のカード肖像画（98×108px / JPEG）。アプリ内でカードの絵として使用する。

- 出典: peca卓ゲwiki「王への請願 / カード一覧」 https://w.atwiki.jp/peer-takuge/pages/18.html
- ファイル名は `src/game/cards.js` のカードID（英字）と一対一で対応する。
  → `assets/cards/${card.id}.jpg` で参照できる。

| Lv | 日本語名 | ファイル | カードID |
|----|---------|---------|---------|
| 0 | 道化師 | `jester.jpg` | `jester` |
| 0 | ペテン師 | `trickster.jpg` | `trickster` |
| Ⅰ | 農夫 | `farmer.jpg` | `farmer` |
| Ⅰ | 下女 | `maid.jpg` | `maid` |
| Ⅰ | 哲学者 | `philosopher.jpg` | `philosopher` |
| Ⅰ | 職人 | `craftsman.jpg` | `craftsman` |
| Ⅰ | 衛兵 | `guard.jpg` | `guard` |
| Ⅱ | 狩人 | `hunter.jpg` | `hunter` |
| Ⅱ | 商人 | `merchant.jpg` | `merchant` |
| Ⅱ | 天文学者 | `astronomer.jpg` | `astronomer` |
| Ⅲ | 女官 | `court_lady.jpg` | `court_lady` |
| Ⅲ | 質屋 | `pawnbroker.jpg` | `pawnbroker` |
| Ⅲ | 騎士 | `knight.jpg` | `knight` |
| Ⅲ | 魔術師 | `magician.jpg` | `magician` |
| Ⅳ | 錬金術師 | `alchemist.jpg` | `alchemist` |
| Ⅳ | 司教 | `bishop.jpg` | `bishop` |
| Ⅳ | 貴族 | `noble.jpg` | `noble` |
| Ⅳ | 将軍 | `general.jpg` | `general` |
| Ⅴ | 国王 | `king.jpg` | `king` |
| Ⅴ | 王妃 | `queen.jpg` | `queen` |

画像は小さいので、CSS で拡大表示する場合は `image-rendering` の指定を検討すること。
