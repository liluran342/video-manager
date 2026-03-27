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
// backend/routes/video.js

// 修改后的 GET /api/videos 路由
// routes/video.js
router.get('/', (req, res) => {
    const { sourceId, filterType } = req.query; 
    
    let sql = `
        SELECT 
            v1.id, v1.name, v1.filepath AS path, v1.format, v1.duration, 
            v1.cover, v1.resolution, v1.progress, v1.added_at, v1.source_id,
            (SELECT COUNT(*) FROM videos v2 WHERE v2.source_id = v1.id) AS clip_count
        FROM videos v1
    `;

    const params = [];
    const conditions = [];

    // 1. 指定查看某个视频的片段
    if (sourceId) {
        conditions.push("v1.source_id = ?");
        params.push(sourceId);
    } 
    // 2. 筛选器类型逻辑
    else if (filterType === 'originals') {
        conditions.push("v1.source_id IS NULL"); // 完整视频没有来源 ID
    } else if (filterType === 'clips') {
        conditions.push("v1.source_id IS NOT NULL"); // 片段必有来源 ID
    }

    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY v1.added_at DESC";

    const videos = db.prepare(sql).all(params);
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
// 删除视频路由: DELETE /api/videos/:id
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    // 获取前端传来的参数：是否彻底删除文件
    const deletePhysicalFile = req.query.deleteFile === 'true'; 

    try {
        // 1. 查询视频信息以获取路径
        const video = db.prepare('SELECT filepath, cover FROM videos WHERE id = ?').get(id);

        if (!video) {
            return res.status(404).json({ success: false, error: 'Video not found' });
        }

        // 2. 从数据库删除记录
        db.prepare('DELETE FROM videos WHERE id = ?').run(id);

        // 3. 如果需要，删除物理文件
        if (deletePhysicalFile && video.filepath) {
            if (fs.existsSync(video.filepath)) {
                fs.unlinkSync(video.filepath); // 💡 删除视频文件
                console.log(`[File] Physically deleted: ${video.filepath}`);
            }
        }

        // 4. 自动删除关联的封面图 (建议总是删除封面，节省空间)
        if (video.cover) {
            // 这里的路径需要根据你的 configHelper.js 里的 coverDir 来定
            // 假设封面在 backend/covers 下
            const coverPath = path.join(__dirname, '../covers', video.cover); 
            if (fs.existsSync(coverPath)) {
                fs.unlinkSync(coverPath);
            }
        }

        res.json({ success: true, message: 'Deleted successfully' });
        
    } catch (err) {
        console.error('Delete error:', err);
        res.status(500).json({ success: false, error: 'Failed to delete' });
    }
});

module.exports = router;