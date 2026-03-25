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

function saveConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const app = express();
const PORT = 3000;

const config = loadConfig();
ensureDir(config.videoDir);
ensureDir(config.coverDir);

// Initialize Database & Auto-Migrate schema
const db = new Database(config.dbPath);
db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        name TEXT,
        format TEXT,
        duration REAL,
        cover TEXT,
        filepath TEXT UNIQUE,
        resolution TEXT,
        progress REAL DEFAULT 0
    )
`);

// Add new columns if upgrading from the previous version
try { db.exec("ALTER TABLE videos ADD COLUMN resolution TEXT DEFAULT 'Unknown'"); } catch (e) {}
try { db.exec("ALTER TABLE videos ADD COLUMN progress REAL DEFAULT 0"); } catch (e) {}

app.use(express.static('public'));
app.use('/covers', express.static(config.coverDir));

// Helper: Extract Video Info using FFmpeg
function extractVideoInfo(filePath, coverDir) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return resolve({ duration: 0, coverName: null, resolution: 'Unknown' });
            
            const duration = metadata.format.duration;
            const coverName = crypto.randomUUID() + '.jpg';
            
            // Extract Resolution
            let resolution = 'Unknown';
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            if (videoStream && videoStream.height) {
                if (videoStream.height >= 2160) resolution = '4K';
                else if (videoStream.height >= 1080) resolution = '1080p';
                else if (videoStream.height >= 720) resolution = '720p';
                else resolution = `${videoStream.width}x${videoStream.height}`;
            }
            
            ffmpeg(filePath)
                .on('end', () => resolve({ duration, coverName, resolution }))
                .on('error', () => resolve({ duration, coverName: null, resolution }))
                .screenshots({
                    timestamps: ['20%'], 
                    filename: coverName,
                    folder: coverDir,
                    size: '320x240'
                });
        });
    });
}

// API: Config
app.get('/api/config', (req, res) => res.json(loadConfig()));
app.post('/api/config', express.json(), (req, res) => {
    saveConfig(req.body);
    res.json({ success: true });
});

// API: Get Videos
app.get('/api/videos', (req, res) => {
    const videos = db.prepare('SELECT id, name, format, duration, cover, resolution, progress FROM videos ORDER BY name ASC').all();
    res.json(videos);
});

// API: Play Video
app.get('/api/play/:id', (req, res) => {
    const video = db.prepare('SELECT filepath FROM videos WHERE id = ?').get(req.params.id);
    if (video && fs.existsSync(video.filepath)) {
        res.sendFile(video.filepath);
    } else {
        res.status(404).send('Video not found');
    }
});

// API: Save Playback Progress
app.post('/api/progress/:id', express.json(), (req, res) => {
    const { progress } = req.body;
    db.prepare('UPDATE videos SET progress = ? WHERE id = ?').run(progress, req.params.id);
    res.json({ success: true });
});

// API: Scan Directory
app.post('/api/scan', (req, res) => {
    const cfg = loadConfig();
    const dir = path.resolve(cfg.videoDir);
    ensureDir(dir);

    fs.readdir(dir, async (err, files) => {
        if (err) return res.status(500).json({ success: false, error: 'Failed to read directory' });

        const videos = files.filter(f => f.endsWith('.mp4') || f.endsWith('.mkv'));
        res.json({ success: true, message: `Scanning ${videos.length} videos... Check console.` });

        const insertStmt = db.prepare('INSERT INTO videos (id, name, format, duration, cover, filepath, resolution) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const checkStmt = db.prepare('SELECT id FROM videos WHERE filepath = ?');

        for (const file of videos) {
            const filePath = path.join(dir, file);
            if (checkStmt.get(filePath)) continue;

            console.log(`Scanning: ${file}...`);
            const ext = path.extname(file);
            const name = path.basename(file, ext);
            const id = crypto.randomUUID();

            try {
                const info = await extractVideoInfo(filePath, cfg.coverDir);
                insertStmt.run(id, name, ext.replace('.', ''), info.duration, info.coverName, filePath, info.resolution);
                console.log(`Added: ${name} [${info.resolution}]`);
            } catch (err) {
                console.error(`Error processing ${file}:`, err);
            }
        }
        console.log('✅ Scan completed.');
    });
});
// API: Delete Video
app.delete('/api/videos/:id', (req, res) => {
    const id = req.params.id;
    const cfg = loadConfig();
    
    // Fetch video info to get file paths
    const video = db.prepare('SELECT filepath, cover FROM videos WHERE id = ?').get(id);
    if (!video) return res.status(404).json({ success: false, error: 'Video not found' });

    // 1. Delete physical video file
    if (fs.existsSync(video.filepath)) {
        try { fs.unlinkSync(video.filepath); } 
        catch (e) { console.error('Failed to delete video file:', e); }
    }

    // 2. Delete physical cover image
    if (video.cover) {
        const coverPath = path.join(cfg.coverDir, video.cover);
        if (fs.existsSync(coverPath)) {
            try { fs.unlinkSync(coverPath); } 
            catch (e) { console.error('Failed to delete cover file:', e); }
        }
    }

    // 3. Delete from database
    db.prepare('DELETE FROM videos WHERE id = ?').run(id);

    console.log(`Deleted video: ${video.filepath}`);
    res.json({ success: true, message: 'Video deleted' });
});

// API: Download
app.post('/api/download', express.json(), (req, res) => {
    const { name, url } = req.body;
    if (!name || !url) return res.status(400).json({ success: false });

    const cfg = loadConfig();
    const saveDir = path.resolve(cfg.videoDir); 
    ensureDir(saveDir);

    const downloader = spawn('N_m3u8DL-RE.exe',[url, '--save-dir', saveDir, '--save-name', name]);

    downloader.stdout.on('data', data => console.log(`[m3u8DL] ${data.toString().trim()}`));
    downloader.on('close', code => console.log(`Download "${name}" finished.`));

    res.json({ success: true, message: 'Download started.' });
});

app.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}`);
});