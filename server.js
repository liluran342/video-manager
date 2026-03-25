const express = require('express');
const fs = require('fs');
const path = require('path');
const CONFIG_PATH = './config.json';

// 读取配置
function loadConfig() {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

// 保存配置
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

// 静态文件
app.use(express.static('public'));
app.use('/videos', (req, res, next) => {
    const config = loadConfig();
ensureDir(config.videoDir);
ensureDir(config.coverDir);
    express.static(config.videoDir)(req, res, next);
});
// 获取配置
app.get('/api/config', (req, res) => {
    res.json(loadConfig());
});

// 更新配置
app.post('/api/config', express.json(), (req, res) => {
    const newConfig = req.body;
    saveConfig(newConfig);
    res.json({ success: true });
});
// 获取视频列表
app.get('/api/videos', (req, res) => {
    const config = loadConfig();
const dir = path.resolve(config.videoDir);

    fs.readdir(dir, (err, files) => {
        if (err) return res.status(500).send('读取失败');

        const videos = files.filter(f => f.endsWith('.mp4'));
        res.json(videos);
    });
});

app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
});