//js/downloader.js (下载模块)
import { scanLibrary } from './library.js';

// public/js/downloader.js

let downloadPlan = []; // Local list of videos to download
let alertedDownloads = new Set();

export function addToPlan() {
    const nameInput = document.getElementById('dlName');
    const urlInput = document.getElementById('dlUrl');
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();

    if (!name || !url) return alert('Enter Name and URL');

    downloadPlan.push({ name, url });
    updatePlanUI();

    nameInput.value = '';
    urlInput.value = '';
}

function updatePlanUI() {
    const planPanel = document.getElementById('planPanel');
    const planList = document.getElementById('planList');
    const planCount = document.getElementById('planCount');

    planCount.innerText = downloadPlan.length;
    planPanel.style.display = downloadPlan.length > 0 ? 'block' : 'none';

    planList.innerHTML = downloadPlan.map((item, index) => `
        <div class="plan-item" style="font-size: 0.8em; padding: 5px; border-bottom: 1px solid #444; display: flex; justify-content: space-between;">
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</span>
            <button onclick="window.removeFromPlan(${index})" style="background:none; border:none; color:red; cursor:pointer;">✕</button>
        </div>
    `).join('');
}

// Global helper to remove from plan
window.removeFromPlan = (index) => {
    downloadPlan.splice(index, 1);
    updatePlanUI();
};

export function startBatch() {
    if (downloadPlan.length === 0) return;

    downloadPlan.forEach(task => {
        fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task)
        });
    });

    downloadPlan = []; // Clear plan
    updatePlanUI();
    alert('All tasks added to backend queue!');
}

export function startDownload() {
    const nameInput = document.getElementById('dlName');
    const urlInput = document.getElementById('dlUrl');
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();

    if (!name || !url) return alert('Provide Name and URL');
    
    // 禁用按钮防止重复点击
    const btn = event.currentTarget;
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Adding...';

    fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            nameInput.value = '';
            urlInput.value = '';
            // 提示一下用户
            console.log('Task added successfully');
        } else {
            alert('Error: ' + data.error);
        }
    })
    .catch(err => alert('Network error!'))
    .finally(() => {
        btn.disabled = false;
        btn.innerText = originalText;
    });
}

// public/js/downloader.js

export function initDownloader() {
    setInterval(() => {
        fetch('/api/downloads/status')
        .then(res => res.json())
        .then(statusMap => {
            const queueContainer = document.getElementById('downloadQueue');
            const queuePanel = document.getElementById('queuePanel');
            if (!queueContainer) return;

            const urls = Object.keys(statusMap);
            // 如果有任务且不是被 alert 过的，就显示面板
            const hasVisibleTasks = urls.some(url => !alertedDownloads.has(url));
            if (queuePanel) queuePanel.style.display = hasVisibleTasks ? 'block' : 'none';

            for (const url in statusMap) {
                if (alertedDownloads.has(url)) continue;

                const task = statusMap[url];
                const safeId = 'task-' + url.replace(/[^a-zA-Z0-9]/g, ''); 
                let taskElement = document.getElementById(safeId);
                
                if (!taskElement) {
                    taskElement = document.createElement('div');
                    taskElement.id = safeId;
                    taskElement.className = 'download-item';
                    // 给新创建的容器加点基础样式
                    taskElement.style.marginBottom = "15px";
                    taskElement.style.padding = "10px";
                    taskElement.style.background = "#2a2a2a";
                    taskElement.style.borderRadius = "6px";
                    queueContainer.appendChild(taskElement);
                }

                // 进度逻辑
                const progress = (task.progress || 0).toFixed(1); // 保留一位小数
                const isWaiting = task.status === 'waiting';
                const statusColor = isWaiting ? '#f1c40f' : '#3498db'; // 等待用黄色，下载用蓝色
                
                // --- 核心修改：增加进度文字显示 ---
                taskElement.innerHTML = `
                    <div class="dl-info" style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span class="dl-title" style="font-weight: bold; font-size: 0.9em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%;">${task.name}</span>
                        <span class="dl-percent" style="font-weight: bold; color: ${statusColor}; font-size: 0.9em;">${progress}%</span>
                    </div>
                    
                    <div class="dl-progress-container" style="background: #444; height: 12px; border-radius: 6px; position: relative; overflow: hidden;">
                        <!-- 进度填充条 -->
                        <div class="dl-progress-fill" style="
                            width: ${progress}%; 
                            background: ${statusColor}; 
                            height: 100%; 
                            transition: width 0.4s ease; 
                            box-shadow: 0 0 10px ${statusColor}55;">
                        </div>
                    </div>

                    <div class="dl-status-row" style="margin-top: 4px; display: flex; justify-content: space-between; align-items: center;">
                        <span class="dl-status-text" style="font-size: 0.75em; color: #aaa; text-transform: uppercase;">
                            ${isWaiting ? '⏳ Waiting in queue...' : '🚀 Downloading...'}
                        </span>
                    </div>
                `;

                // 处理完成和失败
                if (task.status === 'completed') {
                    alertedDownloads.add(url);
                    taskElement.style.opacity = "0"; // 渐隐
                    setTimeout(() => {
                        taskElement.remove();
                        alert(`✅ Download Complete:\n${task.name}`);
                        if (window.scanLibrary) window.scanLibrary();
                    }, 500);
                } else if (task.status === 'failed') {
                    alertedDownloads.add(url);
                    taskElement.style.borderLeft = "4px solid #e74c3c";
                    alert(`❌ Download Failed:\n${task.name}\n\nError: ${task.errorMsg || 'Check backend logs'}`);
                    setTimeout(() => taskElement.remove(), 2000);
                }
            }
        }).catch(err => console.error("Poll Error:", err));
    }, 1000);
}