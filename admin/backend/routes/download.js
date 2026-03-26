const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { loadConfig } = require('../utils/configHelper');
const { downloadStatus, startDownload } = require('../services/downloadService');

// 获取所有下载任务状态: GET /api/download/status
router.get('/status', (req, res) => {
    res.json(downloadStatus);
});

// 提交新的下载任务: POST /api/download
// backend/routes/download.js

router.post('/', (req, res) => {
    const { name, url } = req.body;
    if (!name || !url) return res.status(400).json({ success: false, error: 'Missing params' });

    try {
        // 1. Check Database for this URL
        const existing = db.prepare('SELECT status, name FROM download_history WHERE url = ?').get(url);

        if (existing) {
            if (existing.status === 'completed') {
                return res.json({ success: false, error: `Already downloaded as: ${existing.name}` });
            }
            if (existing.status === 'downloading') {
                return res.json({ success: false, error: `This video is currently being downloaded.` });
            }
            // If status is 'failed', we allow the user to try again (continue to code below)
        }

        // 2. Insert into DB immediately with 'downloading' status
        // Use REPLACE so if it 'failed' before, it resets to 'downloading'
        db.prepare(`
            INSERT OR REPLACE INTO download_history (url, name, status, added_at) 
            VALUES (?, ?, ?, ?)
        `).run(url, name, 'downloading', Date.now());

        // 3. Start the actual download process
        const cfg = loadConfig();
        startDownload(name, url, cfg.videoDir);

        res.json({ success: true, message: 'Added to download queue' });
        
    } catch (err) {
        console.error('Download route error:', err);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

module.exports = router;