const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const ffmpeg = require('fluent-ffmpeg');
const iconv = require('iconv-lite');
const CONFIG_PATH = './config.json';
// NEW: Store active downloads status in memory
const downloadStatus = {};
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
        progress REAL DEFAULT 0,
        added_at INTEGER DEFAULT 0
    )
`);
// NEW: Create download history table to prevent duplicates
db.exec(`
    CREATE TABLE IF NOT EXISTS download_history (
        url TEXT PRIMARY KEY,
        name TEXT,
        added_at INTEGER
    )
`);
// Add new columns if upgrading from the previous version
try { db.exec("ALTER TABLE videos ADD COLUMN resolution TEXT DEFAULT 'Unknown'"); } catch (e) {}
try { db.exec("ALTER TABLE videos ADD COLUMN progress REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE videos ADD COLUMN added_at INTEGER DEFAULT 0"); } catch (e) {}

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
// NEW API: Check download status
app.get('/api/downloads/status', (req, res) => {
    res.json(downloadStatus);
});


// API: Configf
app.get('/api/config', (req, res) => res.json(loadConfig()));
app.post('/api/config', express.json(), (req, res) => {
    saveConfig(req.body);
    res.json({ success: true });
});

// API: Get Videos
// API: Get Videos
app.get('/api/videos', (req, res) => {
    // Added 'added_at' to the SELECT statement
    const videos = db.prepare('SELECT id, name, format, duration, cover, resolution, progress, added_at FROM videos ORDER BY name ASC').all();
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

         const insertStmt = db.prepare('INSERT INTO videos (id, name, format, duration, cover, filepath, resolution, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const checkStmt = db.prepare('SELECT id FROM videos WHERE filepath = ?');

        for (const file of videos) {
            const filePath = path.join(dir, file);
            if (checkStmt.get(filePath)) continue;

            console.log(`Scanning: ${file}...`);
            const ext = path.extname(file);
            const name = path.basename(file, ext);
            const id = crypto.randomUUID();
              // Get the physical file creation time on the hard drive
            const stat = fs.statSync(filePath);
            const addedAt = stat.birthtimeMs || stat.mtimeMs || Date.now();

               try {
                const info = await extractVideoInfo(filePath, cfg.coverDir);
                // Pass 'addedAt' as the final parameter
                insertStmt.run(id, name, ext.replace('.', ''), info.duration, info.coverName, filePath, info.resolution, addedAt);
                console.log(`Added: ${name}[${info.resolution}]`);
            } catch (err) {
                console.error(`Error processing ${file}:`, err);
            }
        }
        console.log('✅ Scan completed.');
    });
});
// API: Delete Video
// API: Download
app.post('/api/download', express.json(), (req, res) => {
    const { name, url } = req.body;
    if (!name || !url) return res.status(400).json({ success: false });

    // 1. Check if already downloaded in the database
    const existing = db.prepare('SELECT name FROM download_history WHERE url = ?').get(url);
    if (existing) {
        return res.json({ success: false, error: 'This m3u8 URL has already been downloaded previously!' });
    }

    // 2. Check if currently downloading right now
    if (downloadStatus[url] && downloadStatus[url].status === 'downloading') {
        return res.json({ success: false, error: 'This video is currently being downloaded!' });
    }

    const cfg = loadConfig();
    const saveDir = path.resolve(cfg.videoDir); 
    ensureDir(saveDir);

    // Mark as downloading with initial progress 0
    downloadStatus[url] = { name, status: 'downloading', progress: 0 };

    const downloader = spawn('N_m3u8DL-RE.exe',[
        url, 
        '--save-dir', saveDir, 
        '--save-name', name,
        '--auto-select',       
        '--del-after-done',    
        '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    ]);

    // Parse progress from stdout
    downloader.stdout.on('data', data => {
        const text = iconv.decode(data, 'gbk');
        
        // Regex to find percentages like "45.2%" or "100%"
        const match = text.match(/([\d\.]+)%/);
        if (match) {
            downloadStatus[url].progress = parseFloat(match[1]);
        }
    });

    // Parse progress from stderr (sometimes N_m3u8DL-RE outputs progress here)
    downloader.stderr.on('data', data => {
        const text = iconv.decode(data, 'gbk');
        
        const match = text.match(/([\d\.]+)%/);
        if (match) {
            downloadStatus[url].progress = parseFloat(match[1]);
        }
    });
    
    // 3. Handle completion and save to database
    downloader.on('close', code => {
        console.log(`Download "${name}" finished with code ${code}.`);
        if (code === 0) {
            downloadStatus[url].status = 'completed';
            downloadStatus[url].progress = 100;
            try {
                // Save to download history
                db.prepare('INSERT INTO download_history (url, name, added_at) VALUES (?, ?, ?)').run(url, name, Date.now());
            } catch (e) { console.error('DB Insert Error:', e); }
        } else {
            downloadStatus[url].status = 'failed';
        }
    });

    res.json({ success: true, message: 'Download started in background.' });
});
app.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}`);
});