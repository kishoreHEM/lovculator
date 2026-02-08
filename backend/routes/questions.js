// backend/routes/questions.js

import express from "express";
import pool from "../db.js"; 
import auth from "../middleware/auth.js"; 
import { notifyLike, notifyComment } from "./notifications.js"; 
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();
// Ensure req.user is populated for all question routes (guests allowed)
router.use(auth);

// ======================================================
// 📂 ANSWER IMAGE UPLOAD SETUP (Optional)
// ======================================================
const answersUploadDir = "uploads/answers";
if (!fs.existsSync(answersUploadDir)) {
  fs.mkdirSync(answersUploadDir, { recursive: true });
}

const answerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, answersUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, filename);
  }
});

const answerUpload = multer({ storage: answerStorage });

let hasAnswerImageColumnCache = null;
let hasAnswerHtmlColumnCache = null;
async function hasAnswerImageColumn() {
  if (hasAnswerImageColumnCache !== null) return hasAnswerImageColumnCache;
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns 
     WHERE table_name = 'answers' AND column_name = 'image_url' 
     LIMIT 1`
  );
  hasAnswerImageColumnCache = rows.length > 0;
  return hasAnswerImageColumnCache;
}

async function hasAnswerHtmlColumn() {
  if (hasAnswerHtmlColumnCache !== null) return hasAnswerHtmlColumnCache;
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns 
     WHERE table_name = 'answers' AND column_name = 'answer_html' 
     LIMIT 1`
  );
  hasAnswerHtmlColumnCache = rows.length > 0;
  return hasAnswerHtmlColumnCache;
}

// ======================================================
// 🧩 Helper — Create SEO-friendly Slug
// ======================================================
const createSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 180);
};

// ======================================================
// 1️⃣ POST /api/questions — Add new question
// ======================================================
router.post("/", auth, async (req, res) => {
  try {
    const { question, description, tags, category } = req.body;
    
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = req.user.id; 

    if (!question || question.trim().length < 5) {
      return res.status(400).json({
        error: "Question must be at least 5 characters long.",
      });
    }

    let slug = createSlug(question);
    const checkSlug = await pool.query(
      "SELECT slug FROM questions WHERE slug = $1",
      [slug]
    );

    if (checkSlug.rows.length > 0) {
      slug = `${slug}-${Date.now().toString().slice(-5)}`;
    }

    const insertRes = await pool.query(
  `
  INSERT INTO questions (user_id, question, description, slug, category, created_at)
  VALUES ($1, $2, $3, $4, $5, NOW())
  RETURNING id, question, description, slug, category, created_at;
  `,
  [userId, question.trim(), description || null, slug, category || 'love'.toLowerCase() ]
);

    const newQuestion = insertRes.rows[0];
    console.log(`✅ Question Added: ${newQuestion.slug}`);

    res.json({
      success: true,
      message: "Question added successfully.",
      question: newQuestion,
      share_url: `https://lovculator.com/questions/${newQuestion.slug}`,
    });
  } catch (err) {
    console.error("❌ Error adding question:", err);
    res.status(500).json({ error: "Failed to add question." });
  }
});

