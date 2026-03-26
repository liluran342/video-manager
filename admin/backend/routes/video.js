//routes/video.js (视频接口)
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { loadConfig } = require('../utils/configHelper');
const { scanDirectory } = require('../services/videoService');
// Setup Multer for temporary storage
const upload = multer({ dest: 'temp/' });
router.get('/', (req, res) => {
    const videos = db.prepare('SELECT id, name, format, duration, cover, resolution, progress, added_at FROM videos ORDER BY name ASC').all();
    res.json(videos);
});

router.get('/play/:id', (req, res) => {
    const video = db.prepare('SELECT filepath FROM videos WHERE id = ?').get(req.params.id);
    if (video && fs.existsSync(video.filepath)) {
        res.sendFile(video.filepath);
    } else {
        res.status(404).send('Video not found');
    }
});

router.post('/progress/:id', express.json(), (req, res) => {
    const { progress } = req.body;
    db.prepare('UPDATE videos SET progress = ? WHERE id = ?').run(progress, req.params.id);
    res.json({ success: true });
});
// POST /api/videos/cover/:id
router.post('/cover/:id', upload.single('cover'), (req, res) => {
    const videoId = req.params.id;
    const config = loadConfig();

    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image uploaded' });
    }

    try {
        // 1. Get current cover to delete the old file
        const video = db.prepare('SELECT cover FROM videos WHERE id = ?').get(videoId);
        if (!video) return res.status(404).json({ success: false, error: 'Video not found' });

        const oldCoverPath = path.join(config.coverDir, video.cover || '');
        if (video.cover && fs.existsSync(oldCoverPath)) {
            fs.unlinkSync(oldCoverPath); // Delete old cover
        }

        // 2. Move new cover to covers directory
        const newCoverName = crypto.randomUUID() + '.jpg';
        const newCoverPath = path.join(config.coverDir, newCoverName);
        
        fs.renameSync(req.file.path, newCoverPath);

        // 3. Update Database
        db.prepare('UPDATE videos SET cover = ? WHERE id = ?').run(newCoverName, videoId);

        res.json({ success: true, cover: newCoverName });
    } catch (err) {
        console.error('Cover update error:', err);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

router.post('/scan', async (req, res) => {
    const cfg = loadConfig();
    res.json({ success: true, message: 'Scan started.' });
    await scanDirectory(cfg.videoDir, cfg.coverDir);
});

module.exports = router;