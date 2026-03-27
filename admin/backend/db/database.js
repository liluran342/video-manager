//db/database.js (数据库)
const Database = require('better-sqlite3');
const { loadConfig } = require('../utils/configHelper');

const config = loadConfig();
const db = new Database(config.dbPath);

// 初始化表结构
db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        name TEXT,
        format TEXT,
        duration REAL,
        cover TEXT,
        filepath TEXT UNIQUE,
        resolution TEXT,
        progress REAL DEFAULT 0,
        added_at INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS download_history (
        url TEXT PRIMARY KEY,
        name TEXT,
        status TEXT DEFAULT 'downloading', -- downloading, completed, failed
        error_msg TEXT,                  -- 新增：存储失败原因
        added_at INTEGER
    );
`);
// 在 database.js 的 db.exec 中添加：
db.exec(`
    CREATE TABLE IF NOT EXISTS watch_segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT,
        start_time REAL,
        end_time REAL,
        watched_at INTEGER,
        FOREIGN KEY (video_id) REFERENCES videos(id)
    );
    -- 添加索引：大幅提升查询特定视频片段的速度
    CREATE INDEX IF NOT EXISTS idx_segments_video_id ON watch_segments(video_id);
`);
// 迁移脚本
try { db.exec("ALTER TABLE videos ADD COLUMN resolution TEXT DEFAULT 'Unknown'"); } catch (e) {}
try { db.exec("ALTER TABLE videos ADD COLUMN progress REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE videos ADD COLUMN added_at INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE download_history ADD COLUMN status TEXT DEFAULT 'completed'"); } catch (e) {}
// 迁移脚本：增加 source_id 字段，记录它是从哪个视频剪出来的
try { db.exec("ALTER TABLE videos ADD COLUMN source_id TEXT"); } catch (e) {}

module.exports = db;