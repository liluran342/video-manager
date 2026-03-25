import { formatTime, formatDate } from './utils.js';
import { playVideo } from './player.js';

export function loadVideos() {
    const list = document.getElementById('list');
    list.innerHTML = '';

    fetch('/api/videos').then(res => res.json()).then(data => {
        data.forEach(v => {
            const card = document.createElement('div');
            card.className = 'card';
            const bgImage = v.cover ? `url('/covers/${v.cover}')` : 'none';
            const percent = v.duration > 0 ? Math.min((v.progress / v.duration) * 100, 100) : 0;

            card.innerHTML = `
                <button class="delete-btn" onclick="deleteVideo('${v.id}', event)" title="Delete Video">🗑️</button>
                <div class="thumb" style="background-image: ${bgImage}">
                    <div class="badges-top">
                        <span class="badge format">${(v.format || '').toUpperCase()}</span>
                        <span class="badge res">${v.resolution || 'Unknown'}</span>
                    </div>
                    <span class="badge duration">${formatTime(v.duration)}</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width: ${percent}%;"></div></div>
                <div class="title" title="${v.name}">${v.name}</div>
                <div class="added-date">Added: ${formatDate(v.added_at)}</div>
            `;

            // 修复了原代码被覆盖的Bug，现在点击卡片会正常忽略垃圾桶按钮的事件
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-btn')) {
                    playVideo(v.id, v.name, v.progress);
                }
            });

            list.appendChild(card);
        });
    });
}

export function deleteVideo(id, event) {
    event.stopPropagation(); 

    if (!confirm('Are you sure you want to delete this video? The actual file will be permanently removed from your disk.')) return;

    fetch('/api/videos/' + id, { method: 'DELETE' })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            loadVideos(); 
        } else {
            alert('Error: ' + data.error);
        }
    })
    .catch(err => alert('Request failed: ' + err));
}

export function scanLibrary() {
    fetch('/api/scan', { method: 'POST' })
    .then(res => res.json())
    .then(data => { 
        alert(data.message); 
        setTimeout(loadVideos, 3000); 
    });
}