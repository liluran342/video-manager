//services/videoService.js (视频处理逻辑)
const ffmpeg = require('fluent-ffmpeg');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');

async function extractVideoInfo(filePath, coverDir) {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return resolve({ duration: 0, coverName: null, resolution: 'Unknown' });
            
            const duration = metadata.format.duration;
            const coverName = crypto.randomUUID() + '.jpg';
            
            let resolution = 'Unknown';
            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            if (videoStream && videoStream.height) {
                if (videoStream.height >= 2160) resolution = '4K';
                else if (videoStream.height >= 1080) resolution = '1080p';
                else if (videoStream.height >= 720) resolution = '720p';
                else resolution = `${videoStream.width}x${videoStream.height}`;
            }
            
            ffmpeg(filePath)
                .on('end', () => resolve({ duration, coverName, resolution }))
                .on('error', () => resolve({ duration, coverName: null, resolution }))
                .screenshots({
                    timestamps: ['20%'], 
                    filename: coverName,
                    folder: coverDir,
                    size: '320x240'
                });
        });
    });
}

async function scanDirectory(videoDir, coverDir) {
    const dir = path.resolve(videoDir);
    const files = fs.readdirSync(dir);
    const videos = files.filter(f => f.endsWith('.mp4') || f.endsWith('.mkv'));

    const insertStmt = db.prepare('INSERT INTO videos (id, name, format, duration, cover, filepath, resolution, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const checkStmt = db.prepare('SELECT id FROM videos WHERE filepath = ?');

    for (const file of videos) {
        const filePath = path.join(dir, file);
        if (checkStmt.get(filePath)) continue;

        const ext = path.extname(file);
        const name = path.basename(file, ext);
        const id = crypto.randomUUID();
        const stat = fs.statSync(filePath);
        const addedAt = stat.birthtimeMs || stat.mtimeMs || Date.now();

        try {
            const info = await extractVideoInfo(filePath, coverDir);
            insertStmt.run(id, name, ext.replace('.', ''), info.duration, info.coverName, filePath, info.resolution, addedAt);
        } catch (err) {
            console.error(`Error processing ${file}:`, err);
        }
    }
}

module.exports = { extractVideoInfo, scanDirectory };