// ======================================================
// 2️⃣ GET /api/questions/latest — Fetch recent questions
// ======================================================
router.get("/latest", async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;

    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const category = req.query.category?.toLowerCase();

    let whereClause = "";
    const params = [userId];
    let paramIndex = 2;

    if (category && category !== "all") {
      whereClause = `WHERE LOWER(q.category) = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    params.push(limit, offset);

    const includeAnswerImage = await hasAnswerImageColumn();

    const questionsRes = await pool.query(
`
SELECT 
  q.id, 
  q.question, 
  q.slug,
  q.category, 
  q.description, 
  q.tags,
  q.created_at,

  u.username,
  u.display_name,
  u.avatar_url,

  COUNT(DISTINCT a.id) AS answers_count,
  COUNT(DISTINCT l.id) AS likes_count,
  COUNT(DISTINCT v.id) AS views_count,

	  top_answer.answer_text AS top_answer_text,
	  ${includeAnswerImage ? "top_answer.image_url AS top_answer_image_url," : ""}
	  top_answer.user_id AS top_answer_user_id,
	  top_answer.username AS top_answer_username,
	  top_answer.display_name AS top_answer_display_name,
	  top_answer.avatar_url AS top_answer_avatar_url,
	  top_answer.user_following AS top_answer_user_following,

  CASE 
    WHEN $1::int IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 
      FROM question_likes 
      WHERE question_id = q.id 
        AND user_id = $1::int
    )
  END AS user_liked

	FROM questions q

LEFT JOIN users u 
  ON q.user_id = u.id

LEFT JOIN answers a 
  ON q.id = a.question_id

LEFT JOIN question_likes l 
  ON q.id = l.question_id

LEFT JOIN question_views v 
  ON q.id = v.question_id

	  LEFT JOIN LATERAL (
    SELECT 
        a2.answer_text
        ${includeAnswerImage ? ", a2.image_url" : ""},
        u2.id AS user_id,
        u2.username,
        u2.display_name,
        u2.avatar_url,
        CASE 
          WHEN $1::int IS NULL THEN false
          ELSE EXISTS (
            SELECT 1 FROM follows 
            WHERE follower_id = $1::int AND target_id = u2.id
          )
        END AS user_following
	    FROM answers a2
        JOIN users u2 ON a2.user_id = u2.id
	    LEFT JOIN answer_likes al2 
	      ON a2.id = al2.answer_id
    WHERE a2.question_id = q.id
	    GROUP BY a2.id, a2.answer_text, a2.created_at, u2.id, u2.username, u2.display_name, u2.avatar_url ${includeAnswerImage ? ", a2.image_url" : ""}
    ORDER BY COUNT(al2.id) DESC, a2.created_at DESC
    LIMIT 1
  ) top_answer ON true

${whereClause}

  GROUP BY 
    q.id, 
    u.id, 
    top_answer.answer_text,
    ${includeAnswerImage ? "top_answer.image_url," : ""}
    top_answer.user_id,
    top_answer.username,
    top_answer.display_name,
    top_answer.avatar_url,
    top_answer.user_following

ORDER BY q.created_at DESC
LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
`,
params
);


    res.json(questionsRes.rows);
  } catch (err) {
    console.error("❌ Error fetching latest questions:", err);
    res.status(500).json({ error: "Failed to load questions." });
  }
});


// ======================================================
// 3️⃣ GET /api/questions/:slug — Fetch single question
// ======================================================
router.get("/:slug", auth, async (req, res) => {
  try {
    const { slug } = req.params;
    const userId = req.user ? req.user.id : null;
    
    const queryCondition = /^\d+$/.test(slug) ? "q.id = $2" : "q.slug = $2";

    const questionRes = await pool.query(
      `
      SELECT 
        q.id, 
        q.question, 
        q.slug, 
        q.category, -- Explicitly added for SEO and UI
        q.description, 
        q.created_at,
        u.username,
        u.display_name,
        u.avatar_url,
        u.bio,
        COUNT(DISTINCT a.id) as answers_count,
        COUNT(DISTINCT l.id) as likes_count,
        COUNT(DISTINCT v.id) as views_count,
        EXISTS(SELECT 1 FROM question_likes WHERE question_id = q.id AND user_id = $1) as user_liked
      FROM questions q
      LEFT JOIN users u ON q.user_id = u.id
      LEFT JOIN answers a ON q.id = a.question_id
      LEFT JOIN question_likes l ON q.id = l.question_id
      LEFT JOIN question_views v ON q.id = v.question_id
      WHERE ${queryCondition}
      GROUP BY q.id, u.id
      `,
      [userId, slug]
    );

    if (questionRes.rows.length === 0) {
      return res.status(404).json({ error: "Question not found" });
    }

    const question = questionRes.rows[0];

    // Track view
    if (userId) {
      await pool.query(
        `
        INSERT INTO question_views (question_id, user_id, viewed_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (question_id, user_id) DO UPDATE SET viewed_at = NOW();
        `,
        [question.id, userId]
      );
    }

    const includeAnswerImage = await hasAnswerImageColumn();
    const includeAnswerHtml = await hasAnswerHtmlColumn();
    const answersRes = await pool.query(
      `
      SELECT 
        a.id,
        a.answer_text as answer,
        ${includeAnswerHtml ? "a.answer_html," : ""}
        ${includeAnswerImage ? "a.image_url," : ""}
        a.created_at,
        u.id as user_id,
        u.username,
        u.display_name,
        u.avatar_url,
        u.bio,
        COUNT(DISTINCT al.id) as likes_count,
        COUNT(DISTINCT ac.id) as comments_count,
        EXISTS(SELECT 1 FROM answer_likes WHERE answer_id = a.id AND user_id = $1) as user_liked,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND target_id = u.id) as user_following
      FROM answers a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN answer_likes al ON a.id = al.answer_id
      LEFT JOIN answer_comments ac ON a.id = ac.answer_id
      WHERE a.question_id = $2
      GROUP BY a.id, u.id ${includeAnswerHtml ? ", a.answer_html" : ""} ${includeAnswerImage ? ", a.image_url" : ""}
      ORDER BY a.created_at ASC;
      `,
      [userId, question.id]
    );

    res.json({
      ...question,
      answers: answersRes.rows,
    });
  } catch (err) {
    console.error("❌ Error fetching question:", err);
    res.status(500).json({ error: "Failed to load question." });
  }
});

// ======================================================
// 4️⃣ POST /api/questions/:id/answer — Add Answer
// ======================================================
router.post("/:id/answer", auth, answerUpload.array("images", 6), async (req, res) => {
  try {
    const { id } = req.params;
    const answer =
      req.body.answer ||
      req.body.answer_text ||
      req.body.content ||
      req.body.text;
    const answerHtml = req.body.answer_html || null;
    const imageIndicesRaw = req.body.image_indices || "[]";
    const imageIndices = (() => {
      try { return JSON.parse(imageIndicesRaw); } catch { return []; }
    })();
    const files = Array.isArray(req.files) ? req.files : [];
    const imageUrls = files.map(f => `/uploads/answers/${f.filename}`);
    const imageMap = new Map();
    imageIndices.forEach((idx, i) => {
      if (imageUrls[i]) imageMap.set(Number(idx), imageUrls[i]);
    });
    const firstImageUrl = imageUrls[0] || null;
    
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = req.user.id;

    if (!answer || answer.trim().length === 0) {
      return res.status(400).json({ error: "Answer cannot be empty." });
    }

    if (answer.trim().length < 10) {
      return res.status(400).json({ 
        error: "Answer must be at least 10 characters long." 
      });
    }

    const existingAnswer = await pool.query(
      "SELECT id FROM answers WHERE question_id = $1 AND user_id = $2",
      [id, userId]
    );

    if (existingAnswer.rows.length > 0) {
      return res.status(400).json({ 
        error: "You have already answered this question." 
      });
    }

    const cleanAnswerHtml = (html) => {
      if (!html) return html;
      let out = html;

      // Remove empty paragraphs/divs
      out = out.replace(/<(p|div)>(\s|&nbsp;|<br\s*\/?>)*<\/\1>/gi, "");

      // Strip <p> wrappers inside list items
      out = out.replace(/<li>\s*<p>/gi, "<li>");
      out = out.replace(/<\/p>\s*<\/li>/gi, "</li>");

      // Remove stray <br> between list items
      out = out.replace(/<\/li>\s*(<br\s*\/?>\s*)+<li>/gi, "</li><li>");
      out = out.replace(/<ul>\s*(<br\s*\/?>\s*)+/gi, "<ul>");
      out = out.replace(/(<br\s*\/?>\s*)+<\/ul>/gi, "</ul>");

      return out;
    };

    let finalHtml = cleanAnswerHtml(answerHtml);
    if (finalHtml) {
      imageMap.forEach((url, idx) => {
        finalHtml = finalHtml.replaceAll(`__IMAGE_${idx}__`, url);
      });
      finalHtml = finalHtml.replace(/data-upload-index="\\d+"/g, "");
    }

    const includeImage = firstImageUrl && await hasAnswerImageColumn();
    const includeHtml = finalHtml && await hasAnswerHtmlColumn();

    let result;
    if (includeHtml && includeImage) {
      result = await pool.query(
        `
        INSERT INTO answers (question_id, user_id, answer_text, answer_html, image_url, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id, answer_text, answer_html, image_url, created_at;
        `,
        [id, userId, answer.trim(), finalHtml, firstImageUrl]
      );
    } else if (includeHtml) {
      result = await pool.query(
        `
        INSERT INTO answers (question_id, user_id, answer_text, answer_html, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, answer_text, answer_html, created_at;
        `,
        [id, userId, answer.trim(), finalHtml]
      );
    } else if (includeImage) {
      result = await pool.query(
        `
        INSERT INTO answers (question_id, user_id, answer_text, image_url, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id, answer_text, image_url, created_at;
        `,
        [id, userId, answer.trim(), firstImageUrl]
      );
    } else {
      result = await pool.query(
        `
        INSERT INTO answers (question_id, user_id, answer_text, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING id, answer_text, created_at;
        `,
        [id, userId, answer.trim()]
      );
    }

    const qOwner = await pool.query("SELECT user_id FROM questions WHERE id = $1", [id]);
    if (qOwner.rows.length > 0) {
        const ownerId = qOwner.rows[0].user_id;
        if (ownerId !== userId) {
            await notifyComment(req, ownerId, userId, "question", id); 
        }
    }

    res.json({ 
      success: true, 
      message: "Answer posted successfully.",
      answer: result.rows[0]
    });

  } catch (err) {
    console.error("❌ Error posting answer:", err);
    res.status(500).json({ 
        error: "Failed to post answer.",
        details: err.message 
    });
  }
});

// ======================================================
// 5️⃣ GET /api/questions/for-you
// ======================================================
router.get("/for-you", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const questionsRes = await pool.query(
      `
      SELECT DISTINCT
        q.id, 
        q.question, 
        q.slug, 
        q.description, 
        q.tags, 
        q.created_at,
        u.username,
        u.display_name,
        u.avatar_url,
        COUNT(DISTINCT a.id) as answers_count,
        COUNT(DISTINCT l.id) as likes_count,
        false as user_liked
      FROM questions q
      LEFT JOIN users u ON q.user_id = u.id
      LEFT JOIN answers a ON q.id = a.question_id
      LEFT JOIN question_likes l ON q.id = l.question_id
      WHERE u.id IN (
        SELECT following_id FROM user_follows WHERE follower_id = $1
      )
      OR q.user_id = $1
      GROUP BY q.id, u.id
      ORDER BY q.created_at DESC
      LIMIT 20;
      `,
      [userId]
    );

    res.json(questionsRes.rows);
  } catch (err) {
    console.error("❌ Error fetching questions for you:", err);
    res.json([]);
  }
});

// ======================================================
// 6️⃣ GET /api/questions/my/questions
// ======================================================
router.get("/my/questions", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const questionsRes = await pool.query(
      `
      SELECT 
        q.id, 
        q.question, 
        q.slug,
        q.category,
        q.description, 
        q.tags, 
        q.created_at,
        COUNT(DISTINCT a.id) as answers_count,
        COUNT(DISTINCT l.id) as likes_count,
        COUNT(DISTINCT v.id) as views_count
      FROM questions q
      LEFT JOIN answers a ON q.id = a.question_id
      LEFT JOIN question_likes l ON q.id = l.question_id
      LEFT JOIN question_views v ON q.id = v.question_id
      WHERE q.user_id = $1
      GROUP BY q.id
      ORDER BY q.created_at DESC;
      `,
      [userId]
    );

    res.json(questionsRes.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load questions." });
  }
});

// ======================================================
// 7️⃣ GET /api/questions/my/answers
// ======================================================
router.get("/my/answers", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const answersRes = await pool.query(
      `
      SELECT 
        a.id,
        a.answer_text as answer,
        a.created_at,
        q.id as question_id,
        q.question,
        q.slug,
        COUNT(DISTINCT al.id) as likes_count,
        COUNT(DISTINCT ac.id) as comments_count
      FROM answers a
      JOIN questions q ON a.question_id = q.id
      LEFT JOIN answer_likes al ON a.id = al.answer_id
      LEFT JOIN answer_comments ac ON a.id = ac.answer_id
      WHERE a.user_id = $1
      GROUP BY a.id, q.id
      ORDER BY a.created_at DESC;
      `,
      [userId]
    );

    res.json(answersRes.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to load answers." });
  }
});

// ======================================================
// 8️⃣ POST /api/questions/:id/like — Like a question
// ======================================================
router.post("/:id/like", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    let is_liked = false;

    const existingLike = await pool.query(
      "SELECT id FROM question_likes WHERE question_id = $1 AND user_id = $2",
      [id, userId]
    );

    if (existingLike.rows.length > 0) {
      await pool.query("DELETE FROM question_likes WHERE question_id = $1 AND user_id = $2", [id, userId]);
      is_liked = false;
    } else {
      await pool.query("INSERT INTO question_likes (question_id, user_id, liked_at) VALUES ($1, $2, NOW())", [id, userId]);
      is_liked = true;
    }

    const likeCountRes = await pool.query("SELECT COUNT(*) as count FROM question_likes WHERE question_id = $1", [id]);

    if (is_liked) {
      const qOwner = await pool.query("SELECT user_id FROM questions WHERE id = $1", [id]);
      if (qOwner.rows.length > 0) {
          const ownerId = qOwner.rows[0].user_id;
          if (ownerId !== userId) {
            await notifyLike(req, ownerId, userId, "question", id);
          }
      }
    }

    res.json({ is_liked, like_count: parseInt(likeCountRes.rows[0].count) });

  } catch (err) {
    console.error("❌ Error liking question:", err);
    res.status(500).json({ error: "Failed to like question." });
  }
});

// ======================================================
// 9️⃣ POST /api/questions/answers/:id/like — Like an answer
// ======================================================
router.post("/answers/:id/like", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    let is_liked = false;

    const existingLike = await pool.query(
      "SELECT id FROM answer_likes WHERE answer_id = $1 AND user_id = $2",
      [id, userId]
    );

    if (existingLike.rows.length > 0) {
      await pool.query("DELETE FROM answer_likes WHERE answer_id = $1 AND user_id = $2", [id, userId]);
      is_liked = false;
    } else {
      await pool.query("INSERT INTO answer_likes (answer_id, user_id, liked_at) VALUES ($1, $2, NOW())", [id, userId]);
      is_liked = true;
    }

    const likeCountRes = await pool.query("SELECT COUNT(*) as count FROM answer_likes WHERE answer_id = $1", [id]);

    if (is_liked) {
        const aOwner = await pool.query("SELECT user_id FROM answers WHERE id = $1", [id]);
        if (aOwner.rows.length > 0) {
            const ownerId = aOwner.rows[0].user_id;
            if (ownerId !== userId) {
                await notifyLike(req, ownerId, userId, "answer", id);
            }
        }
    }

    res.json({ is_liked, like_count: parseInt(likeCountRes.rows[0].count) });

  } catch (err) {
    console.error("❌ Error liking answer:", err);
    res.status(500).json({ error: "Failed to like answer." });
  }
});

// ======================================================
// 🔟 POST /api/questions/answers/:id/comments — Add comment to answer
// ======================================================
router.post("/answers/:id/comments", auth, async (req, res) => {
  try {
    const { id } = req.params; 
    const { content, text, comment } = req.body; 
    const finalContent = content || text || comment;
    const userId = req.user.id;

    if (!finalContent || finalContent.trim().length === 0) {
      return res.status(400).json({ error: "Comment cannot be empty." });
    }

    // ✅ FIXED: Changed 'content' to 'comment_text' to match likely database schema
    const result = await pool.query(
      `INSERT INTO answer_comments (answer_id, user_id, comment_text, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, comment_text, created_at`,
      [id, userId, finalContent.trim()]
    );

    // Notify Answer Owner
    const answerRes = await pool.query("SELECT user_id FROM answers WHERE id = $1", [id]);
    if (answerRes.rows.length > 0) {
        const ownerId = answerRes.rows[0].user_id;
        if (ownerId !== userId) {
            await notifyComment(req, ownerId, userId, "answer", id);
        }
    }

    res.json({ success: true, comment: result.rows[0] });

  } catch (err) {
    console.error("❌ Error adding answer comment:", err);
    res.status(500).json({ error: "Failed to post comment." });
  }
});

// ======================================================
// 1️⃣1️⃣ GET /api/questions/answers/:id/comments — Get answer comments
// ======================================================
router.get("/answers/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    
    // ✅ FIXED: Changed 'content' to 'comment_text' here as well
    const { rows } = await pool.query(
      `SELECT 
        ac.id, 
        ac.comment_text, 
        ac.created_at,
        u.username, 
        u.display_name as author_name, 
        u.avatar_url as author_avatar_url
       FROM answer_comments ac
       JOIN users u ON ac.user_id = u.id
       WHERE ac.answer_id = $1
       ORDER BY ac.created_at ASC`,
      [id]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Error loading answer comments:", err);
    res.status(500).json({ error: "Failed to load comments." });
  }
});

// ======================================================
// 1️⃣2️⃣ DELETE /api/questions/:id
// ======================================================
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const questionRes = await pool.query(
      "SELECT user_id FROM questions WHERE id = $1",
      [id]
    );

    if (questionRes.rows.length === 0) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (questionRes.rows[0].user_id !== userId) {
      return res.status(403).json({ error: "Not authorized to delete this question" });
    }

    await pool.query("DELETE FROM questions WHERE id = $1", [id]);
    
    res.json({ success: true, message: "Question deleted successfully." });
  } catch (err) {
    console.error("❌ Error deleting question:", err);
    res.status(500).json({ error: "Failed to delete question." });
  }
});

export default router;
