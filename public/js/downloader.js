import { scanLibrary } from './library.js';

let alertedDownloads = new Set();

export function startDownload() {
    const name = document.getElementById('dlName').value;
    const url = document.getElementById('dlUrl').value;
    if (!name || !url) return alert('Provide Name and URL');
    
    fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url })
    }).then(res => res.json()).then(data => { alert(data.message); });
}

export function initDownloader() {
    setInterval(() => {
        fetch('/api/downloads/status')
        .then(res => res.json())
        .then(statusMap => {
            const queueContainer = document.getElementById('downloadQueue');
            const queuePanel = document.getElementById('queuePanel');
            let hasActiveTasks = false;

            for (const url in statusMap) {
                const task = statusMap[url];
                const safeId = 'task-' + url.replace(/[^a-zA-Z0-9]/g, ''); 
                
                if (task.status === 'downloading') {
                    hasActiveTasks = true;
                    const progress = task.progress || 0;
                    let taskElement = document.getElementById(safeId);
                    
                    if (!taskElement) {
                        taskElement = document.createElement('div');
                        taskElement.id = safeId;
                        taskElement.className = 'download-item';
                        taskElement.innerHTML = `
                            <div class="dl-title" title="${task.name}">${task.name}</div>
                            <div class="dl-progress-bg">
                                <div class="dl-progress-fill" id="fill-${safeId}" style="width: ${progress}%;"></div>
                            </div>
                            <div class="dl-percentage" id="text-${safeId}">${progress.toFixed(1)}%</div>
                        `;
                        queueContainer.appendChild(taskElement);
                    } else {
                        document.getElementById(`fill-${safeId}`).style.width = `${progress}%`;
                        document.getElementById(`text-${safeId}`).innerText = `${progress.toFixed(1)}%`;
                    }
                }
                
                if (task.status === 'completed' && !alertedDownloads.has(url)) {
                    alert(`✅ Download Finished: ${task.name}`);
                    alertedDownloads.add(url);
                    const taskElement = document.getElementById(safeId);
                    if (taskElement) taskElement.remove();
                    scanLibrary(); 
                } 
                else if (task.status === 'failed' && !alertedDownloads.has(url)) {
                    alert(`❌ Download Failed: ${task.name}. Please check the console.`);
                    alertedDownloads.add(url);
                    const taskElement = document.getElementById(safeId);
                    if (taskElement) taskElement.remove();
                }
            }

            queuePanel.style.display = hasActiveTasks ? 'block' : 'none';
        })
        .catch(err => console.error('Status check failed:', err));
    }, 1000);
}