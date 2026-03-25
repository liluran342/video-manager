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