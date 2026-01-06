import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = "https://lovculator.com";

    // Fetch stories
    const storiesRes = await pool.query(`
      SELECT id, slug, updated_at
      FROM stories
      WHERE status = 'published'
    `);

    // Fetch questions
    const questionsRes = await pool.query(`
      SELECT slug, updated_at
      FROM questions
      WHERE status = 'active'
    `);

    res.header("Content-Type", "application/xml");

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    /* ---------- STATIC PAGES ---------- */
    const staticPages = [
      { loc: "/", priority: "1.0", freq: "daily" },
      { loc: "/love-calculator", priority: "1.0", freq: "daily" },
      { loc: "/love-stories", priority: "0.9", freq: "daily" },
      { loc: "/answer", priority: "0.9", freq: "daily" },
      { loc: "/about", priority: "0.6", freq: "monthly" },
      { loc: "/contact", priority: "0.6", freq: "monthly" }
    ];

    staticPages.forEach(page => {
      xml += `
        <url>
          <loc>${baseUrl}${page.loc}</loc>
          <changefreq>${page.freq}</changefreq>
          <priority>${page.priority}</priority>
        </url>
      `;
    });

    /* ---------- LOVE STORIES ---------- */
    storiesRes.rows.forEach(story => {
      xml += `
        <url>
          <loc>${baseUrl}/stories/${story.id}-${story.slug}</loc>
          <lastmod>${story.updated_at.toISOString()}</lastmod>
          <changefreq>weekly</changefreq>
          <priority>0.8</priority>
        </url>
      `;
    });

    /* ---------- QUESTIONS ---------- */
    questionsRes.rows.forEach(q => {
      xml += `
        <url>
          <loc>${baseUrl}/question/${q.slug}</loc>
          <lastmod>${q.updated_at.toISOString()}</lastmod>
          <changefreq>daily</changefreq>
          <priority>0.8</priority>
        </url>
      `;
    });

    xml += `</urlset>`;
    res.send(xml);

  } catch (err) {
    console.error("Sitemap error:", err);
    res.status(500).send("Sitemap generation failed");
  }
});

export default router;
