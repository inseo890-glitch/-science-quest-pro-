
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const Database = require("better-sqlite3");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET;

if (!SECRET || SECRET.length < 32) {
  throw new Error("JWT_SECRET 환경 변수에 32자 이상의 무작위 비밀값을 설정하세요.");
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100
}));

const root = path.join(__dirname, "..");
const dbPath = process.env.DATABASE_PATH || path.join(root, "science-quest.db");
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
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
    user_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

const questions = [
  {id:1,subject:"생명과학",level:"중",question:"식물이 광합성에 사용하는 기체는 무엇인가요?",options:["산소","이산화탄소","질소","수소"],answer:1,explanation:"광합성은 이산화탄소와 물을 이용합니다."},
  {id:2,subject:"화학",level:"중",question:"물의 화학식은 무엇인가요?",options:["CO₂","O₂","H₂O","NaCl"],answer:2,explanation:"물은 수소 원자 2개와 산소 원자 1개로 이루어집니다."},
  {id:3,subject:"물리",level:"중",question:"힘의 SI 단위는 무엇인가요?",options:["줄","와트","뉴턴","파스칼"],answer:2,explanation:"힘의 SI 단위는 뉴턴(N)입니다."},
  {id:4,subject:"지구과학",level:"중",question:"지구의 공전 주기는 얼마인가요?",options:["하루","한 달","약 1년","약 10년"],answer:2,explanation:"지구는 약 1년 동안 태양을 한 바퀴 공전합니다."},
  {id:5,subject:"생명과학",level:"상",question:"세포 호흡으로 ATP를 많이 생성하는 소기관은?",options:["리보솜","미토콘드리아","골지체","핵"],answer:1,explanation:"미토콘드리아는 세포 호흡에 중요한 역할을 합니다."},
  {id:6,subject:"화학",level:"상",question:"25°C에서 중성 용액의 pH는?",options:["1","5","7","14"],answer:2,explanation:"25°C에서 중성 용액의 pH는 7입니다."},
  {id:7,subject:"물리",level:"상",question:"뉴턴의 제2법칙은?",options:["F = ma","E = mc²","V = IR","p = mv²"],answer:0,explanation:"알짜힘은 질량과 가속도의 곱입니다."},
  {id:8,subject:"지구과학",level:"상",question:"액체 상태의 외핵을 통과하지 못하는 지진파는?",options:["P파","S파","표면파","전자기파"],answer:1,explanation:"S파는 액체를 통과하지 못합니다."}
];

function getUser(req) {
  try {
    const token = req.cookies.sq_token;
    if (!token) return null;
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function requireUser(req, res, next) {
  const user = getUser(req);
  if (!user) return res.status(401).json({error:"로그인이 필요합니다."});
  req.user = user;
  next();
}

app.post("/api/auth/register", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (!/^[a-zA-Z0-9가-힣_-]{2,20}$/.test(username))
    return res.status(400).json({error:"아이디는 2~20자의 한글, 영문, 숫자, _ 또는 -만 사용할 수 있습니다."});
  if (password.length < 8)
    return res.status(400).json({error:"비밀번호는 8자 이상이어야 합니다."});

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = db.prepare(
      "INSERT INTO users (username, password_hash) VALUES (?, ?)"
    ).run(username, hash);

    const user = {id:Number(result.lastInsertRowid), username};
    const token = jwt.sign(user, SECRET, {expiresIn:"7d"});
    res.cookie("sq_token", token, {
      httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV === "production",
      maxAge:7*24*60*60*1000
    });
    res.status(201).json({user});
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE")
      return res.status(409).json({error:"이 아이디는 이미 사용 중입니다."});
    res.status(500).json({error:"회원가입에 실패했습니다."});
  }
});

app.post("/api/auth/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

  if (!row || !(await bcrypt.compare(password, row.password_hash)))
    return res.status(401).json({error:"아이디 또는 비밀번호가 올바르지 않습니다."});

  const user = {id:row.id, username:row.username};
  const token = jwt.sign(user, SECRET, {expiresIn:"7d"});
  res.cookie("sq_token", token, {
    httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV === "production",
    maxAge:7*24*60*60*1000
  });
  res.json({user});
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("sq_token", {httpOnly:true, sameSite:"lax",
    secure:process.env.NODE_ENV === "production"});
  res.json({ok:true});
});

