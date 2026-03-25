const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const ffmpeg = require('fluent-ffmpeg');

const CONFIG_PATH = './config.json';

// Read config
function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        return { videoDir: 'E:\\整理', coverDir: './covers', dbPath: './video.db' };
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

// Save config
function saveConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

const app = express();
const PORT = 3000;

const config = loadConfig();
ensureDir(config.videoDir);
ensureDir(config.coverDir);

// Initialize Database
const db = new Database(config.dbPath);
db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        name TEXT,
        format TEXT,
        duration REAL,
        cover TEXT,
        filepath TEXT UNIQUE
    )
`);

// Serve static files (Frontend & Covers)
app.use(express.static('public'));
app.use('/covers', express.static(config.coverDir));

// Helper: Extract Video Info using FFmpeg
function extractVideoInfo(filePath, coverDir) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return resolve({ duration: 0, coverName: null });
            
            const duration = metadata.format.duration;
            const coverName = crypto.randomUUID() + '.jpg';
            
            ffmpeg(filePath)
                .on('end', () => resolve({ duration, coverName }))
                .on('error', () => resolve({ duration, coverName: null }))
                .screenshots({
                    timestamps:['20%'], // Take thumbnail at 20% of the video
                    filename: coverName,
                    folder: coverDir,
                    size: '320x240'
                });
        });
    });
}

// API: Get Config
app.get('/api/config', (req, res) => res.json(loadConfig()));
app.post('/api/config', express.json(), (req, res) => {
    saveConfig(req.body);
    res.json({ success: true });
});

// API: Get Videos from Database
app.get('/api/videos', (req, res) => {
    const videos = db.prepare('SELECT id, name, format, duration, cover FROM videos ORDER BY name ASC').all();
    res.json(videos);
});

// API: Play Video by ID
app.get('/api/play/:id', (req, res) => {
    const video = db.prepare('SELECT filepath FROM videos WHERE id = ?').get(req.params.id);
    if (video && fs.existsSync(video.filepath)) {
        res.sendFile(video.filepath); // Express handles video streaming automatically
    } else {
        res.status(404).send('Video not found');
    }
});

// API: Scan Directory and Add to Database
app.post('/api/scan', (req, res) => {
    const cfg = loadConfig();
    const dir = path.resolve(cfg.videoDir);
    ensureDir(dir);

    fs.readdir(dir, async (err, files) => {
        if (err) return res.status(500).json({ success: false, error: 'Failed to read directory' });

        const videos = files.filter(f => f.endsWith('.mp4') || f.endsWith('.mkv'));
        res.json({ success: true, message: `Scanning ${videos.length} videos in the background... Check console.` });

        const insertStmt = db.prepare('INSERT INTO videos (id, name, format, duration, cover, filepath) VALUES (?, ?, ?, ?, ?, ?)');
        const checkStmt = db.prepare('SELECT id FROM videos WHERE filepath = ?');

        for (const file of videos) {
            const filePath = path.join(dir, file);
            
            // Skip if already in database
            if (checkStmt.get(filePath)) continue;

            console.log(`Scanning: ${file}...`);
            const ext = path.extname(file);
            const name = path.basename(file, ext);
            const id = crypto.randomUUID();

            try {
                const info = await extractVideoInfo(filePath, cfg.coverDir);
                insertStmt.run(id, name, ext.replace('.', ''), info.duration, info.coverName, filePath);
                console.log(`Added to DB: ${name}`);
            } catch (err) {
                console.error(`Error processing ${file}:`, err);
            }
        }
        console.log('✅ Background scan completed.');
    });
});

// API: Download Video
app.post('/api/download', express.json(), (req, res) => {
    const { name, url } = req.body;
    if (!name || !url) return res.status(400).json({ success: false });

    const cfg = loadConfig();
    const saveDir = path.resolve(cfg.videoDir); 
    ensureDir(saveDir);

    const downloader = spawn('N_m3u8DL-RE.exe',[url, '--save-dir', saveDir, '--save-name', name]);

    downloader.stdout.on('data', data => console.log(`[m3u8DL] ${data.toString().trim()}`));
    downloader.on('close', code => console.log(`Download "${name}" finished with code ${code}`));

    res.json({ success: true, message: 'Download started in background.' });
});

app.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}`);
});