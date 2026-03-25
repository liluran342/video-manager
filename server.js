const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const CONFIG_PATH = './config.json';

// Read config
function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        return { videoDir: './videos', coverDir: './covers', dbPath: './video.db' };
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

// Serve static files
app.use(express.static('public'));

app.use('/videos', (req, res, next) => {
    const config = loadConfig();
    ensureDir(config.videoDir);
    ensureDir(config.coverDir);
    express.static(config.videoDir)(req, res, next);
});

// Get config
app.get('/api/config', (req, res) => {
    res.json(loadConfig());
});

// Update config
app.post('/api/config', express.json(), (req, res) => {
    const newConfig = req.body;
    saveConfig(newConfig);
    res.json({ success: true });
});

// Get video list
app.get('/api/videos', (req, res) => {
    const config = loadConfig();
    const dir = path.resolve(config.videoDir);
    
    ensureDir(dir);

    fs.readdir(dir, (err, files) => {
        if (err) return res.status(500).send('Read failed');

        const videos = files.filter(f => f.endsWith('.mp4'));
        res.json(videos);
    });
});

// Download video via N_m3u8DL-RE.exe
app.post('/api/download', express.json(), (req, res) => {
    const { name, url } = req.body;
    
    if (!name || !url) {
        return res.status(400).json({ success: false, error: 'Name and URL are required' });
    }

    const config = loadConfig();
    // Use videoDir from config directly for downloads
    const saveDir = path.resolve(config.videoDir); 
    ensureDir(saveDir);

    console.log(`Starting download: ${name} from ${url}`);
    console.log(`Saving to directory: ${saveDir}`);
    
    // Spawn N_m3u8DL-RE.exe
    const downloader = spawn('N_m3u8DL-RE.exe',[
        url,
        '--save-dir', saveDir,
        '--save-name', name
    ]);

    // Log the output to the server console
    downloader.stdout.on('data', (data) => {
        console.log(`[m3u8DL] ${data.toString().trim()}`);
    });

    downloader.stderr.on('data', (data) => {
        console.error(`[m3u8DL Error] ${data.toString().trim()}`);
    });

    downloader.on('close', (code) => {
        console.log(`Download process for "${name}" exited with code ${code}`);
    });

    res.json({ success: true, message: 'Download started in the background' });
});

app.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}`);
});