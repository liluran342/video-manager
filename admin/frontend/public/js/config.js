//js/config.js (配置模块)
export function loadConfig() {
    fetch('/api/config')
        .then(res => res.json())
        .then(cfg => {
            document.getElementById('videoDir').value = cfg.videoDir || '';
            document.getElementById('coverDir').value = cfg.coverDir || '';
            document.getElementById('dbPath').value = cfg.dbPath || '';
        })
        .catch(err => console.error('Failed to load config', err));
}

export function saveConfig() {
    fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            videoDir: document.getElementById('videoDir').value,
            coverDir: document.getElementById('coverDir').value,
            dbPath: document.getElementById('dbPath').value
        })
    }).then(() => alert('Settings saved!'));
}