const express = require('express');
const path = require('path');
const { loadConfig, ensureDir } = require('./utils/configHelper');
const qrcode = require('qrcode-terminal'); // 在文件顶部引入

const app = express();
const PORT = 3000;
const os = require('os'); // Added for IP detection
const config = loadConfig();
// 1. Get Local IP Address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (let dev in interfaces) {
    for (let item of interfaces[dev]) {
      // In some Node versions, item.family is a string 'IPv4', in others it's a number 4
      if ((item.family === 'IPv4' || item.family === 4) && !item.internal) {
        return item.address;
      }
    }
  }
  return 'localhost';
}

const ip = getLocalIP();
// 确保目录存在
ensureDir(config.videoDir);
ensureDir(config.coverDir);

app.use(express.static(path.join(__dirname, '../../client/pc')));

// 2. 将后台管理系统挂载到 /admin (http://localhost:3000/admin)
app.use('/admin', express.static(path.join(__dirname, '../frontend/public')));
// 静态文件

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

app.listen(PORT, '0.0.0.0', () => {
    const mobileUrl = `http://${ip}:${PORT}`;
    
    console.log(`=============================================`);
    console.log(`🚀 服务器已启动！`);
    console.log(`🏠 本地访问:  http://localhost:${PORT}`);
    console.log(`🛠️  后台管理:  http://localhost:${PORT}/admin`);
    console.log(`📱 手机访问: ${mobileUrl}`);
    console.log(`---------------------------------------------`);
    console.log(`请使用手机扫描下方二维码直接访问：`);
    
    // 在终端生成小尺寸二维码
    qrcode.generate(mobileUrl, { small: true });
    
    console.log(`=============================================`);
});