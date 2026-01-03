const allowHosts = new Set([
  "zenn.dev",
  "qiita.com",
  "ics.media",
  "css-tricks.com",
  "www.smashingmagazine.com"
]);

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const REQUEST_TIMEOUT_MS = 10_000;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "access-control-allow-headers": "Content-Type"
};

const jsonResponse = (body, status = 400) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json;charset=UTF-8",
      ...corsHeaders
    }
  });

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/api/rss") {
      return jsonResponse({ status: 404, message: "Not Found" }, 404);
    }

    const target = url.searchParams.get("url");
    if (!target) {
      return jsonResponse({ status: 400, message: "url クエリを指定してください" });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return jsonResponse({ status: 400, message: "不正な URL です" });
    }

    if (!ALLOWED_PROTOCOLS.has(targetUrl.protocol)) {
      return jsonResponse({ status: 400, message: "許可されていないプロトコルです" });
    }

    if (!allowHosts.size || !allowHosts.has(targetUrl.hostname.toLowerCase())) {
      return jsonResponse({ status: 403, message: "このホストは許可されていません" }, 403);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const upstream = await fetch(targetUrl.toString(), {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "coil-rss-proxy/1.0 (+https://example.com)"
        }
      });

      const headers = new Headers();
      const contentType = upstream.headers.get("content-type");
      if (contentType) headers.set("content-type", contentType);
      headers.set("cache-control", "no-store");
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));

      return new Response(upstream.body, {
        status: upstream.status,
        headers
      });
    } catch (error) {
      const isAbort = error?.name === "AbortError";
      const message = isAbort ? "取得がタイムアウトしました" : "RSS の取得に失敗しました";
      return jsonResponse({ status: 504, message }, 504);
    } finally {
      clearTimeout(timeoutId);
    }
  }
};

