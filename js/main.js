const CATEGORY_LABELS = {
  design: "Design",
  dev: "Dev",
  news: "News",
  life: "Life"
};

const CATEGORY_DESCRIPTIONS = {
  design: "Designに関する最新のWebデザイン・フロントエンド記事を一覧で紹介します。",
  dev: "Devに関する最新のWebデザイン・フロントエンド記事を一覧で紹介します。",
  news: "Newsに関する最新のWebデザイン・フロントエンド記事を一覧で紹介します。",
  life: "Lifeに関する最新のWebデザイン・フロントエンド記事を一覧で紹介します。"
};

const DEFAULT_CATEGORY = "design";

const getCategoryParam = () => {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("category");
  return slug ? slug.toLowerCase() : null;
};

window.__getCategoryParam = getCategoryParam;

window.__getReadableCategory = (slug) =>
  CATEGORY_LABELS[slug?.toLowerCase()] || "All";

const applyAdCopy = (slotEl) => {
  if (!slotEl || slotEl.dataset.hydrated === "true") return;
  const slotName = slotEl.dataset.slot || "共通";
  slotEl.textContent = `ここに ${slotName} 広告を配置`;
  slotEl.dataset.hydrated = "true";
};

window.__applyAdCopy = applyAdCopy;

const hydrateAdSlots = () => {
  document.querySelectorAll(".ad-slot").forEach(applyAdCopy);
};

window.__hydrateAds = hydrateAdSlots;

const resolveActiveNavKey = () => {
  const path = window.location.pathname.toLowerCase();
  if (path.endsWith("about.html")) return "about";
  if (path.endsWith("category.html")) return getCategoryParam() || DEFAULT_CATEGORY;
  return "top";
};

const setActiveNav = () => {
  const activeKey = resolveActiveNavKey();
  document.querySelectorAll(".site-nav a").forEach((link) => {
    const linkKey = link.dataset.nav;
    link.classList.toggle("is-active", linkKey === activeKey);
  });
};

const updateCategoryHeader = () => {
  if (!window.location.pathname.toLowerCase().endsWith("category.html")) return;

  const slug = getCategoryParam() || DEFAULT_CATEGORY;
  const label = CATEGORY_LABELS[slug] || "All";
  const titleEl = document.getElementById("category-title");
  const descEl = document.getElementById("category-description");

  if (titleEl) {
    titleEl.textContent = `${label} の最新記事`;
  }

  if (descEl) {
    descEl.textContent =
      CATEGORY_DESCRIPTIONS[slug] ||
      "全カテゴリの最新記事をまとめています。";
  }

  const descriptionMeta = document.querySelector('meta[name="description"]');
  if (descriptionMeta) {
    descriptionMeta.setAttribute(
      "content",
      `${label}に関する最新のWebデザイン・フロントエンド記事を一覧で紹介します。`
    );
  }

  document.title = `${label}の最新記事｜webデザニュース`;
};

document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  updateCategoryHeader();
  hydrateAdSlots();
});
