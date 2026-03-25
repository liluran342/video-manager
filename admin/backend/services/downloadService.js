//services/downloadService.js (下载处理逻辑)
const { spawn } = require('child_process');
const db = require('../db/database');
const { ensureDir } = require('../utils/configHelper');
const path = require('path');

const downloadStatus = {};

function parseProgress(data, url) {
    const text = data.toString('utf-8'); 
    const matches = [...text.matchAll(/([\d\.]+)%/g)];
    if (matches.length > 0) {
        const latestMatch = matches[matches.length - 1][1];
        const percent = parseFloat(latestMatch);
        if (!isNaN(percent) && percent > downloadStatus[url].progress && percent <= 100) {
            downloadStatus[url].progress = percent;
        }
    }
}

function startDownload(name, url, saveDir) {
    ensureDir(saveDir);
    downloadStatus[url] = { name, status: 'downloading', progress: 0 };

    const downloader = spawn('N_m3u8DL-RE.exe', [
        url, 
        '--save-dir', saveDir, 
        '--save-name', name,
        '--auto-select',       
        '--del-after-done',    
        '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    ]);

    downloader.stdout.on('data', data => parseProgress(data, url));
    downloader.stderr.on('data', data => parseProgress(data, url));
    
    downloader.on('close', code => {
        if (code === 0) {
            downloadStatus[url].status = 'completed';
            downloadStatus[url].progress = 100;
            try {
                db.prepare('INSERT INTO download_history (url, name, added_at) VALUES (?, ?, ?)')
                  .run(url, name, Date.now());
            } catch (e) { console.error('DB Insert Error:', e); }
        } else {
            downloadStatus[url].status = 'failed';
        }
    });
}

module.exports = { downloadStatus, startDownload };