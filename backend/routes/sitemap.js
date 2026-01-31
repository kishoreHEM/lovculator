import express from "express";
import pool from "../db.js";

const router = express.Router();

// 🧠 In-memory cache
let cachedXml = null;
let cacheTime = 0;
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes

router.get("/sitemap.xml", async (req, res) => {
  try {
    if (cachedXml && Date.now() - cacheTime < CACHE_TTL) {
      res.set("Content-Type", "application/xml");
      return res.send(cachedXml);
    }

    const baseUrl = "https://lovculator.com";

    const storiesRes = await pool.query(`
      SELECT id, created_at, updated_at
      FROM stories
    `);

    const questionsRes = await pool.query(`
      SELECT slug, created_at, updated_at
      FROM questions
    `);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // ---------- STATIC PAGES ----------
    const staticPages = [
      { loc: "/", priority: "1.0", freq: "daily" },
      { loc: "/love-calculator", priority: "0.9", freq: "weekly" },
      { loc: "/love-stories", priority: "0.9", freq: "daily" },
      { loc: "/answer", priority: "0.9", freq: "daily" },
      { loc: "/about", priority: "0.6", freq: "monthly" },
      { loc: "/contact", priority: "0.6", freq: "monthly" }
    ];

    staticPages.forEach(p => {
      xml += `
  <url>
    <loc>${baseUrl}${p.loc}</loc>
    <changefreq>${p.freq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`;
    });

    // ---------- STORIES ----------
    storiesRes.rows.forEach(s => {
      const lastmod = (s.updated_at || s.created_at).toISOString();
      xml += `
  <url>
    <loc>${baseUrl}/stories/${s.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    });

    // ---------- QUESTIONS ----------
    questionsRes.rows.forEach(q => {
      const lastmod = (q.updated_at || q.created_at).toISOString();
      xml += `
  <url>
    <loc>${baseUrl}/question/${q.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });

    xml += `\n</urlset>`;

    cachedXml = xml;
    cacheTime = Date.now();

    res.set("Content-Type", "application/xml");
    res.send(xml);

  } catch (err) {
    console.error("❌ Sitemap error:", err);
    res.status(500).send("Sitemap generation failed");
  }
});

export default router;
