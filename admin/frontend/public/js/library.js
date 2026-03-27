// js/library.js (媒体库模块 - 表格版)
import { formatTime, formatDate } from './utils.js';
import { playVideo } from './player.js';

// 记录当前查看的状态
let currentFilterSourceId = null;

/**
 * @param {string|null} sourceId - 如果传入 ID，则进入“查看特定视频的片段”模式
 */
export function loadVideos(sourceId = null) {
    currentFilterSourceId = sourceId;
    const list = document.getElementById('list');
    if (!list) return;
    list.innerHTML = '';

    // --- 新增：获取 UI 上的过滤器值 ---
    // 假设你的 HTML 中有一个 <select id="libraryFilter">
    const filterSelect = document.getElementById('libraryFilter');
    const filterType = filterSelect ? filterSelect.value : 'all'; // all, originals, clips

    // 1. 构建 API 请求路径
    let url = '/api/videos';
    const params = new URLSearchParams();

    if (sourceId) {
        // 如果是“查看此视频的片段”模式，忽略全局过滤，只传 sourceId
        params.append('sourceId', sourceId);
    } else {
        // 正常模式，传入过滤器参数 (originals, clips, 或 all)
        if (filterType !== 'all') {
            params.append('filterType', filterType);
        }
    }

    if (params.toString()) {
        url += `?${params.toString()}`;
    }

    fetch(url).then(res => res.json()).then(data => {
        
        // 2. 如果正在查看某个视频的片段，显示返回行
        if (sourceId) {
            const backRow = document.createElement('div');
            backRow.className = 'video-row back-row';
            backRow.style.cssText = 'justify-content: center; border: 1px dashed var(--primary-blue); margin-bottom: 10px; background: rgba(52, 152, 219, 0.05);';
            backRow.innerHTML = `
                <div style="color: var(--primary-blue); font-weight: bold; cursor: pointer; padding: 10px;">
                    ⬅️ Back to All Videos (Exit Clip View)
                </div>
            `;
            backRow.onclick = () => loadVideos(null); 
            list.appendChild(backRow);
        }

        // 如果数据为空，显示提示
        if (data.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding: 40px; color: #666;">No videos found in this category.</div>`;
            return;
        }

        data.forEach(v => {
            const row = document.createElement('div');
            row.className = 'video-row';

            const bgImage = v.cover ? `url('/covers/${v.cover}')` : 'none';
            const percent = v.duration > 0 ? Math.min((v.progress / v.duration) * 100, 100) : 0;
            const rawPath = v.path || v.filepath || '';
            const safePath = rawPath.replace(/\\/g, '/');
            const safeName = v.name.replace(/'/g, "\\'");
            
            // 3. 准备 UI 徽章
            // 如果是主视频，且有片段，显示片段计数按钮
            const clipsBtnHtml = (!sourceId && v.clip_count > 0)
                ? `<button class="btn-action view-clips-btn" title="View ${v.clip_count} Clips" style="background: #2c3e50; color: #3498db; width: auto; padding: 0 8px; border: 1px solid #3498db;">🎞️ ${v.clip_count}</button>` 
                : '';

            // 如果视频本身是一个片段，打上红色的 CLIP 标签
            const sourceTag = v.source_id 
                ? `<span class="row-badge" style="position:absolute; bottom:2px; right:2px; background:rgba(231, 76, 60, 0.9); border:none; font-size:9px; color:white; padding: 1px 3px;">CLIP</span>` 
                : '';

            row.innerHTML = `
                <div class="col-thumb">
                    <div class="list-thumb" style="background-image: ${bgImage}; position: relative;">
                        ${sourceTag}
                    </div>
                </div>
                
                <div class="col-main">
                    <div class="row-title" title="${v.name}">${v.name}</div>
                    <div class="progress-bar" style="height: 3px; width: 100px; background: #333; margin-top:5px;">
                        <div class="progress-fill" style="width: ${percent}%; height: 100%; background: var(--primary-blue);"></div>
                    </div>
                </div>

                <div class="col-meta">
                    <span class="row-badge">${(v.format || '').toUpperCase()}</span>
                </div>

                <div class="col-meta">
                    <span class="row-badge" style="color: #2196F3; border-color: rgba(33, 150, 243, 0.3);">${v.resolution || 'N/A'}</span>
                </div>

                <div class="col-meta">
                    <span style="font-size: 13px;">${formatTime(v.duration)}</span>
                </div>

                <div class="col-date" style="font-size: 11px; color: #777;">${formatDate(v.added_at)}</div>

                <div class="col-actions">
                    ${clipsBtnHtml}
                    <button class="btn-action clip-btn" title="Clip Video">✂️</button>
                    <button class="btn-action del-btn" title="Delete Video">🗑️</button>
                </div>
            `;

            // 事件绑定
            row.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    playVideo(v.id, v.name, v.progress);
                }
            });

            const viewBtn = row.querySelector('.view-clips-btn');
            if (viewBtn) {
                viewBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    loadVideos(v.id); 
                });
            }

            row.querySelector('.clip-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.prepareClip) window.prepareClip(safePath, v.id, safeName, e);
            });

            row.querySelector('.del-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof deleteVideo === 'function') {
                    deleteVideo(v.id, e);
                } else {
                    window.deleteVideo(v.id, e);
                }
            });

            list.appendChild(row);
        });
    });
}

// 如果你在 HTML 里的 select 发生了变化，触发刷新
// <select id="libraryFilter" onchange="loadVideos()"> ... </select>

/**
 * 删除视频逻辑 (保持不变，但移除了对 window 的依赖)
 */
export function deleteVideo(id, event) {
    if (event) event.stopPropagation();

    const choice = confirm(
        "Delete Options:\n\n" +
        "Click [OK] to delete from Library AND DISK (Permanently).\n" +
        "Click [Cancel] to keep the file and only remove from Library."
    );

    let deleteFile = false;
    if (choice) {
        deleteFile = true;
    } else {
        if (confirm("Do you want to only REMOVE from Library (Keep the file)?")) {
            deleteFile = false;
        } else {
            return; 
        }
    }

    fetch(`/api/videos/${id}?deleteFile=${deleteFile}`, {
        method: 'DELETE',
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(deleteFile ? 'File and record deleted!' : 'Record removed, file kept.');
            loadVideos(); 
        }
    });
}

/**
 * 扫描磁盘
 */
export function scanLibrary() {
    fetch('/api/scan', { method: 'POST' })
    .then(res => res.json())
    .then(data => { 
        alert(data.message); 
        setTimeout(loadVideos, 2000); 
    });
}

// 如果其他地方有内联 onclick 调用（如 index.html），需要将函数挂载到 window
window.scanLibrary = scanLibrary;
window.deleteVideo = deleteVideo;
window.loadVideos = loadVideos;