require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { getQuestions, gradeAnswers } = require("./questions");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (process.env.NODE_ENV === "production" && (!JWT_SECRET || JWT_SECRET.length < 32)) {
  console.error("Set JWT_SECRET to a random secret of at least 32 characters in production.");
  process.exit(1);
}
if (process.env.NODE_ENV === "production" && !ADMIN_PASSWORD) {
  console.error("Set ADMIN_PASSWORD in production.");
  process.exit(1);
}
const secret = JWT_SECRET || crypto.randomBytes(48).toString("hex");
const dbPath = process.env.DATABASE_PATH || "./data/science-quest.sqlite";
if (dbPath !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    subject TEXT NOT NULL DEFAULT '전체',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
const appUser = db.prepare("SELECT id, username FROM users WHERE id = ?");
const insertUser = db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)");
const insertScore = db.prepare("INSERT INTO scores (user_id, score, total, subject) VALUES (?, ?, ?, ?)");
const leaderboard = db.prepare(`
  SELECT u.username, SUM(s.score) AS points, SUM(s.total) AS answered,
         COUNT(s.id) AS rounds
  FROM scores s JOIN users u ON u.id = s.user_id
  GROUP BY u.id ORDER BY points DESC, rounds DESC LIMIT 20
`);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 200, standardHeaders: true, legacyHeaders: false }));
app.use(express.static(path.join(__dirname, "..", "public")));

function tokenFor(user) { return jwt.sign({ sub: user.id, username: user.username }, secret, { expiresIn: "7d" }); }
function auth(req, res, next) {
  const token = req.cookies.sq_token || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "로그인이 필요합니다." });
  try { req.user = jwt.verify(token, secret); next(); }
  catch { res.clearCookie("sq_token"); return res.status(401).json({ error: "로그인 세션이 만료되었습니다." }); }
}
function adminAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    const payload = jwt.verify(token, secret);
    if (payload.role !== "admin") throw new Error("invalid role");
    req.admin = true; next();
  } catch { res.status(401).json({ error: "관리자 인증이 필요합니다." }); }
}
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "SCIENCE QUEST PRO" }));

app.post("/api/auth/register", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  if (!/^[A-Za-z0-9가-힣_-]{2,20}$/.test(username)) return res.status(400).json({ error: "아이디는 한글/영문/숫자/_/- 2~20자여야 합니다." });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ error: "비밀번호는 8~128자여야 합니다." });
  try {
    const hash = await bcrypt.hash(password, 12);
    const info = insertUser.run(username, hash);
    const user = appUser.get(info.lastInsertRowid);
    res.cookie("sq_token", tokenFor(user), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 86400000 });
    res.status(201).json({ user });
  } catch (e) {
    if (String(e.code).includes("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "이미 사용 중인 아이디입니다." });
    res.status(500).json({ error: "계정을 만들지 못했습니다." });
  }
});
app.post("/api/auth/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!row || !(await bcrypt.compare(password, row.password_hash))) return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
  res.cookie("sq_token", tokenFor(row), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 86400000 });
  res.json({ user: { id: row.id, username: row.username } });
});
app.post("/api/auth/logout", (_req, res) => { res.clearCookie("sq_token"); res.json({ ok: true }); });
app.get("/api/auth/me", auth, (req, res) => res.json({ user: appUser.get(req.user.sub) }));

app.get("/api/questions", (req, res) => res.json({ questions: getQuestions({ subject: req.query.subject || "전체", level: req.query.level || "전체", count: req.query.count || 5 }) }));
app.post("/api/quiz/submit", auth, (req, res) => {
  const { answers, subject = "전체" } = req.body || {};
  const result = gradeAnswers(answers);
  if (!result.total) return res.status(400).json({ error: "제출할 답이 없습니다." });
  insertScore.run(req.user.sub, result.score, result.total, String(subject).slice(0, 30));
  res.json(result);
});
app.get("/api/leaderboard", (_req, res) => res.json({ leaderboard: leaderboard.all() }));

app.post("/api/admin/login", (req, res) => {
  const supplied = Buffer.from(String(req.body.password || ""));
  const expected = Buffer.from(String(ADMIN_PASSWORD || ""));
  const matches = expected.length > 0 && supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  if (!matches) return res.status(401).json({ error: "관리자 비밀번호가 올바르지 않습니다." });
  res.json({ token: jwt.sign({ role: "admin" }, secret, { expiresIn: "2h" }) });
});
app.get("/api/admin/stats", adminAuth, (_req, res) => {
  res.json({
    users: db.prepare("SELECT COUNT(*) AS count FROM users").get().count,
    rounds: db.prepare("SELECT COUNT(*) AS count FROM scores").get().count,
    scores: db.prepare("SELECT COALESCE(SUM(score),0) AS points, COALESCE(SUM(total),0) AS answered FROM scores").get(),
    leaderboard: leaderboard.all()
  });
});
app.get("/developer.html", (_req, res) => res.sendFile(path.join(__dirname, "..", "public", "developer.html")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "API endpoint not found" });
  res.sendFile(path.join(__dirname, "..", "public", "index.html"), err => { if (err) next(err); });
});
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: "서버 오류가 발생했습니다." }); });
app.listen(PORT, "0.0.0.0", () => console.log(`SCIENCE QUEST PRO listening on ${PORT}`));
