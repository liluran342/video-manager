//routes/video.js (视频接口)
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const fs = require('fs');
const { loadConfig } = require('../utils/configHelper');
const { scanDirectory } = require('../services/videoService');

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

router.post('/scan', async (req, res) => {
    const cfg = loadConfig();
    res.json({ success: true, message: 'Scan started.' });
    await scanDirectory(cfg.videoDir, cfg.coverDir);
});

module.exports = router;