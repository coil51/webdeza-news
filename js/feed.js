const FEED_INDEX_LIMIT = 30;
const INDEX_ITEMS_PER_FEED = 3;
const CATEGORY_ITEMS_PER_FEED = 5;
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

  try {
    const response = await fetch(
      `${PROXY_ENDPOINT}?url=${encodeURIComponent(feed.rssUrl)}`,
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

const createCard = (item) => {
  const card = document.createElement("article");
  card.className = "card";
  card.style.setProperty("--card-accent", item.feed.accentColor || "#00ff99");

  const header = document.createElement("div");
  header.className = "card-header";

  const siteLabel = document.createElement("span");
  siteLabel.className = "site-label";
  siteLabel.textContent = item.feed.name;

  const siteBadge = document.createElement("a");
  siteBadge.className = "site-badge";
  siteBadge.href = item.feed.siteUrl;
  siteBadge.target = "_blank";
  siteBadge.rel = "noopener noreferrer";
  siteBadge.textContent = "SOURCE";

  header.appendChild(siteLabel);
  header.appendChild(siteBadge);

  const titleLink = document.createElement("a");
  titleLink.className = "card-title";
  titleLink.href = item.link;
  titleLink.target = "_blank";
  titleLink.rel = "noopener noreferrer";
  titleLink.textContent = item.title;

  const description = document.createElement("p");
  description.className = "card-description";
  description.textContent =
    item.description || "概要の取得に失敗しました。リンク先で詳細を確認してください。";

  const footer = document.createElement("div");
  footer.className = "card-footer";

  const timeEl = document.createElement("time");
  if (item.isoDate) timeEl.dateTime = item.isoDate;
  timeEl.textContent = formatDate(item.pubDate);

  const categoryEl = document.createElement("span");
  categoryEl.className = "card-category";
  categoryEl.textContent = `# ${item.feed.category}`;

  footer.appendChild(timeEl);
  footer.appendChild(categoryEl);

  card.appendChild(header);
  card.appendChild(titleLink);
  card.appendChild(description);
  card.appendChild(footer);

  return card;
};

const createErrorCard = (feed, message) => {
  const card = document.createElement("article");
  card.className = "card card--error";
  card.style.setProperty("--card-accent", feed.accentColor || "#ff6b6b");

  const header = document.createElement("div");
  header.className = "card-header";

  const siteLabel = document.createElement("span");
  siteLabel.className = "site-label";
  siteLabel.textContent = feed.name;

  const badge = document.createElement("span");
  badge.className = "site-badge";
  badge.textContent = "FAILED";

  header.appendChild(siteLabel);
  header.appendChild(badge);

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = "RSSの取得に失敗しました";

  const description = document.createElement("p");
  description.className = "card-description";
  description.textContent = message || "フィードを読み込めませんでした。";

  const footer = document.createElement("div");
  footer.className = "card-footer";

  const categoryEl = document.createElement("span");
  categoryEl.className = "card-category";
  categoryEl.textContent = `# ${feed.category}`;

  footer.appendChild(categoryEl);

  card.appendChild(header);
  card.appendChild(title);
  card.appendChild(description);
  card.appendChild(footer);

  return card;
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

const insertInlineAd = (container, slotName, position = 6) => {
  if (!container || container.children.length === 0) return;
  if (container.querySelector(`.ad-slot[data-slot="${slotName}"]`)) return;

  const ad = document.createElement("div");
  ad.className = "ad-slot ad-slot--inline";
  ad.dataset.slot = slotName;

  if (typeof window.__applyAdCopy === "function") {
    window.__applyAdCopy(ad);
  } else {
    ad.textContent = `ここに ${slotName} 広告を配置`;
  }

  const reference = container.children[position] || null;
  container.insertBefore(ad, reference);
};

const renderIndexFeeds = async (container, feeds) => {
  container.innerHTML = '<p class="loading">最新記事を読み込み中...</p>';

  const settled = await Promise.allSettled(
    feeds.map((feed) => fetchRssItems(feed, INDEX_ITEMS_PER_FEED))
  );

  const successfulItems = [];
  const errorCards = [];

  settled.forEach((result, index) => {
    const feed = feeds[index];
    if (result.status === "fulfilled") {
      const { items, error } = result.value;
      if (items.length) {
        successfulItems.push(...items);
      } else {
        errorCards.push(createErrorCard(feed, error || "RSSが空でした"));
      }
    } else {
      errorCards.push(createErrorCard(feed, "RSS取得で不明なエラーが発生しました"));
    }
  });

  const sorted = successfulItems
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, FEED_INDEX_LIMIT);

  if (!sorted.length && !errorCards.length) {
    showEmptyState(container, "現在表示できる記事がありません。");
    updateStructuredData([]);
    return;
  }

  container.innerHTML = "";
  const fragment = document.createDocumentFragment();
  sorted.forEach((item) => fragment.appendChild(createCard(item)));
  errorCards.forEach((card) => fragment.appendChild(card));
  container.appendChild(fragment);

  insertInlineAd(container, "inline-index", 6);
  updateStructuredData(sorted);
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
    targetFeeds.map((feed) => fetchRssItems(feed, CATEGORY_ITEMS_PER_FEED))
  );

  const successfulItems = [];
  const errorCards = [];

  settled.forEach((result, index) => {
    const feed = targetFeeds[index];
    if (result.status === "fulfilled") {
      const { items, error } = result.value;
      if (items.length) {
        successfulItems.push(...items);
      } else {
        errorCards.push(createErrorCard(feed, error || "RSSが空でした"));
      }
    } else {
      errorCards.push(createErrorCard(feed, "RSS取得で不明なエラーが発生しました"));
    }
  });

  const sorted = successfulItems.sort((a, b) => b.timestamp - a.timestamp);

  if (!sorted.length && !errorCards.length) {
    showEmptyState(
      container,
      `${getReadableCategory(categorySlug)} カテゴリのRSSを取得できませんでした。`
    );
    updateStructuredData([]);
    return;
  }

  container.innerHTML = "";
  const fragment = document.createDocumentFragment();
  sorted.forEach((item) => fragment.appendChild(createCard(item)));
  errorCards.forEach((card) => fragment.appendChild(card));
  container.appendChild(fragment);

  insertInlineAd(container, `inline-${categorySlug}`, 4);
  updateStructuredData(sorted);
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
