/**
 * Scraper komikhwa.com -> format response JSON PERSIS API Sanka (versi Komikindo)
 * Struktur respons dicocokkan dengan contoh asli dari https://www.sankavollerei.web.id
 *
 * Sumber struktur HTML komikhwa:
 *  - Latest  : https://komikhwa.com/manga/?sort=latest&hal={page}
 *  - Detail  : https://komikhwa.com/manga/{slug}/
 *  - Chapter : https://komikhwa.com/{chapter-slug}/
 *  - Library : https://komikhwa.com/manga/ (+ filter genre/type/hal)
 *  - Genres  : dropdown genre di halaman /manga/
 *  - Search  : https://komikhwa.com/?s={query}
 *  - Populer : slider "Manhwa Rekomendasi" di halaman depan
 */

const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://komikhwa.com";
const CREATOR = "Sanka Vollerei"; // biar konsisten dengan envelope API Sanka

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
  Referer: BASE_URL,
};

// ---------- helpers ----------

async function fetchHtml(url) {
  const res = await axios.get(url, {
    headers: HEADERS,
    timeout: 30000,
    maxRedirects: 5,
    validateStatus: null,
  });
  if (res.status >= 400) {
    const err = new Error(`Error fetching komik from Komikhwa`);
    err.statusCode = res.status === 404 ? 404 : 502;
    throw err;
  }
  return res.data;
}

function cleanText(str) {
  return (str || "").replace(/\s+/g, " ").trim();
}

/** ambil slug dari URL, mis. https://komikhwa.com/manga/one-piece/ -> one-piece */
function slugFromUrl(url) {
  if (!url) return "";
  return url
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/\/$/, "")
    .split("/")
    .pop();
}

function parseRating(text) {
  const m = cleanText(text).match(/([\d.]+)/);
  return m ? m[1] : null; // Sanka mengembalikan rating sebagai string
}

function parseDateIndo(str) {
  // "25 Agu 2026" -> "2026-08-25"
  const bulan = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", Mei: "05", Jun: "06",
    Jul: "07", Agu: "08", Sep: "09", Okt: "10", Nov: "11", Des: "12",
  };
  const m = cleanText(str).match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (!m) return null;
  const mm = bulan[m[2]];
  return mm ? `${m[3]}-${mm}-${String(m[1]).padStart(2, "0")}` : null;
}

