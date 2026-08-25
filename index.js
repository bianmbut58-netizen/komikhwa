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
const path = require("path");
const swaggerUiDist = require("swagger-ui-dist").getAbsoluteFSPath();
const scraper = require("./scraper");

const app = express();
const PORT = process.env.PORT || 3000;

// pretty print JSON ala API Sanka (indent 2 spasi)
app.set("json spaces", 2);

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

// ===== Web UI test (Swagger UI ala fmcapi) =====

// aset swagger-ui (css/js) dari swagger-ui-dist
app.use("/swagger-ui", express.static(swaggerUiDist));

// spec OpenAPI
app.get("/swagger.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.sendFile(path.join(__dirname, "swagger.json"));
});

// halaman docs: test endpoint langsung dari browser
app.get("/docs", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Komikhwa Scraper API — Docs</title>
  <link rel="stylesheet" href="/swagger-ui/swagger-ui.css" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    body { background-color: #ffffff !important; font-family: 'Inter', sans-serif; margin: 0; }
    .swagger-ui .info { text-align: center; margin-bottom: 20px; }
    .swagger-ui .info h1 { font-size: 26px; font-weight: bold; color: #222; }
    .swagger-ui .info p { font-size: 14px; color: #555; }
    .swagger-ui .info a { color: #007bff; font-weight: bold; text-decoration: none; }
    .swagger-ui .opblock { border-radius: 8px; border: 1px solid #ddd; margin-bottom: 10px; transition: all 0.3s ease-in-out; }
    .swagger-ui .opblock:hover { box-shadow: 0px 4px 8px rgba(0,0,0,0.1); }
    .swagger-ui .opblock-tag { font-size: 18px; font-weight: bold; color: #333; }
    .swagger-ui .opblock-summary-method { border-radius: 5px; font-size: 14px; font-weight: bold; }
    .swagger-ui .btn.execute { background: #007bff; border-color: #007bff; }
    .swagger-ui .scheme-container { box-shadow: none; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/swagger-ui/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/swagger.json",
      dom_id: "#swagger-ui",
      deepLinking: true,
      docExpansion: "list",
      defaultModelRendering: "model",
      persistAuthorization: true,
    });
  </script>
</body>
</html>`);
});

// root -> langsung ke docs biar gampang test
app.get("/", (_req, res) => res.redirect("/docs"));

// Railway / lokal: jalankan server langsung
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Komikhwa Scraper API jalan di http://localhost:${PORT}`);
  });
}

// Vercel (serverless): export app sebagai module
module.exports = app;
