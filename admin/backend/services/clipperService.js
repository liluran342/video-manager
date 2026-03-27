const { spawn, execSync } = require('child_process'); // 👈 必须在这里加上 execSync
const path = require('path');
const fs = require('fs');
const db = require('../db/database'); // 确保引入了 db
// 1. 引入配置加载工具
const { loadConfig } = require('../utils/configHelper');
// 💡 辅助函数：提取视频第一秒的画面作为封面
function extractCover(videoPath, taskId) {
    try {
        const config = loadConfig(); // 2. 获取全局配置
        const coverName = `${taskId}.jpg`;
        
        // 3. 使用配置中的 coverDir (通常是项目根目录下的 ./covers)
        // 使用 path.resolve 确保路径相对于进程运行的根目录
        const coverPath = path.resolve(config.coverDir, coverName);
        
        const coverDir = path.dirname(coverPath);
        if (!fs.existsSync(coverDir)) fs.mkdirSync(coverDir, { recursive: true });

        const cmd = `ffmpeg -ss 00:00:01 -i "${videoPath}" -vframes 1 -q:v 2 -y "${coverPath}"`;
        execSync(cmd);
        
        return coverName;
    } catch (e) {
        console.error("[Clipper] Failed to extract cover:", e.message);
        return null;
    }
}

// 💡 辅助函数：使用 ffprobe 获取视频时长
function getVideoDuration(filepath) {
    try {
        // 使用双引号包裹路径，防止空格导致报错
        // -v error: 只显示错误
        // -show_entries format=duration: 只提取时长
        const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filepath}"`;
        
        // execSync 现在已经定义了，可以正常调用
        const durationStr = execSync(cmd).toString().trim();
        const duration = parseFloat(durationStr);
        
        return isNaN(duration) ? 0 : duration;
    } catch (e) {
        console.error("[ffprobe] Error getting duration:", e.message);
        return 0;
    }
}
// 修改后的 processClipTask 接收 sourceId
function processClipTask(videoPath, startTime, endTime, sourceId) {
    return new Promise((resolve, reject) => {
        const taskId = Date.now().toString();
        const ext = path.extname(videoPath);
        const baseName = path.basename(videoPath, ext);
        const saveDir = path.dirname(videoPath);
        const newFileName = `${baseName}_clip_${taskId}${ext}`;
        const outputPath = path.join(saveDir, newFileName);

        const args = ['-ss', startTime, '-to', endTime, '-i', videoPath, '-c', 'copy', '-y', outputPath];
        const ffmpeg = spawn('ffmpeg', args);

        ffmpeg.on('close', (code) => {
            if (code === 0) {
                try {
                    // 1. 获取时长
                    const realDuration = getVideoDuration(outputPath);
                    
                    // 2. 💡 核心修改：提取封面
                    const coverName = extractCover(outputPath, taskId);

                    // 3. 写入数据库，包含 cover 字段
                    db.prepare(`
                        INSERT INTO videos (id, name, filepath, format, duration, cover, source_id, added_at) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        taskId, 
                        `[Clip] ${baseName}`, 
                        outputPath, 
                        ext.replace('.',''), 
                        realDuration, 
                        coverName, // 👈 存入封面文件名
                        sourceId, 
                        Date.now()
                    );
                    
                    console.log(`[Clipper] Task completed. Duration: ${realDuration}s, Cover: ${coverName}`);
                    resolve({ taskId, outputPath });
                } catch (dbErr) {
                    reject(dbErr);
                }
            } else {
                reject(new Error(`FFmpeg exited with code ${code}`));
            }
        });
    });
}

module.exports = { processClipTask };