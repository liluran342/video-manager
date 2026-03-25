//utils/configHelper.js (配置管理)
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = './config.json';

function loadConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        return { videoDir: 'E:\\整理', coverDir: './covers', dbPath: './video.db' };
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

module.exports = { loadConfig, saveConfig, ensureDir };