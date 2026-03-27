//js/player.js (播放器模块)
import { loadVideos } from './library.js';

let currentVideoId = null;
let saveProgressInterval = null;

export function playVideo(id, name, progress) {
    currentVideoId = id;
    const player = document.getElementById('player');
    const modal = document.getElementById('playerModal');
    
    document.getElementById('nowPlayingTitle').innerText = name;
    player.src = '/api/play/' + id;
    
    // 加载元数据后跳转进度
    player.onloadedmetadata = () => {
        if (progress > 0) player.currentTime = progress;
    };
    
    modal.style.display = 'flex';
    player.play();

    // 播放时每 5 秒自动保存一次进度
    // 先清除可能存在的旧定时器
    if (saveProgressInterval) clearInterval(saveProgressInterval);
    
    saveProgressInterval = setInterval(() => {
        if (!player.paused && currentVideoId) {
            saveProgress(currentVideoId, player.currentTime);
        }
    }, 5000);
}
// public/js/player.js

// Add captureCover to your exports
export function captureCover() {
    if (!currentVideoId) return;

    const video = document.getElementById('player');
    const canvas = document.getElementById('captureCanvas');
    const ctx = canvas.getContext('2d');

    // 1. Set canvas dimensions to match video aspect ratio (e.g., 640x360 for high quality)
    canvas.width = 640;
    canvas.height = 360;

    // 2. Draw the current frame from the video element to the canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 3. Convert canvas to a JPEG blob
    canvas.toBlob((blob) => {
        const formData = new FormData();
        formData.append('cover', blob, 'cover.jpg');

        // 4. Send to backend
        fetch(`/api/videos/cover/${currentVideoId}`, {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert('Cover updated successfully!');
            } else {
                alert('Failed to update cover: ' + data.error);
            }
        })
        .catch(err => console.error('Error uploading cover:', err));
    }, 'image/jpeg', 0.8);
}

// Don't forget to expose it to window in main.js

function saveProgress(id, time) {
    if (!id) return;
    fetch('/api/progress/' + id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: time })
    }).catch(err => console.error('Save progress failed:', err));
}
// 在 player.js 的 closePlayer 函数中增加
export function closePlayer() {
    const modal = document.getElementById('playerModal');
    const player = document.getElementById('player');

    // --- 修改开始 ---
    // 1. 在停止播放前，最后保存一次当前进度
    if (currentVideoId && player.currentTime > 0) {
        saveProgress(currentVideoId, player.currentTime);
    }

    // 2. 清除定时器
    if (saveProgressInterval) {
        clearInterval(saveProgressInterval);
        saveProgressInterval = null;
    }

    // 3. 停止播放器
    player.pause();
    player.src = "";
    modal.style.display = 'none';

    // 4. 重置剪辑面板
    const clipperPanel = document.getElementById('clipperPanel');
    if (clipperPanel) clipperPanel.style.display = 'none';

    // 5. 关键：刷新视频列表，显示最新的进度条
    // 这里传入 window.currentFilterSourceId 以保持当前的视图状态（是在看全部还是在看某个视频的片段）
    loadVideos(window.currentFilterSourceId || null);
    // --- 修改结束 ---
}

export function initPlayer() {
    document.getElementById('playerModal').addEventListener('click', function(e) {
        if (e.target === this) closePlayer();
    });
}