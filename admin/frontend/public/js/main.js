//js/main.js (入口模块)
import { loadConfig, saveConfig } from './config.js';
import { loadVideos, deleteVideo, scanLibrary } from './library.js';

import { playVideo, closePlayer, initPlayer, captureCover } from './player.js';

window.captureCover = captureCover; // Add this line
// ... other window assignments
import { addToPlan, startBatch, startDownload, initDownloader } from './downloader.js';
// 在顶部引入
import { startClipping, initClipper,prepareClip } from './clipper.js';




// 1. 将内联 HTML (onclick="...") 需要用到的函数挂载到全局对象 window
window.saveConfig = saveConfig;
window.deleteVideo = deleteVideo;
window.scanLibrary = scanLibrary;
window.addToPlan = addToPlan;
window.startBatch = startBatch;
window.closePlayer = closePlayer;
window.startDownload = startDownload;
window.captureCover = captureCover; // Add this line
// 挂载到 window
window.prepareClip = prepareClip;
window.startClipping = startClipping;
window.playVideo = playVideo; 


// 2. 页面加载完成后进行初始化
document.addEventListener('DOMContentLoaded', () => {
    initPlayer();
    loadConfig();
    loadVideos();
    initClipper();
    initDownloader();
});