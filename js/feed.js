const FEED_INDEX_LIMIT = 30;
const ITEMS_PER_FEED = 6;
const PROXY_ENDPOINT = "/api/rss";
const REQUEST_TIMEOUT_MS = 10_000;

const feedStore = {
  cache: null
};

const getCategoryFromQuery = () => {
  if (typeof window.__getCategoryParam === "function") {
    return window.__getCategoryParam();
  }
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("category");
  return slug ? slug.toLowerCase() : null;
};

const getReadableCategory = (slug) => {
  if (typeof window.__getReadableCategory === "function") {
    return window.__getReadableCategory(slug);
  }
  return slug ? slug.toUpperCase() : "All";
};

const loadFeeds = async () => {
  if (feedStore.cache) return feedStore.cache;
  const response = await fetch("data/feeds.json", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("feeds.json の取得に失敗しました");
  }
  const data = await response.json();
  feedStore.cache = data;
  return data;
};

const sanitizeDescription = (value = "") => {
  const temp = document.createElement("div");
  temp.innerHTML = value;
  const text = temp.textContent || temp.innerText || "";
  return text.replace(/\s+/g, " ").trim();
};

const getTextContent = (node, selector) => {
  const target = node.querySelector(selector);
  if (!target) return "";
  return target.textContent.trim();
};

const resolveLink = (item) => {
  const linkNode = item.querySelector("link");
  if (!linkNode) return "";
  const href = linkNode.getAttribute("href");
  if (href) return href.trim();
  return linkNode.textContent.trim();
};

const parseDate = (raw) => {
  if (!raw) return null;
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const fetchRssItems = async (feed, maxItems = 5) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const targetUrl = feed?.feedUrl || feed?.rssUrl;
  if (!targetUrl) {
    return { items: [], error: "RSS URL が設定されていません" };
  }

  try {
    const response = await fetch(
      `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`,
      { cache: "no-store", signal: controller.signal }
    );
    if (!response.ok) {
      throw new Error(`ステータス ${response.status}`);
    }
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "application/xml");

    if (xml.querySelector("parsererror")) {
      throw new Error("RSSの解析に失敗しました");
    }

    let items = Array.from(xml.querySelectorAll("item"));
    if (!items.length) {
      items = Array.from(xml.querySelectorAll("entry"));
    }

    const parsedItems = items.slice(0, maxItems).map((item) => {
      const title = getTextContent(item, "title") || "無題の記事";
      const link = resolveLink(item) || feed.siteUrl;
      const description =
        getTextContent(item, "description") ||
        getTextContent(item, "summary") ||
        getTextContent(item, "content");
      const dateNode =
        item.querySelector("pubDate") ||
        item.querySelector("updated") ||
        item.querySelector("dc\\:date");
      const rawDate = dateNode ? dateNode.textContent.trim() : "";
      const parsedDate = parseDate(rawDate);
      const timestamp = parsedDate ? parsedDate.getTime() : Date.now();

      return {
        title,
        link,
        description: sanitizeDescription(description),
        pubDate: rawDate,
        isoDate: parsedDate ? parsedDate.toISOString() : "",
        timestamp,
        feed
      };
    });

    return { items: parsedItems, error: null };
  } catch (error) {
    console.error(`"${feed.name}" のRSS取得に失敗しました`, error);
    const isAbort = error?.name === "AbortError";
    const message = isAbort ? "タイムアウトしました" : error?.message || "RSS取得に失敗しました";
    return { items: [], error: message };
  } finally {
    clearTimeout(timeoutId);
  }
};

const formatDate = (raw) => {
  const parsed = parseDate(raw);
  if (!parsed) return "日付不明";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsed);
};

const showEmptyState = (container, message) => {
  container.innerHTML = `<p class="empty-state">${message}</p>`;
};

const updateStructuredData = (items) => {
  const script = document.getElementById("structured-data");
  if (!script) return;
  const payload = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: item.link,
      name: item.title
    }))
  };
  script.textContent = JSON.stringify(payload, null, 2);
};

