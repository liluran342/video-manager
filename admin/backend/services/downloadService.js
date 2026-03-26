// backend/services/downloadService.js
const { spawn } = require('child_process');
const db = require('../db/database');
const { ensureDir } = require('../utils/configHelper');
const path = require('path');

const EXE_PATH = path.join(__dirname, '..', 'N_m3u8DL-RE.exe');
const downloadStatus = {};
const downloadQueue = []; // Tasks waiting to start
let activeDownloads = 0;
const MAX_CONCURRENT = 2; // Limit to 2 downloads at a time

function startDownload(name, url, saveDir) {
    // 1. Sanitize and Prepare
    const safeName = name.trim().replace(/[\\\/:*?"<>|]/g, '_');
    
    // 2. Add to status map as 'waiting'
    downloadStatus[url] = { 
        name: safeName, 
        status: 'waiting', 
        progress: 0, 
        logs: [], 
        errorMsg: null 
    };

    // 3. Add to the internal queue
    downloadQueue.push({ name: safeName, url, saveDir });
    
    // 4. Try to process the queue
    processQueue();
}

function processQueue() {
    if (activeDownloads >= MAX_CONCURRENT || downloadQueue.length === 0) return;

    const task = downloadQueue.shift();
    const { name, url, saveDir } = task;

    activeDownloads++;
    downloadStatus[url].status = 'downloading';

    ensureDir(saveDir);

    // Determine Referer (Adjust logic as needed)
    const referer = url.includes('surrit.com') ? 'https://missav.ai/' : '';

    const downloader = spawn(EXE_PATH, [
        url, 
        '--save-dir', saveDir, 
        '--save-name', name,
        '--auto-select',       
        '--del-after-done',
        '--no-ansi-color',
        '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        '-H', `Referer: ${referer}`
    ]);

    downloader.stdout.on('data', data => parseProgress(data, url));
    downloader.stderr.on('data', data => {
        const text = data.toString();
        if (downloadStatus[url]) {
            downloadStatus[url].logs.push(text);
            if (downloadStatus[url].logs.length > 5) downloadStatus[url].logs.shift();
        }
    });

    downloader.on('close', code => {
        activeDownloads--;
        if (downloadStatus[url]) {
            if (code === 0) {
                downloadStatus[url].status = 'completed';
                downloadStatus[url].progress = 100;
                try {
                    db.prepare('INSERT INTO download_history (url, name, added_at) VALUES (?, ?, ?)')
                      .run(url, name, Date.now());
                } catch (e) {}
            } else {
                downloadStatus[url].status = 'failed';
                downloadStatus[url].errorMsg = downloadStatus[url].logs.join('\n');
            }
        }
        
        // Clean up memory after 1 minute
        setTimeout(() => { delete downloadStatus[url]; }, 60000);
        
        // Start next task in queue
        processQueue();
    });
}

// ... Keep your parseProgress function here ...
function parseProgress(data, url) {
    const text = data.toString('utf-8');
    const match = text.match(/([\d\.]+)%/); 
    if (match && downloadStatus[url]) {
        const percent = parseFloat(match[1]);
        if (!isNaN(percent) && percent > downloadStatus[url].progress) {
            downloadStatus[url].progress = percent;
        }
    }
}

module.exports = { downloadStatus, startDownload };