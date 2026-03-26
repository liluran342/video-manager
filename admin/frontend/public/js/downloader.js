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
    
    fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url })
    }).then(() => {
        nameInput.value = '';
        urlInput.value = '';
    });
}

export function initDownloader() {
    setInterval(() => {
        fetch('/api/downloads/status')
        .then(res => res.json())
        .then(statusMap => {
            const queueContainer = document.getElementById('downloadQueue');
            const queuePanel = document.getElementById('queuePanel');
            
            const urls = Object.keys(statusMap);
            const activeUrls = urls.filter(url => !alertedDownloads.has(url));
            queuePanel.style.display = activeUrls.length > 0 ? 'block' : 'none';

            for (const url in statusMap) {
                if (alertedDownloads.has(url)) continue;

                const task = statusMap[url];
                const safeId = 'task-' + url.replace(/[^a-zA-Z0-9]/g, ''); 
                let taskElement = document.getElementById(safeId);
                
                if (!taskElement) {
                    taskElement = document.createElement('div');
                    taskElement.id = safeId;
                    taskElement.className = 'download-item';
                    queueContainer.appendChild(taskElement);
                }

                const progress = task.progress || 0;
                // Add "waiting" status visual
                const statusColor = task.status === 'waiting' ? '#f1c40f' : '#3498db';
                
                taskElement.innerHTML = `
                    <div class="dl-title">${task.name}</div>
                    <div class="dl-status-text" style="color: ${statusColor}">${task.status}...</div>
                    <div class="dl-progress-bg">
                        <div class="dl-progress-fill" style="width: ${progress}%; background: ${statusColor}"></div>
                    </div>
                `;

                if (task.status === 'completed') {
                    alertedDownloads.add(url);
                    alert(`✅ Finished: ${task.name}`);
                    taskElement.remove();
                    window.scanLibrary(); 
                } else if (task.status === 'failed') {
                    alertedDownloads.add(url);
                    alert(`❌ Failed: ${task.name}\nReason: ${task.errorMsg || 'Check Logs'}`);
                    taskElement.remove();
                }
            }
        });
    }, 1000);
}