/** ubah tanggal ISO menjadi relatif ala Sanka: "9 menit yang lalu" */
function relativeTime(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays <= 0) return "hari ini";
  if (diffDays === 1) return "1 hari yang lalu";
  if (diffDays < 7) return `${diffDays} hari yang lalu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu yang lalu`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} bulan yang lalu`;
  return `${Math.floor(diffDays / 365)} tahun yang lalu`;
}

/** id WP dari body class, mis. "postid-23329" */
function parsePostId($) {
  const m = cleanText($("body").attr("class") || "").match(/postid-(\d+)/);
  return m ? m[1] : null;
}

function ok(payload) {
  return { creator: CREATOR, success: true, ...payload };
}

// ---------- parse kartu komik ----------

/**
 * Kartu komik di halaman /manga/ & pencarian (.content-card.manga-item).
 * Bentuk output mengikuti komikList Sanka (library / search):
 *   { title, rating, slug, image, type, color }
 */
function parseMangaCard($, el) {
  const $el = $(el);
  const url = $el.find(".manga-info-title a").first().attr("href") || "";
  if (!url) return null;
  return {
    title: cleanText($el.find(".manga-info-title a").first().text()),
    rating: parseRating($el.find(".rating-badge").first().text()),
    slug: slugFromUrl(url),
    image:
      $el.find(".manga-thumb img").attr("src") ||
      $el.find(".manga-thumb img").attr("data-src") ||
      null,
    type: null, // tipe (Manga/Manhwa/Manhua) tidak tampil di kartu komikhwa
    color: null, // Hitam/Warna tidak tersedia di komikhwa
  };
}

function parseMangaGrid($) {
  const list = [];
  $(".content-card.manga-item").each((_, el) => {
    const item = parseMangaCard($, el);
    if (item) list.push(item);
  });
  return list;
}

/** paginasi ala Sanka: { currentPage, totalPages, hasNextPage, nextPage } */
function parsePagination($, perPage = 20) {
  const info = cleanText($(".pagination-info").first().text());
  const mTotal = info.match(/dari\s+([\d.,]+)\s*/);
  const total = mTotal ? parseInt(mTotal[1].replace(/[.,]/g, ""), 10) : null;

  const $next = $("li.pagination-next");
  const hasNextPage =
    $next.length > 0 && !$next.hasClass("disabled") && $next.find("a").length > 0;

  let currentPage = 1;
  const cur = cleanText($("li.pagination-current").first().text());
  const mCur = cur.match(/^\d+/);
  if (mCur) currentPage = parseInt(mCur[0], 10);

  const totalPages = total ? Math.ceil(total / perPage) : null;
  return {
    currentPage,
    totalPages,
    hasNextPage,
    nextPage: hasNextPage ? currentPage + 1 : null,
  };
}

/** slider "Manhwa Rekomendasi" di homepage -> komikPopuler Sanka */
function parsePopularSlider($) {
  const list = [];
  $(".recommend-card, .slider-item.recommend-card").each((i, el) => {
    const $el = $(el);
    const url = $el.find("a").first().attr("href") || "";
    if (!url) return;
    list.push({
      rank: String(i + 1),
      title: cleanText($el.find(".slider-title, .recommend-title").first().text()) || slugFromUrl(url),
      slug: slugFromUrl(url),
      author: null, // tidak tersedia di slider komikhwa
      rating: parseRating($el.find(".rating-badge").first().text()),
      image:
        $el.find("img").first().attr("src") ||
        $el.find("img").first().attr("data-src") ||
        null,
    });
  });
  return list.slice(0, 10); // Sanka menampilkan 10 besar
}

// ---------- endpoints (struktur PERSIS API Sanka) ----------

/** 1. Komik terbaru -> /comic/komikindo/latest/{page} */
async function getLatest(page = 1) {
  const html = await fetchHtml(`${BASE_URL}/manga/?sort=latest&hal=${page}`);
  const $ = cheerio.load(html);

  const komikList = [];
  $(".content-card.manga-item").each((_, el) => {
    const $el = $(el);
    const url = $el.find(".manga-info-title a").first().attr("href") || "";
    if (!url) return;

    // chapter terbaru saja (Sanka menampilkan 1 chapter per komik)
    const $firstCh = $el.find(".manga-chapters li").first();
    const chUrl = $firstCh.find("a").first().attr("href") || "";
    const chapters = chUrl
      ? [
          {
            title: cleanText($firstCh.find(".ch-name").text()),
            slug: slugFromUrl(chUrl),
            date: parseDateIndo($firstCh.find(".ch-date").text()) || null,
          },
        ]
      : [];

    komikList.push({
      title: cleanText($el.find(".manga-info-title a").first().text()),
      slug: slugFromUrl(url),
      image:
        $el.find(".manga-thumb img").attr("src") ||
        $el.find(".manga-thumb img").attr("data-src") ||
        null,
      type: null,
      color: null,
      chapters,
    });
  });

  return ok({
    pagination: parsePagination($),
    komikList,
  });
}

/** 2. Detail komik -> /comic/komikindo/detail/{slug} */
async function getDetail(slug) {
  const html = await fetchHtml(`${BASE_URL}/manga/${encodeURIComponent(slug)}/`);
  const $ = cheerio.load(html);

  const title = cleanText($(".manga-header-info h1").first().text());
  if (!title) {
    const err = new Error(`Error fetching komik detail from Komikhwa`);
    err.statusCode = 404;
    throw err;
  }

  // meta items: <span class="meta-label">Tipe:</span> Manhua
  const meta = {};
  $(".manga-meta-item").each((_, el) => {
    const label = cleanText($(el).find(".meta-label").first().text()).replace(/:$/, "");
    const value = cleanText($(el).clone().children().remove().end().text());
    if (label) meta[label.toLowerCase()] = value || null;
  });

  // daftar chapter dari halaman detail (hanya 20 terbaru yang dirender tema)
  const chapters = [];
  const dateMap = {}; // slug -> tanggal
  $("#chapter-list li, ul.chapter-list li").each((_, li) => {
    const $li = $(li);
    const url = $li.find("a").first().attr("href") || "";
    if (!url) return;
    const name = cleanText(
      $li.find("a").first().clone().children(".chapter-date").remove().end().text()
    );
    const slug = slugFromUrl(url);
    const iso = parseDateIndo($li.find(".chapter-date").text());
    dateMap[slug] = iso;
    chapters.push({
      title: name,
      slug,
      releaseTime: relativeTime(iso),
    });
  });

  // lengkapi daftar chapter dari dropdown chapter di halaman baca
  // (tema hanya me-render 20 chapter terbaru di halaman detail)
  if (chapters.length) {
    try {
      const chHtml = await fetchHtml(
        `${BASE_URL}/${encodeURIComponent(chapters[0].slug)}/`
      );
      const $c = cheerio.load(chHtml);
      const fullList = [];
      $c("#chapter-bottom option, #chapter-top option").each((_, opt) => {
        const val = $c(opt).attr("value") || "";
        if (!val) return;
        const slug = slugFromUrl(val);
        const optTitle = cleanText($c(opt).text());
        const title = optTitle.replace(/^.*?\sChapter\s/i, "Chapter ");
        fullList.push({
          title: title === optTitle ? cleanText(optTitle.split("Chapter").pop()).trim() || "Chapter" : title,
          slug,
          releaseTime: dateMap[slug] ? relativeTime(dateMap[slug]) : null,
        });
      });
      // fallback bila dropdown tidak ketemu: pakai daftar dari halaman detail
      if (fullList.length) chapters.length = 0, chapters.push(...fullList);
    } catch (_e) {
      // biarkan daftar dari halaman detail
    }
  }

  const firstChapter = chapters.length
    ? { title: chapters[chapters.length - 1].title, slug: chapters[chapters.length - 1].slug }
    : null;
  const latestChapter = chapters.length
    ? { title: chapters[0].title, slug: chapters[0].slug }
    : null;

  return ok({
    data: {
      id: parsePostId($) || $(".mrlite-bookmark-btn").attr("data-manga-id") || null,
      title,
      image: $(".manga-header-thumb img").attr("src") || null,
      rating: parseRating($(".rating-value").first().text()),
      votes: null, // jumlah vote tidak tersedia di komikhwa
      detail: {
        alternativeTitle: cleanText($(".manga-alt-names").first().text()).replace(
          /^Nama\s*Alternatif\s*:\s*/i,
          ""
        ) || null,
        status: cleanText($(".manga-status-tag").first().text()) || null,
        author: meta["author"] || null,
        illustrator: meta["artist"] || null,
        type: cleanText($(".manga-type-tag").first().text()) || meta["tipe"] || null,
        theme: null, // tema tidak tersedia di komikhwa
      },
      genres: $(".genre-tag")
        .map((_, el) => ({
          name: cleanText($(el).text()),
          slug: `/genres/${cleanText($(el).text()).toLowerCase().replace(/\s+/g, "-")}`,
        }))
        .get()
        .filter((g) => g.name),
      description: cleanText($(".manga-desc.synopsis-content").first().text()) || null,
      firstChapter,
      latestChapter,
      chapters,
    },
  });
}

/** 3. Baca chapter -> /comic/komikindo/chapter/{slug} */
async function getChapter(chapterSlug) {
  const html = await fetchHtml(`${BASE_URL}/${encodeURIComponent(chapterSlug)}/`);
  const $ = cheerio.load(html);

  const title = cleanText($("h1").first().text());
  if (!title || $("#readerarea").length === 0) {
    const err = new Error(`Error fetching komik chapter from Komikhwa`);
    err.statusCode = 404;
    throw err;
  }

  const mangaLink =
    $(".reader-breadcrumb a[href*='/manga/']").first().attr("href") || "";
  const mangaTitle = cleanText(
    $(".reader-breadcrumb a[href*='/manga/']").first().text()
  );

  const images = [];
  $("#readerarea img").each((_, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("data-lazy-src");
    if (src) images.push(src.trim());
  });

  // navigasi prev/next dari dropdown daftar chapter
  const options = [];
  $(
    "#chapter-bottom option, #chapter-top option, select.selector option"
  ).each((_, opt) => {
    const val = $(opt).attr("value");
    if (val) options.push(val);
  });
  const idx = options.findIndex(
    (u) => u.includes(encodeURIComponent(chapterSlug)) || u.includes(chapterSlug)
  );
  const prev = idx !== -1 && options[idx + 1] ? slugFromUrl(options[idx + 1]) : null;
  const next = idx > 0 ? slugFromUrl(options[idx - 1]) : null;

  // ambil cover + sinopsis + daftar chapter dari halaman detail manga (fallback aman)
  let komikInfo = { title: mangaTitle, description: null, chapters: [] };
  let thumbnail = null;
  try {
    const detailHtml = await fetchHtml(
      `${BASE_URL}/manga/${encodeURIComponent(slugFromUrl(mangaLink))}/`
    );
    const $d = cheerio.load(detailHtml);
    thumbnail = {
      url: $d(".manga-header-thumb img").attr("src") || null,
      title: cleanText($d(".manga-header-info h1").first().text()) || mangaTitle,
    };
    komikInfo = {
      title: thumbnail.title,
      description: cleanText($d(".manga-desc.synopsis-content").first().text()) || null,
      chapters: [],
    };
    $d("#chapter-list li, ul.chapter-list li").each((_, li) => {
      const url = $d(li).find("a").first().attr("href") || "";
      if (!url) return;
      komikInfo.chapters.push({
        title: cleanText($d(li).find("a").first().clone().children(".chapter-date").remove().end().text()),
        slug: slugFromUrl(url),
      });
    });
  } catch (_e) {
    // biarkan komikInfo apa adanya bila halaman detail gagal diambil
  }

  return ok({
    data: {
      id: parsePostId($) || null,
      title,
      navigation: { prev, next },
      allChapterSlug: slugFromUrl(mangaLink) || null,
      images,
      thumbnail,
      komikInfo,
    },
  });
}

/** 4. Library / daftar komik -> /comic/komikindo/library?page=1&genre=... */
async function getLibrary({ page = 1, genre = "", order = "", type = "" } = {}) {
  const params = new URLSearchParams();
  params.set("sort", order || "latest"); // latest | popular | rating (jika tersedia)
  if (genre)
    String(genre)
      .split(",")
      .forEach((g) => params.append("genre[]", g.trim()));
  if (type) params.set("type", type);
  params.set("hal", String(page));

  const html = await fetchHtml(`${BASE_URL}/manga/?${params.toString()}`);
  const $ = cheerio.load(html);

  // komikPopuler diambil dari slider homepage (sekali fetch tambahan)
  let komikPopuler = [];
  try {
    const homeHtml = await fetchHtml(BASE_URL);
    komikPopuler = parsePopularSlider(cheerio.load(homeHtml));
  } catch (_e) {
    komikPopuler = [];
  }

  return ok({
    pagination: parsePagination($),
    filters: { genre: genre ? String(genre).split(",").map((g) => g.trim()) : null },
    komikList: parseMangaGrid($),
    komikPopuler,
  });
}

/** 5. Daftar genre -> /comic/komikindo/genres */
async function getGenres() {
  const html = await fetchHtml(`${BASE_URL}/manga/`);
  const $ = cheerio.load(html);

  const genres = [];
  $('input[name="genre[]"]').each((_, el) => {
    const value = $(el).attr("value") || "";
    const name = cleanText($(el).parent().text());
    if (value) genres.push({ name: name || value, value });
  });

  return ok({ genres });
}

/** 6. Cari komik -> /comic/komikindo/search/{query}/{page} */
async function searchComic(query, page = 1) {
  // buang tanda kutip luar, mis. '"princess"' -> 'princess'
  const rawQuery = String(query || "").replace(/^"|"$/g, "").trim();
  const q = encodeURIComponent(rawQuery);
  const url =
    Number(page) > 1 ? `${BASE_URL}/page/${page}/?s=${q}` : `${BASE_URL}/?s=${q}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  // komikhwa membungkus kata kunci dengan kutip di <strong>"princess"</strong>
  const siteQuery = cleanText($(".search-term-info strong").first().text()).replace(
    /^"|"$/g,
    ""
  );
  const results = parseMangaGrid($);
  const hasNextPage = results.length >= 20;

  return ok({
    query: rawQuery || siteQuery,
    pagination: {
      currentPage: Number(page) || 1,
      hasNextPage,
      nextPage: hasNextPage ? Number(page) + 1 : null,
    },
    komikList: results,
  });
}

module.exports = {
  BASE_URL,
  CREATOR,
  getLatest,
  getDetail,
  getChapter,
  getLibrary,
  getGenres,
  searchComic,
};
