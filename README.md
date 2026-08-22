# 王への請願 — ソロプレイ用デジタルアプリ

ボードゲーム『王への請願』(Um Krone und Kragen / To Court the King) を題材にした、
ブラウザで遊べる **1人用** アプリ。個人的な練習・ソロプレイ用の非公式実装です。

ブラウザだけで動きます。ビルド不要・依存パッケージゼロ。
進捗は [PROGRESS.md](PROGRESS.md)、ルール仕様は [docs/rules/](docs/rules/README.md) を参照。

## 構成

```
KingPetition/
├── PROGRESS.md      計画と進捗（作業前にまずこれを読む）
├── DEVLOG.md        実装経過ログ（判断の理由・詰まった点）
├── index.html       画面の骨格
├── docs/rules/      ★ルール仕様（確定版・実装の唯一の参照先）
├── assets/cards/    カード肖像画20枚（現在は最終ラウンド案内の演出のみで使用）
├── src/
│   ├── game/        ゲームロジック（DOM非依存・テスト対象）
│   ├── ui/          画面描画・入力（icons.js が条件/効果のSVGアイコン）
│   └── css/         スタイル
└── test/            node --test 用テスト
```

## 遊び方

1. 手持ちのダイスを全部振る
2. 未確定のダイスから **1つ以上** 選んで確定する
3. 確定しなかったダイスが振り直される
4. これを繰り返し、**残り全部を確定させると手番が終わる**
5. 確定した全ダイスの出目でカードを1枚獲得する

カードは「常時ダイスが増える」ものと「1手番に1回使える」ものがあります。
宮廷に並ぶカードには、まだ持っていないうちは **獲得条件と効果** のアイコンが、
手に入れたあとは **効果** のアイコンだけが表示されます。
アイコンの意味は「遊び方」の凡例にまとめてあります。
制限ラウンド内に **同じ目を7つ** 揃えて国王を獲得できれば成功。
そのあと最終ラウンドを1回行い、揃えた目の数と大きさが王冠ボーナスになります。

難易度は制限ラウンド数（やさしい15／ふつう12／むずかしい10）。
「日替わり」を選ぶと、その日は誰がやっても同じ出目の並びで遊べます。

## 技術方針

ビルドツール・外部依存なしの素の HTML + CSS + JavaScript (ES Modules)。
`npm install` 不要で、静的サーバに置くだけで動きます。
`package.json` は `type: module` の宣言とスクリプトのためだけに置いてあり、依存パッケージはありません。

## 公開（GitHub Pages）

`main` の `KingPetition/` に push すると、リポジトリ直下の
`.github/workflows/deploy-kingpetition.yml` が GitHub Pages へ公開します。

公開されるのは **遊ぶのに必要なファイルだけ**（約150KB）:

| 公開する | 公開しない |
|---|---|
| `index.html` / `src/` / `assets/favicon.svg` | `docs/`（ルール仕様） |
| 実際に使う肖像画2枚（`USED_ART_IDS`） | `test/` / `*.md` / `package.json` |
| | 使っていない肖像画18枚 |

デプロイ前に `node --test` と、公開物の参照チェック（index.html が参照するファイルと
`USED_ART_IDS` の画像が揃っているか）が走ります。

> ⚠️ **初回だけ手作業が必要です。**
> リポジトリの **Settings → Pages → Build and deployment → Source を「GitHub Actions」** に変更してください。
> （Pages サイトの新規作成APIは admin 権限が必要で、ワークフローの `GITHUB_TOKEN` では実行できません）
> 設定後、Actions から `Deploy KingPetition to Pages` を Re-run すれば公開されます。
> 公開先: `https://day0817.github.io/OriginalGames/`

## 起動

```bash
cd KingPetition
python3 -m http.server 8080   # npm start でも同じ
# → http://localhost:8080/
```

`file://` で直接開くと ES Modules の CORS 制限で動きません。必ず HTTP サーバ経由で開いてください。

`?debug` を付けて開くと `window.__kp` からゲーム状態を触れます（動作確認用）。

## テスト

```bash
node --test        # npm test でも同じ
```

ロジック（`src/game/`）は DOM に依存しないので、Node から直接テストできます。

## ルール

原典（BSW版の日本語ルール翻訳と peca卓ゲwiki のカード一覧）を `docs/rules/` に整理してある。
特に注意すべき点:

- 初期ダイスは3個。カードで増える（最大7個＋手番中の追加で最大14個）
- 手番は **全ダイスの目が確定するまで振り続ける**。途中でストップはできない
- 獲得できるのは1手番につき1枚、まだ持っていないカードのみ
- 国王（7つ同じ目）を獲得するとゲームの最終段階へ

ソロ用の目標とスコアは本アプリ独自の設計（[docs/rules/04-solo.md](docs/rules/04-solo.md)）。

## 注意

本アプリは個人利用を目的とした非公式のファン実装です。
カード肖像画は peca卓ゲwiki（https://w.atwiki.jp/peer-takuge/pages/18.html）から取得したものです。
再配布・商用利用はしません。盤面のカード表示は自前のSVGアイコンです。
