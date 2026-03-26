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
    
    // Jump to saved progress when video metadata is loaded
    player.onloadedmetadata = () => {
        if (progress > 0) player.currentTime = progress;
    };
    
    modal.style.display = 'flex';
    player.play();

    // Auto-save progress every 5 seconds while playing
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
    fetch('/api/progress/' + id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: time })
    });
}

export function closePlayer() {
    const player = document.getElementById('player');
    
    // Save final progress before closing
    if (currentVideoId && player.currentTime > 0) {
        saveProgress(currentVideoId, player.currentTime);
    }
    
    clearInterval(saveProgressInterval);
    currentVideoId = null;
    
    document.getElementById('playerModal').style.display = 'none';
    player.pause();
    player.src = ''; 
    
    // Reload the list so the red progress bar updates visually
    loadVideos();
}

export function initPlayer() {
    document.getElementById('playerModal').addEventListener('click', function(e) {
        if (e.target === this) closePlayer();
    });
}