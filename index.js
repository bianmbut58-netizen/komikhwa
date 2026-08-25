/**
 * Komikhwa Scraper API — format response JSON ala API Sanka (versi Komikindo)
 *
 * Endpoint (sama persis path-nya dengan API Sanka versi komikindo):
 *   GET /comic/komikindo/latest/:page          -> komik terbaru
 *   GET /comic/komikindo/detail/:slug          -> detail + daftar chapter
 *   GET /comic/komikindo/chapter/:slug         -> gambar chapter
 *   GET /comic/komikindo/library?page=1        -> library (+ filter genre, type, search)
 *   GET /comic/komikindo/genres                -> daftar genre
 *   GET /comic/komikindo/search/:query/:page   -> cari komik
 *
 * Jalankan: npm install && npm start
 */

const express = require("express");
const scraper = require("./scraper");

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// wrapper agar error selalu berbentuk JSON ala Sanka
function handler(fn) {
  return async (req, res) => {
    try {
      const result = await fn(req);
      res.json(result);
    } catch (err) {
      const status = err.statusCode || err.response?.status || 500;
      res.status(status === 404 ? 404 : 500).json({
        creator: scraper.CREATOR,
        success: false,
        message: err.message || "Error fetching komik from Komikhwa",
      });
    }
  };
}

// ---------- routes ----------

const P = "/comic/komikindo";

// 1. Komik terbaru — /comic/komikindo/latest/1
app.get(
  `${P}/latest/:page`,
  handler((req) => scraper.getLatest(req.params.page))
);

// 2. Detail komik — /comic/komikindo/detail/my-avatar-is-becoming-the-final-boss-remake
app.get(
  `${P}/detail/:slug`,
  handler((req) => scraper.getDetail(req.params.slug))
);

// 3. Baca chapter — /comic/komikindo/chapter/my-avatar-is-becoming-the-final-boss-remake-chapter-0
app.get(
  `${P}/chapter/:slug`,
  handler((req) => scraper.getChapter(req.params.slug))
);

// 4. Library — /comic/komikindo/library?page=1&genre=action,drama&order=latest&type=manhwa
app.get(
  `${P}/library`,
  handler((req) =>
    scraper.getLibrary({
      page: req.query.page || 1,
      genre: req.query.genre || "",
      order: req.query.order || req.query.sort || "",
      type: req.query.type || "",
    })
  )
);

// 5. Daftar genre — /comic/komikindo/genres
app.get(`${P}/genres`, handler(() => scraper.getGenres()));

// 6. Cari komik — /comic/komikindo/search/naruto/1
app.get(
  `${P}/search/:query/:page`,
  handler((req) => scraper.searchComic(req.query.q || req.params.query, req.params.page))
);

// docs sederhana di root
app.get("/", (_req, res) => {
  res.json({
    creator: scraper.CREATOR,
    success: true,
    message: "Komikhwa Scraper API — format response PERSIS API Sanka (Komikindo)",
    endpoints: {
      latest: `${P}/latest/:page            contoh: ${P}/latest/1`,
      detail: `${P}/detail/:slug            contoh: ${P}/detail/my-avatar-is-becoming-the-final-boss-remake`,
      chapter: `${P}/chapter/:slug          contoh: ${P}/chapter/my-avatar-is-becoming-the-final-boss-remake-chapter-0`,
      library: `${P}/library?page=1         filter opsional: &genre=action,drama&order=latest&type=manhwa`,
      genres: `${P}/genres`,
      search: `${P}/search/:query/:page     contoh: ${P}/search/princess/1`,
    },
    source: scraper.BASE_URL,
  });
});

app.listen(PORT, () => {
  console.log(`✅ Komikhwa Scraper API jalan di http://localhost:${PORT}`);
});
