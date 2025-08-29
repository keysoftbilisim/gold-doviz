import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const __dirname = path.resolve();

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "change_me_please";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 60000);
const DB_FILE = path.join(__dirname, "db.json");

app.use(helmet());
app.use(express.json({limit: "1mb"}));
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(morgan("dev"));

function readDB(){
  try { return JSON.parse(fs.readFileSync(DB_FILE,"utf-8")); }
  catch(e){
    const seed = {
      users: [],
      settings: { siteTitle: "Altin & Doviz - Dashboard" },
      prices: {
        "gram": { alis: 3530, satis: 3600 },
        "ons": { alis: 2360.5, satis: 2365.0 },
        "usd": { alis: 33.497, satis: 33.55 }
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed,null,2));
    return seed;
  }
}
function writeDB(d){ fs.writeFileSync(DB_FILE, JSON.stringify(d,null,2)); }

(function ensureAdmin(){
  const db = readDB();
  if (!db.users.some(u=>u.role==="admin")){
    const user = { username: process.env.ADMIN_USER||"admin", passHash: bcrypt.hashSync(process.env.ADMIN_PASS||"admin123",10), role: "admin", preferences:{clockMode:"text", clockText:"Hosgeldiniz!", clockImageUrl:""} };
    db.users.push(user);
    writeDB(db);
    console.log("[seed] admin created:", user.username);
  }
})();

function sign(u){ return jwt.sign({ username: u.username, role: u.role }, JWT_SECRET, { expiresIn: "12h" }); }
function auth(req,res,next){
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if(!token) return res.status(401).json({error:"Unauthorized"});
  try{ req.user = jwt.verify(token, JWT_SECRET); next(); } catch(e){ res.status(401).json({error:"Invalid token"}); }
}

app.post("/api/auth/login", (req,res)=>{
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find(u => u.username === username);
  if(!user) return res.status(401).json({error:"Invalid"});
  if(!bcrypt.compareSync(password, user.passHash)) return res.status(401).json({error:"Invalid"});
  const token = sign(user);
  res.json({ token, user: { username: user.username, role: user.role } });
});

app.get("/api/me", auth, (req,res)=>{
  const db = readDB();
  const user = db.users.find(u=>u.username===req.user.username);
  if(!user) return res.status(404).json({error:"Not found"});
  res.json({ username: user.username, role: user.role, preferences: user.preferences });
});

app.post("/api/me/preferences", auth, (req,res)=>{
  const { clockMode, clockText, clockImageUrl } = req.body;
  const db = readDB();
  const idx = db.users.findIndex(u=>u.username===req.user.username);
  if(idx===-1) return res.status(404).json({error:"User not found"});
  db.users[idx].preferences = { clockMode: clockMode||db.users[idx].preferences.clockMode, clockText: clockText ?? db.users[idx].preferences.clockText, clockImageUrl: clockImageUrl ?? db.users[idx].preferences.clockImageUrl };
  writeDB(db);
  res.json({ ok:true });
});

let marketCache = {data:null, ts:0};
async function fetchMarket(){
  const now = Date.now();
  if(marketCache.data && now - marketCache.ts < CACHE_TTL_MS) return marketCache.data;
  try{
    const tr = await fetch("https://finans.truncgil.com/today.json", {timeout:10000});
    const trj = await tr.json();
    const gpAlt = await fetch("https://api.genelpara.com/embed/altin.json").then(r=>r.json());
    const gpDov = await fetch("https://api.genelpara.com/embed/doviz.json").then(r=>r.json());
    const data = { fetchedAt: new Date().toISOString(), truncgil: trj, genelpara: { altin: gpAlt, doviz: gpDov } };
    marketCache = { data, ts: now };
    return data;
  }catch(e){
    return { error: String(e) };
  }
}

app.get("/api/prices", auth, async (req,res)=>{
  const db = readDB();
  const market = await fetchMarket();
  res.json({ prices: db.prices, settings: db.settings, market });
});

app.post("/api/admin/prices", auth, (req,res)=>{
  const db = readDB();
  const u = db.users.find(x=>x.username===req.user.username);
  if(u?.role!=="admin") return res.status(403).json({error:"Admin required"});
  const { prices } = req.body;
  if(!prices) return res.status(400).json({error:"prices required"});
  db.prices = prices;
  writeDB(db);
  res.json({ ok:true });
});

app.listen(PORT, ()=> console.log("Backend running on port", PORT));
