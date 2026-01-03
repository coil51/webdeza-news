# coil-rss（Cloudflare Workers 対応版）

## 概要
静的サイト側の RSS 取得で発生する CORS 問題を回避するため、Cloudflare Workers 上に `/api/rss?url=...` プロキシを配置します。フロントエンド（`js/feed.js`）は同一オリジンの API を経由して RSS を取得するように変更済みです。

## ディレクトリ構成
- `worker/rss-proxy.js` … Cloudflare Worker 本体
- `js/feed.js` … RSS 取得処理（プロキシ経由に変更済み）
- `data/feeds.json` … RSS リスト

## デプロイ手順（例：Wrangler CLI）
1. Cloudflare アカウントで Workers を有効化する。
2. このリポジトリ直下で `wrangler login` を実行。
3. `worker/rss-proxy.js` をエントリとして Worker を作成:
   - `wrangler init`（既存プロジェクトに合わせてスキップ可）
   - `wrangler deploy worker/rss-proxy.js --name coil-rss-proxy`
4. ルートを設定（例）  
   - `Routes` で `https://<your-domain>/api/rss` をこの Worker に紐付ける。  
   - Cloudflare Pages を使う場合は、Pages の Functions 設定で `/api/rss` を Worker に向ける。
5. ブラウザで `index.html` / `category.html` を開き、記事が表示されることを確認。

## allowHosts（SSRF 対策）
- 現在は `functions/api/rss.js` で `data/feeds.json` を読み、`feedUrl` / `siteUrl` の hostname を自動で許可します。
- feeds.json に無いホストは 403 で拒否されます（空リスト時も 403）。

## ローカル/デプロイ後の動作確認
- API 単体: `https://<your-pages-domain>/api/rss?url=<encodeURIComponent(feedUrl)>`  
  例: `https://<your-pages-domain>/api/rss?url=https%3A%2F%2Fwww.smashingmagazine.com%2Ffeed%2F` が 200 で XML を返すこと。
- SSRF 防御: feeds.json に無いホストを指定すると 403 になること  
  例: `https://<your-pages-domain>/api/rss?url=https%3A%2F%2Fexample.com%2Frss.xml` → 403。
- フロント: 静的サーバー（例: `npx serve .`）で配信し、  
  - TOP: サイト別ブロックが並び、各ブロックに最新記事が 4 件表示されること  
  - カテゴリ: `category.html?category=design` などで該当カテゴリのみ表示されること

## 運用チェックリスト
- RSS 追加手順: `data/feeds.json` に `{id,name,category,feedUrl,siteUrl,thumbnail,accentColor}` を追加（カテゴリは nav と同じ design/dev/news/life）。デプロイ時はファイル更新のみで allowlist も自動反映。
- 動作確認: `/api/rss?url=...` が 200 を返すこと、フロントで該当ブロックに記事が出ること。
- トラブルシュート: 403 は feeds.json にホストが無い、500/502 は配信元エラーや URL 誤りを疑う。
- 回復性: 一部の取得が失敗しても `Promise.allSettled` で全体表示は継続。
## 既知の制限
- RSS 配信元がダウンしている場合や、フィードが壊れている場合はカードに「取得失敗」が表示されます。
- `/api/rss` で 403 が返る場合は、`allowHosts` に対象ホストが未登録である可能性があります。
- フィードごとに最大取得件数はトップ 3件 / カテゴリ 5件です（`js/feed.js` 内の定数で変更可能）。レビューの上で必要に応じて調整してください。

