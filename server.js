const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// 静态文件
app.use(express.static('public'));
app.use('/videos', express.static('videos'));

// 获取视频列表
app.get('/api/videos', (req, res) => {
    const dir = path.join(__dirname, 'videos');

    fs.readdir(dir, (err, files) => {
        if (err) return res.status(500).send('读取失败');

        const videos = files.filter(f => f.endsWith('.mp4'));
        res.json(videos);
    });
});

app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
});