const express = require('express');
const path = require('path');
const { loadConfig, ensureDir } = require('./utils/configHelper');

const app = express();
const PORT = 3000;
const config = loadConfig();

// 确保目录存在
ensureDir(config.videoDir);
ensureDir(config.coverDir);

// 静态文件
app.use(express.static(
  path.join(__dirname, '../frontend/public')
));
app.use('/covers', express.static(config.coverDir));
app.use(express.json());

// 路由拆分
const configRoutes = require('./routes/config');
const videoRoutes = require('./routes/video');
const downloadRoutes = require('./routes/download');

app.use('/api/config', configRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/download', downloadRoutes);  // 处理 /api/download (POST)
app.use('/api/downloads', downloadRoutes); // 处理 /api/downloads/status (GET)

// 特殊路由（播放与进度在 video 路由里已处理，注意前缀）
// 如果你希望保持原样 API，可以这样映射：
app.use('/api', videoRoutes); // 包含 /api/play/:id 和 /api/progress/:id

app.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}`);
});