app.get("/api/auth/me", (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({error:"로그인이 필요합니다."});
  res.json({user:{id:user.id, username:user.username}});
});

app.get("/api/questions", requireUser, (req, res) => {
  const subject = req.query.subject || "전체";
  const level = req.query.level || "전체";
  const count = Math.max(1, Math.min(8, Number(req.query.count) || 5));

  let list = questions.filter(q =>
    (subject === "전체" || q.subject === subject) &&
    (level === "전체" || q.level === level)
  );

  list = list.sort(() => Math.random() - 0.5).slice(0, count);
  res.json({questions:list.map(({answer, ...q}) => q)});
});

app.post("/api/quiz/submit", requireUser, (req, res) => {
  const submitted = Array.isArray(req.body.answers) ? req.body.answers : [];
  if (!submitted.length || submitted.length > 8)
    return res.status(400).json({error:"제출할 답안을 확인해 주세요."});

  let score = 0;
  const results = submitted.map(item => {
    const q = questions.find(q => q.id === Number(item.questionId));
    if (!q) return null;
    const correct = Number(item.answer) === q.answer;
    if (correct) score++;
    return {questionId:q.id, correct, explanation:q.explanation};
  }).filter(Boolean);

  if (!results.length)
    return res.status(400).json({error:"유효한 문제가 없습니다."});

  const subject = String(req.body.subject || "전체").slice(0, 40);
  db.prepare(
    "INSERT INTO scores (user_id, subject, score, total) VALUES (?, ?, ?, ?)"
  ).run(req.user.id, subject, score, results.length);

  res.json({score, total:results.length, results});
});

app.get("/api/leaderboard", (req, res) => {
  const leaderboard = db.prepare(`
    SELECT u.username,
      SUM(s.score) AS points,
      COUNT(s.id) AS rounds,
      SUM(s.total) AS answered
    FROM users u JOIN scores s ON s.user_id = u.id
    GROUP BY u.id, u.username
    ORDER BY points DESC, rounds ASC
    LIMIT 50
  `).all();
  res.json({leaderboard});
});

app.use(express.static(root, {index:"index.html"}));

app.get("*", (req, res) => {
  res.sendFile(path.join(root, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SCIENCE QUEST PRO running on port ${PORT}`);
});

const adminLoginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요." }
});

app.post("/api/admin/login", adminLoginLimit, (req, res) => {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const password = req.body?.password;

  if (!configuredPassword || typeof password !== "string") {
    return res.status(503).json({
      error: "관리자 비밀번호가 서버에 설정되지 않았습니다."
    });
  }

  const supplied = Buffer.from(password);
  const expected = Buffer.from(configuredPassword);

  if (
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(supplied, expected)
  ) {
    return res.status(401).json({
      error: "관리자 비밀번호가 올바르지 않습니다."
    });
  }

  const token = jwt.sign(
    { role: "admin" },
    SECRET,
    { expiresIn: "30m" }
  );

  res.json({ token });
});

app.get("/api/admin/stats", (req, res) => {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  let claims;

  try {
    claims = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({
      error: "관리자 인증이 필요합니다."
    });
  }

  if (claims.role !== "admin") {
    return res.status(403).json({
      error: "관리자 권한이 없습니다."
    });
  }

  const users = db.prepare(
    "SELECT COUNT(*) AS count FROM users"
  ).get().count;

  const rounds = db.prepare(
    "SELECT COUNT(*) AS count FROM scores"
  ).get().count;

  const scores = db.prepare(`
    SELECT COALESCE(SUM(score), 0) AS points,
           COALESCE(SUM(total), 0) AS answered
    FROM scores
  `).get();

  const leaderboard = db.prepare(`
    SELECT u.username, SUM(s.score) AS points
    FROM users u
    JOIN scores s ON s.user_id = u.id
    GROUP BY u.id, u.username
    ORDER BY points DESC
    LIMIT 50
  `).all();

  res.json({ users, rounds, scores, leaderboard });
});
