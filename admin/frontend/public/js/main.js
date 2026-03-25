//js/main.js (入口模块)
import { loadConfig, saveConfig } from './config.js';
import { loadVideos, deleteVideo, scanLibrary } from './library.js';
import { initPlayer, closePlayer } from './player.js';
import { initDownloader, startDownload } from './downloader.js';

// 1. 将内联 HTML (onclick="...") 需要用到的函数挂载到全局对象 window
window.saveConfig = saveConfig;
window.deleteVideo = deleteVideo;
window.scanLibrary = scanLibrary;
window.closePlayer = closePlayer;
window.startDownload = startDownload;

// 2. 页面加载完成后进行初始化
document.addEventListener('DOMContentLoaded', () => {
    initPlayer();
    loadConfig();
    loadVideos();
    initDownloader();
});