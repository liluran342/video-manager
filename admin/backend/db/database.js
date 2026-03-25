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
        added_at INTEGER
    );
`);

// 迁移脚本
try { db.exec("ALTER TABLE videos ADD COLUMN resolution TEXT DEFAULT 'Unknown'"); } catch (e) {}
try { db.exec("ALTER TABLE videos ADD COLUMN progress REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE videos ADD COLUMN added_at INTEGER DEFAULT 0"); } catch (e) {}

module.exports = db;