document.addEventListener('DOMContentLoaded', () => {
    fetchVideos();
    setupMobileEvents();
});

async function fetchVideos() {
    try {
        const res = await fetch('/api/videos');
        const data = await res.json();
        renderMobileFeed(data);
    } catch (e) {
        console.error("加载失败");
    }
}

function renderMobileFeed(videos) {
    const container = document.getElementById('videoList');
    container.innerHTML = videos.map(v => `
        <div class="video-card" onclick="playVideo('${v.id}', '${v.name.replace(/'/g, "\\'")}', '${v.resolution}')">
            <div class="thumb-container">
                <img src="/covers/${v.cover || 'default.jpg'}" loading="lazy">
                <span class="duration">${formatTime(v.duration)}</span>
            </div>
            <div class="info">
                <div class="text">
                    <h3>${v.name}</h3>
                    <p style="color:#aaa; font-size:12px; margin:4px 0;">${v.resolution} • ${v.format.toUpperCase()}</p>
                </div>
            </div>
        </div>
    `).join('');
}

function playVideo(id, name, res) {
    const overlay = document.getElementById('playerOverlay');
    const video = document.getElementById('mobilePlayer');
    
    document.getElementById('videoName').innerText = name;
    document.getElementById('videoTitle').innerText = name;
    
    video.src = `/api/play/${id}`;
    overlay.classList.add('active');
    
    video.play();

    // 手机端自动横屏逻辑
    if (window.screen.orientation && window.screen.orientation.lock) {
        video.onplay = () => {
            // 只有进入全屏时才尝试锁定横屏
            // 手机浏览器通常要求必须先进入全屏模式才能锁定方向
        };
    }
}

function setupMobileEvents() {
    const closeBtn = document.querySelector('.close-player');
    const overlay = document.getElementById('playerOverlay');
    const video = document.getElementById('mobilePlayer');

    closeBtn.onclick = () => {
        overlay.classList.remove('active');
        video.pause();
        video.src = "";
    };

    // 简单的物理返回键处理 (Android)
    window.onpopstate = () => {
        if (overlay.classList.contains('active')) {
            closeBtn.onclick();
        }
    };
}

function formatTime(s) {
    if (!s) return "00:00";
    const m = Math.floor(s / 60);
    const rs = Math.floor(s % 60);
    return `${m}:${rs.toString().padStart(2, '0')}`;
}