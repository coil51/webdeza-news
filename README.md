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
- `worker/rss-proxy.js` の `allowHosts` は公開対象 5 ホストを許可済みです: `zenn.dev` / `qiita.com` / `ics.media` / `css-tricks.com` / `www.smashingmagazine.com`
- ホワイトリスト外は 403 で拒否します（空リストでも拒否）。
- **運用ルール**: `data/feeds.json` を更新したら、同じホストを `allowHosts` にも追加してください。

## ローカル確認のヒント
- Cloudflare の「ワーカーをプレビュー」機能、もしくは `wrangler dev worker/rss-proxy.js` で `/api/rss?url=...` を叩いて動作を確認できます。
- フロントは静的ファイルなので、任意の静的サーバー（例: `npx serve .`）で配信し、同一オリジンで `/api/rss` にアクセスできる状態にしてください。

## 運用チェックリスト
- RSS 追加手順: 1) `data/feeds.json` に `rssUrl` を追加 2) `allowHosts` に hostname を追加 3) Worker を再デプロイ
- 動作確認: Worker 単体は `/api/rss?url=...` で XML が返るか、フロントは CORS エラーなく RSS が表示されるか
- トラブルシュート: 403 は `allowHosts` 漏れ、500 は RSS URL 誤りや配信元停止を疑う
- 回復性: 一部の取得が失敗しても `Promise.allSettled` で全体表示は継続
## 既知の制限
- RSS 配信元がダウンしている場合や、フィードが壊れている場合はカードに「取得失敗」が表示されます。
- `/api/rss` で 403 が返る場合は、`allowHosts` に対象ホストが未登録である可能性があります。
- フィードごとに最大取得件数はトップ 3件 / カテゴリ 5件です（`js/feed.js` 内の定数で変更可能）。レビューの上で必要に応じて調整してください。

