const express = require('express');
const router = express.Router();
const { loadConfig, saveConfig } = require('../utils/configHelper');

// 获取当前配置: GET /api/config
router.get('/', (req, res) => {
    try {
        const config = loadConfig();
        res.json(config);
    } catch (err) {
        res.status(500).json({ success: false, error: '无法读取配置文件' });
    }
});

// 保存新配置: POST /api/config
router.post('/', (req, res) => {
    try {
        const newConfig = req.body;
        // 简单校验
        if (!newConfig.videoDir || !newConfig.dbPath) {
            return res.status(400).json({ success: false, error: '配置参数不完整' });
        }
        saveConfig(newConfig);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: '保存配置文件失败' });
    }
});

module.exports = router;