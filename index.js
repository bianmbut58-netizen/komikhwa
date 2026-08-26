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
      res.status(status).json({
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

// halaman docs: UI/UX persis repo PainMods/fmcapi (navbar + card + footer, Inter font)
app.get("/docs", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Komikhwa Scraper API - Documentation</title>
  <meta name="title" content="Komikhwa Scraper API - Documentation" />
  <meta name="description" content="API scraper komikhwa.com dengan format response ala API Sanka (versi Komikindo). Gratis dan open source." />
  <meta property="og:title" content="Komikhwa Scraper API - Documentation" />
  <meta property="og:description" content="API scraper komikhwa.com dengan format response ala API Sanka (versi Komikindo)." />
  <meta property="og:type" content="website" />
  <link rel="stylesheet" href="/swagger-ui/swagger-ui.css" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    /* ===== layout ala fmcapi (globals.css) ===== */
    :root { --bg:#0d0c22; --text:white; --btn:#3673fd; }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Inter', sans-serif;
    }
    a { text-decoration:none; color:inherit; }
    .container {
      max-width:1280px;
      margin:auto;
      padding-left:20px;
      padding-right:20px;
      min-height:100vh;
      display:flex;
      flex-direction:column;
      justify-content:space-between;
    }

    /* ===== navbar ala fmcapi (navbar.module.css) ===== */
    .navbar {
      height:100px;
      display:flex;
      align-items:center;
      justify-content:space-between;
    }
    .navbar .logo { font-size:30px; font-weight:bold; color:#fff; }
    .navbar .links a {
      margin-left:24px; font-size:14px; color:#e5e5e5; font-weight:600;
      transition:color .2s ease-in-out;
    }
    .navbar .links a:hover { color:var(--btn); }
    @media (max-width:768px){
      .navbar { flex-direction:column; justify-content:center; gap:10px; height:auto; padding:16px 0; }
    }

    /* ===== konten: kartu putih ala docs/page.jsx ===== */
    main { padding:24px 0; flex:1; }
    .card {
      background-color:#ffffff;
      box-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1);
      border-radius:8px;
      padding:16px;
      overflow:hidden;
    }

    /* ===== footer ala fmcapi (footer.module.css) ===== */
    .footer {
      height:100px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      color:gray;
    }
    .footer .logo { font-weight:bold; color:#fff; }
    .footer .text { font-size:12px; }
    @media (max-width:768px){
      .footer { flex-direction:column; justify-content:center; gap:8px; height:auto; padding:16px 0; }
    }

    /* ===== styling swagger ala docs/page.jsx (injected style fmcapi) ===== */
    .swagger-ui .info { text-align:center; margin-bottom:20px; }
    .swagger-ui .info h1 { font-size:26px; font-weight:bold; color:#222; }
    .swagger-ui .info p { font-size:14px; color:#555; }
    .swagger-ui .info a { color:#007bff; font-weight:bold; text-decoration:none; }
    .swagger-ui .opblock {
      border-radius:8px;
      border:1px solid #ddd;
      margin-bottom:10px;
      transition:all .3s ease-in-out;
    }
    .swagger-ui .opblock:hover { box-shadow:0 4px 8px rgba(0,0,0,.1); }
    .swagger-ui .opblock-tag {
      font-size:18px; font-weight:bold; color:#333;
      margin-bottom:5px; padding-left:10px;
    }
    .swagger-ui .opblock-summary {
      display:flex; align-items:center; padding:10px;
      border-radius:5px; font-weight:bold;
    }
    .swagger-ui .opblock-summary-method {
      border-radius:5px; font-size:14px; font-weight:bold;
      padding:6px 12px; min-width:60px; text-align:center;
    }
    .swagger-ui .opblock-get .opblock-summary-method,
    .swagger-ui .opblock-summary-method-get { background-color:#007bff !important; color:#fff !important; }
    .swagger-ui .opblock-post .opblock-summary-method,
    .swagger-ui .opblock-summary-method-post { background-color:#28a745 !important; color:#fff !important; }
    .swagger-ui .opblock-summary-path { font-size:14px; color:#222; }
    .swagger-ui .scheme-container { box-shadow:none; background:#fafafa; border-radius:8px; }
    .swagger-ui .btn.execute { background-color:#3673fd; border-color:#3673fd; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Navbar -->
    <nav class="navbar">
      <a href="/docs" class="logo">Komikhwa<span style="color:#3673fd">Api</span></a>
      <div class="links">
        <a href="/docs">Docs</a>
        <a href="/swagger.json">swagger.json</a>
        <a href="https://github.com/bianmbut58-netizen/komikhwa" target="_blank" rel="noopener">GitHub</a>
      </div>
    </nav>

    <!-- Konten: Swagger UI dalam kartu putih -->
    <main>
      <div class="card">
        <div id="swagger-ui"></div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="footer">
      <div class="logo">Komikhwa</div>
      <div class="text">Komikhwa Scraper API &copy; All rights reserved ${new Date().getFullYear()}.</div>
    </footer>
  </div>

  <script src="/swagger-ui/swagger-ui-bundle.js"></script>
  <script>
    // konfigurasi sama seperti fmcapi docs/page.jsx
    SwaggerUIBundle({
      url: "/swagger.json",
      dom_id: "#swagger-ui",
      deepLinking: true,
      docExpansion: "none",
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
