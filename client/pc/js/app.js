// client/pc/js/app.js

document.addEventListener('DOMContentLoaded', () => {
    loadVideos();
    setupEventListeners();
});

async function loadVideos() {
    try {
        const response = await fetch('/api/videos');
        const videos = await response.json();
        renderGrid(videos);
    } catch (err) {
        console.error("Failed to load videos", err);
    }
}

function renderGrid(videos) {
    const grid = document.getElementById('videoGrid');
    grid.innerHTML = videos.map(v => `
        <div class="video-card" onclick="openPlayer('${v.id}', '${v.name.replace(/'/g, "\\'")}')">
            <div class="thumbnail-wrapper">
                <img src="/covers/${v.cover || 'default.jpg'}" alt="${v.name}">
                <span class="duration-tag">${formatTime(v.duration)}</span>
            </div>
            <div class="video-info">
                <h3>${v.name}</h3>
                <div class="video-meta">
                    <span>${v.resolution}</span> • <span>${v.format.toUpperCase()}</span>
                </div>
            </div>
        </div>
    `).join('');
}

async function openPlayer(id, name) {
    const modal = document.getElementById('videoModal');
    const player = document.getElementById('mainPlayer');
    const title = document.getElementById('modalTitle');

    title.innerText = name;
    player.src = `/api/play/${id}`;
    modal.style.display = 'block';
    
    // 1. Start Playback
    try {
        await player.play();
        
        // 2. Check if device is mobile
        const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
        
        if (isMobile) {
            handleMobileRotation(player);
        }
    } catch (err) {
        console.error("Playback failed", err);
    }
}
// client/pc/js/app.js

async function handleMobileRotation(videoElement) {
    const modal = document.getElementById('videoModal'); // Get the container
    
    try {
        // FIX: Request fullscreen on the MODAL (container), not the video
        if (modal.requestFullscreen) {
            await modal.requestFullscreen();
        } else if (videoElement.webkitEnterFullscreen) {
            // iOS is a special case; it only supports fullscreen on the video tag
            videoElement.webkitEnterFullscreen();
            return; 
        }

        // Lock orientation to landscape
        if (screen.orientation && screen.orientation.lock) {
            await screen.orientation.lock('landscape').catch(err => console.warn(err));
        }
    } catch (err) {
        console.warn("Fullscreen failed", err);
    }
}

function setupEventListeners() {
    const modal = document.getElementById('videoModal');
    const closeBtn = document.querySelector('.close-modal');
    const player = document.getElementById('mainPlayer');

    closeBtn.onclick = () => {
        // 1. Exit Fullscreen if active
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => {});
        }
        
        // 2. Unlock orientation
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }

        modal.style.display = 'none';
        player.pause();
        player.src = "";
    };
    
    // Also exit if the video ends
    player.onended = () => {
        if (document.fullscreenElement) document.exitFullscreen();
    };
}
function formatTime(seconds) {
    if (!seconds) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 
        ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` 
        : `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}
// Add an event listener to unlock orientation when exiting fullscreen
document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
    }
});