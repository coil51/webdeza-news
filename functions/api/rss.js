export async function onRequest({ request }) {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
  
    // 必須チェック
    if (!url) {
      return new Response("Missing url parameter", { status: 400 });
    }
  
    let target;
    try {
      target = new URL(url);
    } catch {
      return new Response("Invalid url", { status: 400 });
    }
  
    // SSRF対策：許可ホストだけ通す（必要なら追加）
    const allowHosts = new Set([
      "zenn.dev",
      "qiita.com",
      "ics.media",
      "css-tricks.com",
      "www.smashingmagazine.com",
    ]);
  
    if (!allowHosts.has(target.hostname)) {
      return new Response("Forbidden host", { status: 403 });
    }
  
    // 取得（Pages Functions側なのでCORS関係なし）
    const upstream = await fetch(target.toString(), {
      headers: {
        // RSS側がUAで弾くケースがあるので一応入れる（無くても動くことが多い）
        "User-Agent": "Mozilla/5.0 (compatible; RSS-Proxy/1.0)",
        "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
      },
      // Cloudflare側キャッシュ（任意）
      cf: { cacheTtl: 300, cacheEverything: true },
    });
  
    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, { status: 502 });
    }
  
    const xml = await upstream.text();
  
    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        // 同一オリジンで叩く想定なら不要だけど、念のため付けてもOK
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300",
      },
    });
  }
  