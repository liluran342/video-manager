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
router.post('/', (req, res) => {
    const { name, url } = req.body;

    // 基础校验
    if (!name || !url) {
        return res.status(400).json({ success: false, error: '参数不完整' });
    }

    try {
        // 1. 检查数据库历史记录（是否曾经下载过）
        const existing = db.prepare('SELECT name FROM download_history WHERE url = ?').get(url);
        if (existing) {
            return res.json({ 
                success: false, 
                error: `该 URL 之前已下载过，保存名称为: ${existing.name}` 
            });
        }

        // 2. 检查内存中是否正在运行（是否正在下载中）
        if (downloadStatus[url] && downloadStatus[url].status === 'downloading') {
            return res.json({ success: false, error: '该任务已在下载队列中，请勿重复提交' });
        }

        // 3. 启动异步下载
        const cfg = loadConfig();
        // 调用 Service 层封装好的下载逻辑
        startDownload(name, url, cfg.videoDir);

        res.json({ 
            success: true, 
            message: '下载指令已发送，后台开始执行' 
        });
        
    } catch (err) {
        console.error('Download route error:', err);
        res.status(500).json({ success: false, error: '服务器内部错误' });
    }
});

module.exports = router;