const createFeedBlock = (feed, items, errorMessage) => {
  const block = document.createElement("article");
  block.className = "feed-block";
  if (feed.accentColor) {
    block.style.setProperty("--feed-accent", feed.accentColor);
  }

  const header = document.createElement("div");
  header.className = "feed-block__header";

  const thumb = document.createElement("div");
  thumb.className = "feed-thumb";
  if (feed.thumbnail) {
    const img = document.createElement("img");
    img.src = feed.thumbnail;
    img.alt = `${feed.name} のスクリーンショット`;
    thumb.appendChild(img);
  } else {
    thumb.textContent = (feed.name || feed.id || "RSS").slice(0, 2).toUpperCase();
  }

  const meta = document.createElement("div");
  meta.className = "feed-meta";

  const metaTop = document.createElement("div");
  metaTop.className = "feed-meta__top";

  const title = document.createElement("h2");
  title.className = "feed-title";
  const siteLink = document.createElement("a");
  siteLink.href = feed.siteUrl || "#";
  siteLink.target = "_blank";
  siteLink.rel = "noopener noreferrer";
  siteLink.textContent = feed.name || feed.id || "Feed";
  title.appendChild(siteLink);

  const sourceLink = document.createElement("a");
  sourceLink.className = "feed-source";
  sourceLink.href = feed.feedUrl || feed.siteUrl || "#";
  sourceLink.target = "_blank";
  sourceLink.rel = "noopener noreferrer";
  sourceLink.title = "RSSを開く";
  sourceLink.textContent = "SOURCE";
  const sourceIcon = document.createElement("span");
  sourceIcon.className = "feed-source__icon";
  sourceIcon.ariaHidden = "true";
  sourceIcon.textContent = "📡";
  sourceLink.prepend(sourceIcon);

  metaTop.appendChild(title);
  metaTop.appendChild(sourceLink);

  const label = document.createElement("span");
  label.className = "feed-label";
  label.textContent = "最新の記事";

  meta.appendChild(metaTop);
  meta.appendChild(label);

  header.appendChild(thumb);
  header.appendChild(meta);

  block.appendChild(header);

  if (errorMessage) {
    const message = document.createElement("p");
    message.className = "feed-empty";
    message.textContent = errorMessage;
    block.appendChild(message);
    return block;
  }

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "feed-empty";
    empty.textContent = "記事を取得できませんでした。";
    block.appendChild(empty);
    return block;
  }

  const list = document.createElement("ul");
  list.className = "feed-list";

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "feed-list__item";

    if (item.isoDate) {
      const timeEl = document.createElement("time");
      timeEl.className = "feed-list__meta";
      timeEl.dateTime = item.isoDate;
      timeEl.textContent = formatDate(item.pubDate);
      li.appendChild(timeEl);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "feed-list__meta";
      placeholder.textContent = "—";
      li.appendChild(placeholder);
    }

    const link = document.createElement("a");
    link.className = "feed-list__link";
    link.href = item.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const titleEl = document.createElement("p");
    titleEl.className = "feed-list__title";
    titleEl.textContent = item.title;

    link.appendChild(titleEl);
    li.appendChild(link);

    list.appendChild(li);
  });

  block.appendChild(list);
  return block;
};

const renderIndexFeeds = async (container, feeds) => {
  container.innerHTML = '<p class="loading">最新記事を読み込み中...</p>';

  const settled = await Promise.allSettled(
    feeds.map((feed) => fetchRssItems(feed, ITEMS_PER_FEED))
  );

  const fragment = document.createDocumentFragment();
  const aggregated = [];

  settled.forEach((result, index) => {
    const feed = feeds[index];
    if (result.status === "fulfilled") {
      const { items, error } = result.value;
      if (items.length) {
        const limited = items.slice(0, ITEMS_PER_FEED);
        aggregated.push(...limited);
        fragment.appendChild(createFeedBlock(feed, limited));
      } else {
        fragment.appendChild(createFeedBlock(feed, [], error || "RSSが空でした"));
      }
    } else {
      fragment.appendChild(createFeedBlock(feed, [], "RSS取得で不明なエラーが発生しました"));
    }
  });

  if (!fragment.children.length) {
    showEmptyState(container, "現在表示できる記事がありません。");
    updateStructuredData([]);
    return;
  }

  container.innerHTML = "";
  container.appendChild(fragment);

  const structured = aggregated
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, FEED_INDEX_LIMIT);
  updateStructuredData(structured);
};

const renderCategoryFeeds = async (container, feeds) => {
  container.innerHTML = '<p class="loading">カテゴリ記事を読み込み中...</p>';

  const categorySlug = getCategoryFromQuery() || DEFAULT_CATEGORY;
  const targetFeeds = feeds.filter((feed) => feed.category === categorySlug);

  if (!targetFeeds.length) {
    showEmptyState(
      container,
      `${getReadableCategory(categorySlug)} カテゴリのRSS設定が見つかりません。`
    );
    updateStructuredData([]);
    return;
  }

  const settled = await Promise.allSettled(
    targetFeeds.map((feed) => fetchRssItems(feed, ITEMS_PER_FEED))
  );

  const fragment = document.createDocumentFragment();
  const aggregated = [];

  settled.forEach((result, index) => {
    const feed = targetFeeds[index];
    if (result.status === "fulfilled") {
      const { items, error } = result.value;
      if (items.length) {
        const limited = items.slice(0, ITEMS_PER_FEED);
        aggregated.push(...limited);
        fragment.appendChild(createFeedBlock(feed, limited));
      } else {
        fragment.appendChild(createFeedBlock(feed, [], error || "RSSが空でした"));
      }
    } else {
      fragment.appendChild(createFeedBlock(feed, [], "RSS取得で不明なエラーが発生しました"));
    }
  });

  if (!fragment.children.length) {
    showEmptyState(
      container,
      `${getReadableCategory(categorySlug)} カテゴリのRSSを取得できませんでした。`
    );
    updateStructuredData([]);
    return;
  }

  container.innerHTML = "";
  container.appendChild(fragment);

  const structured = aggregated.sort((a, b) => b.timestamp - a.timestamp);
  updateStructuredData(structured);
};

document.addEventListener("DOMContentLoaded", async () => {
  const feedGrid = document.getElementById("feed-grid");
  const categoryGrid = document.getElementById("category-feed-grid");

  if (!feedGrid && !categoryGrid) return;

  try {
    const feeds = await loadFeeds();
    if (feedGrid) {
      await renderIndexFeeds(feedGrid, feeds);
    }
    if (categoryGrid) {
      await renderCategoryFeeds(categoryGrid, feeds);
    }
  } catch (error) {
    console.error("フィードの初期化に失敗しました:", error);
    if (feedGrid) {
      showEmptyState(feedGrid, "フィードを読み込めませんでした。");
    }
    if (categoryGrid) {
      showEmptyState(categoryGrid, "フィードを読み込めませんでした。");
    }
    updateStructuredData([]);
  }
});
