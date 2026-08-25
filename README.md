# Komikhwa Scraper API (format respons PERSIS API Sanka — versi Komikindo)

Scraper Node.js untuk `https://komikhwa.com`. Path endpoint **sama persis** dengan API Sanka versi Komikindo (`sankavollerei.web.id`), dan struktur respons JSON-nya juga **disamakan persis** dengan contoh asli dari Sanka.

## Install & Jalankan

```bash
npm install
npm start        # server di http://localhost:3000
```

## Endpoint

| # | Endpoint | Contoh |
|---|----------|--------|
| 1 | `GET /comic/komikindo/latest/:page` | `/comic/komikindo/latest/1` |
| 2 | `GET /comic/komikindo/detail/:slug` | `/comic/komikindo/detail/my-avatar-is-becoming-the-final-boss-remake` |
| 3 | `GET /comic/komikindo/chapter/:slug` | `/comic/komikindo/chapter/my-avatar-is-becoming-the-final-boss-remake-chapter-0` |
| 4 | `GET /comic/komikindo/library?page=1` | filter opsional: `&genre=action,drama&order=latest&type=manhwa` |
| 5 | `GET /comic/komikindo/genres` | — |
| 6 | `GET /comic/komikindo/search/:query/:page` | `/comic/komikindo/search/princess/1` |

## Struktur respons (dicocokkan dengan Sanka asli)

Semua respons diawali envelope `{ "creator": "Sanka Vollerei", "success": true, ... }`.

**latest & library** — `komikList` (library juga punya `komikPopuler` dari slider "Manhwa Rekomendasi"):
```json
{
  "creator": "Sanka Vollerei",
  "success": true,
  "pagination": { "currentPage": 1, "totalPages": 13, "hasNextPage": true, "nextPage": 2 },
  "komikList": [
    {
      "title": "My Very Own Tower Strategy Guide",
      "slug": "my-very-own-tower-strategy-guide",
      "image": "https://...jpg",
      "type": null,
      "color": null,
      "chapters": [ { "title": "Chapter 133", "slug": "...-chapter-133", "date": "2026-08-25" } ]
    }
  ]
}
```

**detail**:
```json
{
  "creator": "Sanka Vollerei",
  "success": true,
  "data": {
    "id": "23329",
    "title": "...", "image": "...", "rating": "5", "votes": null,
    "detail": { "alternativeTitle": "...", "status": "Ongoing", "author": "...", "illustrator": "...", "type": "Manhua", "theme": null },
    "genres": [ { "name": "Action", "slug": "/genres/action" } ],
    "description": "...",
    "firstChapter": { "title": "Chapter 0", "slug": "..." },
    "latestChapter": { "title": "Chapter 38", "slug": "..." },
    "chapters": [ { "title": "Chapter 38", "slug": "...", "releaseTime": "4 hari yang lalu" } ]
  }
}
```

**chapter**:
```json
{
  "creator": "Sanka Vollerei",
  "success": true,
  "data": {
    "id": "23331",
    "title": "...", 
    "navigation": { "prev": null, "next": "...-chapter-1" },
    "allChapterSlug": "my-avatar-is-becoming-the-final-boss-remake",
    "images": [ "https://..." ],
    "thumbnail": { "url": "...", "title": "..." },
    "komikInfo": { "title": "...", "description": "...", "chapters": [ { "title": "Chapter 38", "slug": "..." } ] }
  }
}
```

**genres**:
```json
{ "creator": "Sanka Vollerei", "success": true, "genres": [ { "name": "Action", "value": "action" } ] }
```

**search**:
```json
{ "creator": "Sanka Vollerei", "success": true, "query": "Princess",
  "pagination": { "currentPage": 1, "hasNextPage": false, "nextPage": null },
  "komikList": [ { "title": "...", "rating": null, "slug": "...", "image": "...", "type": null } ] }
```

**error** (status HTTP 404/500):
```json
{ "creator": "Sanka Vollerei", "success": false, "message": "Error fetching komik detail from Komikhwa" }
```

## Catatan

- Sumber data komikhwa tidak punya beberapa field yang ada di Sanka, jadi diisi `null`: `type`/`color` di kartu list, `votes`, `theme`, `author` di `komikPopuler`. Kalau mau, bisa dilengkapi dengan fetch tambahan per item (lebih lambat).
- `latest` & `library` memakai halaman `https://komikhwa.com/manga/?sort=latest&hal={page}` (20 item/halaman, urut update terbaru). Beranda komikhwa cuma 1 halaman, jadi dipakai halaman `/manga/` yang terpaginasi.
- Daftar chapter di halaman detail hanya me-render 20 terbaru — scraper melengkapinya dari dropdown chapter di halaman baca (tanpa biaya tambahan berarti; 1 request ekstra).
- Tanggal `25 Agu 2026` dinormalisasi jadi `2026-08-25` lalu diubah jadi relatif ala Sanka ("4 hari yang lalu") untuk `releaseTime`.
- Situs bisa berubah struktur HTML-nya; kalau ada field kosong, cek ulang selector di `scraper.js`.
