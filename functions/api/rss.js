const FEEDS_PATH = "/data/feeds.json";

const loadAllowedHosts = async (request) => {
  try {
    const feedsUrl = new URL(FEEDS_PATH, request.url);
    const res = await fetch(feedsUrl.toString(), { cache: "no-store" });
    if (!res.ok) {
      console.warn("feeds.json の取得に失敗しました", res.status);
      return new Set();
    }
    const feeds = await res.json();
    const hosts = new Set();
    const addHost = (value) => {
      if (!value) return;
      try {
        hosts.add(new URL(value).hostname);
      } catch {
        // ignore invalid URLs
      }
    };
    (feeds || []).forEach((feed) => {
      addHost(feed.feedUrl);
      addHost(feed.siteUrl);
    });
    return hosts;
  } catch (error) {
    console.error("allowHosts の生成に失敗しました", error);
    return new Set();
  }
};

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

  const allowHosts = await loadAllowedHosts(request);
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