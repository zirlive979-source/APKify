const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads");
const BUILDS = path.join(ROOT, "builds");
for (const d of [DATA, UPLOADS, BUILDS]) fs.mkdirSync(d, { recursive: true });

const projectsFile = path.join(DATA, "projects.json");
const projects = fs.existsSync(projectsFile)
  ? JSON.parse(fs.readFileSync(projectsFile, "utf8"))
  : {};

function save() {
  fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2));
}

const upload = multer({
  dest: UPLOADS,
  limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 50) * 1024 * 1024 }
});

const ALLOWED_PERMISSIONS = new Set([
  "INTERNET",
  "ACCESS_NETWORK_STATE",
  "RECORD_AUDIO",
  "CAMERA",
  "ACCESS_FINE_LOCATION",
  "READ_MEDIA_IMAGES",
  "READ_MEDIA_VIDEO",
  "BLUETOOTH_CONNECT",
  "POST_NOTIFICATIONS",
  "VIBRATE",
  "WAKE_LOCK"
]);

function safeSlug(s) {
  return String(s || "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function validate(body) {
  const name = String(body.name || "").trim();
  const pkg = String(body.packageName || "").trim();
  const version = String(body.version || "1.0.0").trim();
  const sourceType = body.sourceType;

  if (!name) throw new Error("Nama aplikasi wajib diisi.");
  if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(pkg))
    throw new Error("Package name tidak valid. Contoh: com.example.apkify");
  if (!/^\d+\.\d+\.\d+$/.test(version))
    throw new Error("Versi harus berformat x.y.z.");
  if (!["link", "html", "zip"].includes(sourceType))
    throw new Error("Sumber konten tidak valid.");

  const permissions = Array.isArray(body.permissions)
    ? body.permissions.filter(p => ALLOWED_PERMISSIONS.has(p))
    : [];

  return { name, packageName: pkg, version, sourceType, sourceValue: body.sourceValue || "", permissions };
}

app.post("/api/projects", upload.single("sourceFile"), async (req, res) => {
  try {
    const data = validate(req.body);
    const id = crypto.randomUUID();
    const project = {
      id,
      ...data,
      sourceFile: req.file ? req.file.path : null,
      status: "created",
      message: "Project dibuat.",
      createdAt: new Date().toISOString()
    };
    projects[id] = project;
    save();
    res.json({ ok: true, project: publicProject(project) });
  } catch (e) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post("/api/projects/:id/build", (req, res) => {
  const p = projects[req.params.id];
  if (!p) return res.status(404).json({ ok: false, error: "Project tidak ditemukan." });
  if (p.status === "building") return res.status(409).json({ ok: false, error: "Build sedang berjalan." });

  p.status = "building";
  p.message = "Build dimulai...";
  p.startedAt = new Date().toISOString();
  save();

  const builder = path.join(ROOT, "builder", "build.js");
  execFile(process.execPath, [builder, p.id], { cwd: ROOT }, (error) => {
    if (error) console.error("Builder error:", error);
  });

  res.json({ ok: true, project: publicProject(p) });
});

app.get("/api/projects/:id", (req, res) => {
  const p = projects[req.params.id];
  if (!p) return res.status(404).json({ ok: false, error: "Project tidak ditemukan." });
  res.json({ ok: true, project: publicProject(p) });
});

app.get("/api/projects/:id/download", (req, res) => {
  const p = projects[req.params.id];
  if (!p || p.status !== "done" || !p.apkPath)
    return res.status(404).json({ ok: false, error: "APK belum tersedia." });
  res.download(p.apkPath, `${safeSlug(p.name)}-${p.version}.apk`);
});

function publicProject(p) {
  return {
    id: p.id, name: p.name, packageName: p.packageName, version: p.version,
    sourceType: p.sourceType, permissions: p.permissions,
    status: p.status, message: p.message, createdAt: p.createdAt,
    startedAt: p.startedAt, finishedAt: p.finishedAt,
    download: p.status === "done" ? `/api/projects/${p.id}/download` : null
  };
}

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ ok: false });
  res.sendFile(path.join(ROOT, "public", "index.html"));
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`APKify running on http://localhost:${port}`));
