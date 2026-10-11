// tests/security_regression.test.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { optionalAuth, requireAuth } from "../backend/middleware/auth.js";
import { checkAdmin } from "../backend/middleware/checkAdmin.js";
import { isAdmin } from "../backend/middleware/isAdmin.js";
import { resetPassword, login } from "../backend/controllers/authController.js";

console.log("==================================================");
console.log("🔒 RUNNING LOVCULATOR SECURITY & REGRESSION TESTS");
console.log("==================================================\n");

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
  }
}

async function runAsyncTest(name, fn) {
  total++;
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAIL: ${name}`);
    console.error(err);
  }
}

// ---------------------------------------------------------
// 1. Production Startup Fail-Fast for SESSION_SECRET
// ---------------------------------------------------------
runTest("Test 9a: Production startup fails when SESSION_SECRET is missing", () => {
  const result = spawnSync("node", ["backend/server.js"], {
    env: { ...process.env, NODE_ENV: "production", SESSION_SECRET: "" },
    cwd: process.cwd(),
    encoding: "utf8"
  });
  assert.equal(result.status, 1, "Process should exit with code 1 when SESSION_SECRET is missing");
  assert.match(result.stderr, /FATAL SECURITY ERROR: SESSION_SECRET/, "Should output fatal security error");
});

runTest("Test 9b: Production startup fails when SESSION_SECRET is default fallback", () => {
  const result = spawnSync("node", ["backend/server.js"], {
    env: { ...process.env, NODE_ENV: "production", SESSION_SECRET: "lovculator_secret_key_change_in_production" },
    cwd: process.cwd(),
    encoding: "utf8"
  });
  assert.equal(result.status, 1, "Process should exit with code 1 when SESSION_SECRET is default fallback");
});

runTest("Test 9c: Production startup fails when SESSION_SECRET is too short (< 32 chars)", () => {
  const result = spawnSync("node", ["backend/server.js"], {
    env: { ...process.env, NODE_ENV: "production", SESSION_SECRET: "too_short_secret_123" },
    cwd: process.cwd(),
    encoding: "utf8"
  });
  assert.equal(result.status, 1, "Process should exit with code 1 when SESSION_SECRET is short");
});

// ---------------------------------------------------------
// 2. Middleware: requireAuth vs optionalAuth
// ---------------------------------------------------------
runTest("Test 1: Guests receive 401 on requireAuth protected endpoints", () => {
  const req = { session: {} };
  let statusCode = null;
  let responseBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };
  let nextCalled = false;
  requireAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false, "next() must NOT be called for unauthenticated guests");
  assert.equal(statusCode, 401, "Status code must be 401 Unauthorized");
  assert.equal(responseBody?.error, "Unauthorized");
});

runTest("Test 2: Authenticated users can pass requireAuth with populated req.user", () => {
  const req = {
    session: {
      user: { id: 42, username: "testuser", email: "test@example.com" }
    }
  };
  let nextCalled = false;
  const res = {};
  requireAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true, "next() must be called for authenticated users");
  assert.equal(req.user?.id, 42, "req.user must be populated with user details");
  assert.equal(req.user?.username, "testuser");
});

runTest("Test 2b: Guests can access optionalAuth endpoints with req.user = null", () => {
  const req = { session: {} };
  let nextCalled = false;
  optionalAuth(req, {}, () => { nextCalled = true; });

  assert.equal(nextCalled, true, "next() must be called for guests on optionalAuth endpoints");
  assert.equal(req.user, null, "req.user should be set to null for guests");
});

// ---------------------------------------------------------
// 3. Admin Authorization (checkAdmin & isAdmin)
// ---------------------------------------------------------
runTest("Test 3a: Guests receive 401 on checkAdmin endpoint", () => {
  const req = { session: {} };
  let statusCode = null;
  let responseBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };
  let nextCalled = false;
  checkAdmin(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(statusCode, 401, "Guests should receive 401 Unauthorized");
});

runTest("Test 3b: Non-admin users receive 403 Forbidden on checkAdmin endpoint", () => {
  const req = {
    session: {
      user: { id: 10, username: "regular_user", is_admin: false }
    }
  };
  let statusCode = null;
  let responseBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };
  let nextCalled = false;
  checkAdmin(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(statusCode, 403, "Non-admins should receive 403 Forbidden");
});

runTest("Test 4: Admin users pass checkAdmin endpoint successfully", () => {
  const req = {
    session: {
      user: { id: 1, username: "admin_user", is_admin: true }
    }
  };
  let nextCalled = false;
  checkAdmin(req, {}, () => { nextCalled = true; });

  assert.equal(nextCalled, true, "Admins must be allowed through");
});

// ---------------------------------------------------------
// 4. Password-Reset Transaction Handling
// ---------------------------------------------------------
await runAsyncTest("Test 5 & 7: Invalid or expired password-reset tokens are rejected and client is released", async () => {
  let clientReleased = false;
  let rolledBack = false;

  const mockClient = {
    query: async (sql, params) => {
      if (/BEGIN/i.test(sql)) return {};
      if (/SELECT.*FROM password_resets/i.test(sql)) {
        // Return empty rows simulating invalid or expired token
        return { rows: [] };
      }
      if (/ROLLBACK/i.test(sql)) {
        rolledBack = true;
        return {};
      }
      return { rows: [] };
    },
    release: () => {
      clientReleased = true;
    }
  };

  // Mock pool temporarily for resetPassword
  const poolModule = await import("../backend/db.js");
  const originalConnect = poolModule.default.connect;
  poolModule.default.connect = async () => mockClient;

  let statusCode = null;
  let responseBody = null;
  const req = { body: { token: "nonexistent_token", newPassword: "securePassword123!" } };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  try {
    await resetPassword(req, res);
    assert.equal(statusCode, 400, "Should return 400 for invalid/expired token");
    assert.equal(rolledBack, true, "Transaction must rollback on invalid token");
    assert.equal(clientReleased, true, "Database client MUST be released");
  } finally {
    poolModule.default.connect = originalConnect;
  }
});

await runAsyncTest("Test 6 & 7: Failed password-reset operation rolls back all DB changes and releases client", async () => {
  let clientReleased = false;
  let rolledBack = false;
  let committed = false;

  const mockClient = {
    query: async (sql, params) => {
      if (/BEGIN/i.test(sql)) return {};
      if (/SELECT.*FROM password_resets/i.test(sql)) {
        return { rows: [{ user_id: 99 }] };
      }
      if (/UPDATE users/i.test(sql)) {
        throw new Error("Simulated database disk failure");
      }
      if (/ROLLBACK/i.test(sql)) {
        rolledBack = true;
        return {};
      }
      if (/COMMIT/i.test(sql)) {
        committed = true;
        return {};
      }
      return { rows: [] };
    },
    release: () => {
      clientReleased = true;
    }
  };

  const poolModule = await import("../backend/db.js");
  const originalConnect = poolModule.default.connect;
  poolModule.default.connect = async () => mockClient;

  let statusCode = null;
  let responseBody = null;
  const req = { body: { token: "valid_token_123", newPassword: "securePassword123!" } };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  try {
    await resetPassword(req, res);
    assert.equal(statusCode, 500, "Should return 500 on unexpected DB error");
    assert.equal(rolledBack, true, "Must ROLLBACK on failure");
    assert.equal(committed, false, "Must NOT commit on failure");
    assert.equal(clientReleased, true, "Client must be released even on error");
    assert.equal(responseBody?.error, "Failed to reset password.");
  } finally {
    poolModule.default.connect = originalConnect;
  }
});

await runAsyncTest("Test 7 & 8: Successful password-reset updates password, deletes token, commits, and releases client", async () => {
  let clientReleased = false;
  let committed = false;
  let passwordUpdated = false;
  let tokenDeleted = false;

  const mockClient = {
    query: async (sql, params) => {
      if (/BEGIN/i.test(sql)) return {};
      if (/SELECT.*FROM password_resets/i.test(sql)) {
        return { rows: [{ user_id: 55 }] };
      }
      if (/UPDATE users SET password_hash/i.test(sql)) {
        passwordUpdated = true;
        assert.equal(params[1], 55);
        return { rowCount: 1 };
      }
      if (/DELETE FROM password_resets WHERE user_id = \$1/i.test(sql)) {
        tokenDeleted = true;
        assert.equal(params[0], 55);
        return { rowCount: 1 };
      }
      if (/COMMIT/i.test(sql)) {
        committed = true;
        return {};
      }
      return { rows: [] };
    },
    release: () => {
      clientReleased = true;
    }
  };

  const poolModule = await import("../backend/db.js");
  const originalConnect = poolModule.default.connect;
  poolModule.default.connect = async () => mockClient;

  let statusCode = null;
  let responseBody = null;
  const req = { body: { token: "valid_token_abc", newPassword: "newSecurePassword2026!" } };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  try {
    await resetPassword(req, res);
    assert.equal(statusCode, 200, "Should return 200 on success");
    assert.equal(passwordUpdated, true, "Must update user password");
    assert.equal(tokenDeleted, true, "Must delete reset token to prevent reuse");
    assert.equal(committed, true, "Must COMMIT the transaction");
    assert.equal(clientReleased, true, "Client must be released");
  } finally {
    poolModule.default.connect = originalConnect;
  }
});

// ---------------------------------------------------------
// 5. Session Regeneration & Admin Role Assignment in Login
// ---------------------------------------------------------
await runAsyncTest("Test 3c & 4: Login regenerates session and assigns is_admin correctly", async () => {
  let sessionRegenerated = false;
  let sessionSaved = false;

  const req = {
    body: { email: "admin@lovculator.com", password: "Password123!" },
    session: {
      regenerate: (cb) => {
        sessionRegenerated = true;
        cb(null);
      },
      save: (cb) => {
        sessionSaved = true;
        cb(null);
      }
    }
  };

  // Mock pool query for login
  const poolModule = await import("../backend/db.js");
  const originalQuery = poolModule.default.query;

  const bcrypt = await import("bcryptjs");
  const hashedPassword = await bcrypt.default.hash("Password123!", 10);

  poolModule.default.query = async (sql, params) => {
    if (/SELECT[\s\S]*FROM users/i.test(sql)) {
      return {
        rows: [
          {
            id: 1,
            username: "superadmin",
            email: "admin@lovculator.com",
            password_hash: hashedPassword,
            email_verified: true,
            is_admin: true,
            days_since_signup: 1
          }
        ]
      };
    }
    return { rows: [] };
  };

  let statusCode = null;
  let responseBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    }
  };

  try {
    await login(req, res);
    assert.equal(statusCode, 200);
    assert.equal(sessionRegenerated, true, "Session must be regenerated upon login to prevent fixation");
    assert.equal(sessionSaved, true, "Session must be saved");
    assert.equal(req.session.user.is_admin, true, "Session user must have is_admin = true");
  } finally {
    poolModule.default.query = originalQuery;
  }
});

// ---------------------------------------------------------
// 6. Token & Secret Exposure in Logs Check
// ---------------------------------------------------------
await runAsyncTest("Test 10: No tokens, passwords, or secrets are exposed in logs on resetPassword error", async () => {
  const secretToken = "super_secret_token_never_log_this_xyz987";
  const secretPassword = "ultra_secret_new_password_abc456";

  const originalConsoleError = console.error;
  let loggedOutput = "";
  console.error = (...args) => {
    loggedOutput += args.join(" ") + "\n";
  };

  const mockClient = {
    query: async (sql) => {
      if (/BEGIN/i.test(sql)) return {};
      if (/SELECT.*FROM password_resets/i.test(sql)) {
        return { rows: [{ user_id: 12 }] };
      }
      if (/UPDATE users/i.test(sql)) {
        throw new Error("Simulated query failure");
      }
      if (/ROLLBACK/i.test(sql)) return {};
      return { rows: [] };
    },
    release: () => {}
  };

  const poolModule = await import("../backend/db.js");
  const originalConnect = poolModule.default.connect;
  poolModule.default.connect = async () => mockClient;

  const req = { body: { token: secretToken, newPassword: secretPassword } };
  const res = { status: () => ({ json: () => {} }) };

  try {
    await resetPassword(req, res);
    assert.equal(loggedOutput.includes(secretToken), false, "Reset token must NOT be leaked in error logs");
    assert.equal(loggedOutput.includes(secretPassword), false, "Password must NOT be leaked in error logs");
  } finally {
    console.error = originalConsoleError;
    poolModule.default.connect = originalConnect;
  }
});

// ---------------------------------------------------------
// 7. Express Router Level Middleware Verification
// ---------------------------------------------------------
await runAsyncTest("Test 1b & 8: Feed, messages, notifications routers guard endpoints against unauthenticated requests", async () => {
  const feedRouter = (await import("../backend/routes/feed.js")).default;
  const messagesRouter = (await import("../backend/routes/messages.js")).default;
  const notificationsRouter = (await import("../backend/routes/notifications.js")).default;

  // Test feed router layer
  const express = (await import("express")).default;
  const app = express();
  app.use("/api/posts/feed", feedRouter);
  app.use("/api/messages", messagesRouter);
  app.use("/api/notifications", notificationsRouter);

  // Helper to simulate request through express router stack
  function simulateRequest(routerApp, path, method = "GET") {
    return new Promise((resolve) => {
      const mockReq = {
        method,
        url: path,
        originalUrl: path,
        path,
        headers: {},
        session: {} // unauthenticated guest
      };
      const mockRes = {
        statusCode: 200,
        status(c) { this.statusCode = c; return this; },
        json(data) { resolve({ statusCode: this.statusCode, body: data }); },
        send(data) { resolve({ statusCode: this.statusCode, body: data }); },
        setHeader() {},
        getHeader() {}
      };
      routerApp.handle(mockReq, mockRes, () => {
        resolve({ statusCode: 404, body: null });
      });
    });
  }

  const feedRes = await simulateRequest(app, "/api/posts/feed");
  assert.equal(feedRes.statusCode, 401, "Feed endpoint must return 401 for guests");

  const msgRes = await simulateRequest(app, "/api/messages/conversations");
  assert.equal(msgRes.statusCode, 401, "Messages endpoint must return 401 for guests");

  const notifRes = await simulateRequest(app, "/api/notifications");
  assert.equal(notifRes.statusCode, 401, "Notifications endpoint must return 401 for guests");
});

console.log("\n==================================================");
console.log(`📊 TEST SUITE SUMMARY: ${passed}/${total} PASSED`);
console.log("==================================================");

if (passed !== total) {
  process.exit(1);
}
