// public/js/clipper.js
let currentSourceId = null; // 🔑 增加一个变量记录来源 ID

export function startClipping() {
    const videoPath = document.getElementById('clipVideoPath').value;
    const startTime = document.getElementById('clipStart').value;
    const endTime = document.getElementById('clipEnd').value;
    const statusDiv = document.getElementById('clipperStatus');

    if (!startTime || !endTime) return alert('Please set Start and End times');

    statusDiv.innerHTML = `<p style="color: var(--primary-blue);">⏳ Processing...</p>`;

    fetch('/api/clipper/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath, startTime, endTime, sourceId: currentSourceId })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            statusDiv.innerHTML = `<p style="color: #27ae60;">✅ Success! Check Library later.</p>`;
            // 提示用户任务已提交，可以关闭弹窗
            setTimeout(() => {
                alert("Clip task is running in background!");
            }, 500);
        } else {
            statusDiv.innerHTML = `<p style="color: #e74c3c;">❌ Error: ${data.error}</p>`;
        }
    });
}

// 格式化秒数为 HH:MM:SS
function formatSeconds(seconds) {
    const date = new Date(0);
    date.setSeconds(seconds);
    return date.toISOString().substr(11, 8);
}

window.pickTime = (type) => {
    const videoElement = document.getElementById('player');
    const currentTime = videoElement.currentTime;
    const timeStr = formatSeconds(currentTime);

    if (type === 'start') {
        document.getElementById('clipStart').value = timeStr;
    } else {
        document.getElementById('clipEnd').value = timeStr;
    }
    
    // 提示用户已记录
    console.log(`Picked ${type} time: ${timeStr}`);
};


// public/js/clipper.js

export function prepareClip(videoPath, videoId, videoName, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    // 1. 记录数据
    currentSourceId = videoId;
    document.getElementById('clipVideoPath').value = videoPath;
    document.getElementById('clipStart').value = ''; // 清空旧数据
    document.getElementById('clipEnd').value = '';
    document.getElementById('clipperStatus').innerHTML = '';

    // 2. 显示剪辑面板，打开播放器
    document.getElementById('clipperPanel').style.display = 'flex';
    
    // 导入并调用播放器 (假设 playVideo 已挂载或可用)
    // 注意：这里调用 playVideo 会弹出 Modal
    import('./player.js').then(m => {
        m.playVideo(videoId, videoName, 0);
    });
}

// 别忘了在 main.js 里挂载 window.prepareClip = prepareClip;

export function initClipper() {
    console.log("Video Clipper Module Initialized");
}