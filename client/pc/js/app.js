/**
 * 视频播放器应用模块（高性能版）
 */
const VideoApp = {
    // ================= 状态 =================
    currentVideoId: null,
    segmentStart: 0,
    lastPosition: 0,
    isTracking: false,

    // 自动记录
    isAutoRecordEnabled: localStorage.getItem('autoRecord') !== 'false',

    // ✅ 片段缓冲池（核心）
    segmentBuffer: [],
    flushTimer: null,
    FLUSH_INTERVAL: 10000, // 10秒提交一次

    // DOM
    elements: {},

    // ================= 初始化 =================
    init() {
        this.cacheElements();
        this.initEventListeners();
        this.loadVideos();
        this.initUIState();
    },

    cacheElements() {
        this.elements = {
            player: document.getElementById('mainPlayer'),
            modal: document.getElementById('videoModal'),
            grid: document.getElementById('videoGrid'),
            listContainer: document.getElementById('segmentList'),
            modalTitle: document.getElementById('modalTitle'),
            autoToggle: document.getElementById('autoRecordToggle'),
            closeBtn: document.querySelector('.close-modal')
        };
    },

    initUIState() {
        if (this.elements.autoToggle) {
            this.elements.autoToggle.checked = this.isAutoRecordEnabled;
        }
    },

    // ================= 事件 =================
    initEventListeners() {
        const { player, autoToggle, closeBtn } = this.elements;

        // 自动记录开关
        if (autoToggle) {
            autoToggle.onchange = (e) => {
                this.isAutoRecordEnabled = e.target.checked;
                localStorage.setItem('autoRecord', this.isAutoRecordEnabled);
            };
        }

        // 关闭弹窗
        closeBtn.onclick = () => this.closePlayer();

        // 播放开始
        player.addEventListener('play', () => {
            this.segmentStart = player.currentTime;
            this.lastPosition = player.currentTime;
            this.isTracking = true;
        });

        // ✅ 只做检测，不做IO
        player.addEventListener('timeupdate', () => {
            if (!this.isTracking) return;

            // 检测跳跃（拖动）
            if (Math.abs(player.currentTime - this.lastPosition) > 3) {
                this.saveWatchSegment(this.segmentStart, this.lastPosition);
                this.segmentStart = player.currentTime;
            }

            this.lastPosition = player.currentTime;
        });

        // 暂停
        player.addEventListener('pause', () => {
            if (this.isTracking) {
                this.saveWatchSegment(this.segmentStart, player.currentTime);
                this.isTracking = false;
            }
        });

        // 全屏退出
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && screen.orientation?.unlock) {
                screen.orientation.unlock();
            }
        });

        // ✅ 页面隐藏 → 强制提交
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.flushSegments(true);
            }
        });
    },

    // ================= 视频 =================
    async loadVideos() {
        try {
            const res = await fetch('/api/videos');
            const videos = await res.json();
            this.renderGrid(videos);
        } catch (err) {
            console.error("加载视频失败", err);
        }
    },

    renderGrid(videos) {
        this.elements.grid.innerHTML = videos.map(v => `
            <div class="video-card" onclick="VideoApp.openPlayer('${v.id}', '${this.escapeJS(v.name)}')">
                <div class="thumbnail-wrapper">
                    <img src="/covers/${v.cover || 'default.jpg'}">
                    <span class="duration-tag">${this.formatTime(v.duration)}</span>
                </div>
                <div class="video-info">
                    <h3>${this.escapeHTML(v.name)}</h3>
                    <div>${v.resolution} • ${v.format.toUpperCase()}</div>
                </div>
            </div>
        `).join('');
    },

    async openPlayer(id, name) {
        const { modal, player, modalTitle } = this.elements;

        this.currentVideoId = id;
        modalTitle.innerText = name;

        player.src = `/api/videos/play/${id}`;
        modal.classList.add('active');

        // 重置状态
        this.segmentStart = 0;
        this.lastPosition = 0;
        this.segmentBuffer = [];

        try {
            await player.play();
            this.refreshSegments(id); // 只在这里加载一次
        } catch (e) {
            console.warn("自动播放失败", e);
        }
    },

    closePlayer() {
        const { player, modal } = this.elements;

        if (this.isTracking) {
            this.saveWatchSegment(this.segmentStart, player.currentTime);
            this.isTracking = false;
        }

        // ✅ 强制提交
        this.flushSegments(true);

        modal.classList.remove('active');
        player.pause();
        player.src = "";

        this.currentVideoId = null;
    },

    // ================= 核心：记录 =================
    saveWatchSegment(start, end) {
        if (!this.isAutoRecordEnabled || !this.currentVideoId) return;
        if (end - start < 2) return;

        this.segmentBuffer.push({
            videoId: this.currentVideoId,
            startTime: start,
            endTime: end
        });

        this.scheduleFlush();
    },

    scheduleFlush() {
        if (this.flushTimer) return;

        this.flushTimer = setTimeout(() => {
            this.flushSegments();
        }, this.FLUSH_INTERVAL);
    },

    async flushSegments(isExiting = false) {
        if (this.segmentBuffer.length === 0) return;

        const payload = [...this.segmentBuffer];
        this.segmentBuffer = [];
        this.flushTimer = null;

        try {
            fetch('/api/videos/history/batch', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload),
                keepalive: isExiting
            });
        } catch (e) {
            console.error("提交失败", e);
        }
    },

    // ================= 片段UI =================
    async refreshSegments(videoId) {
        try {
            const res = await fetch(`/api/videos/history/${videoId}`);
            const segments = await res.json();

            this.elements.listContainer.innerHTML = segments.map(seg => `
                <div class="segment-item" onclick="VideoApp.jumpToSegment(${seg.start_time})">
                    <span>📍 ${this.formatTime(seg.start_time)} - ${this.formatTime(seg.end_time)}</span>
                    <span onclick="VideoApp.deleteSegment(event, ${seg.id})">×</span>
                </div>
            `).join('');
        } catch (e) {
            console.error("加载片段失败", e);
        }
    },

    jumpToSegment(time) {
        this.elements.player.currentTime = time;
        this.elements.player.play();
    },

    async deleteSegment(e, id) {
        e.stopPropagation();

        if (!confirm('删除这个片段？')) return;

        await fetch(`/api/videos/history/${id}`, { method: 'DELETE' });
        this.refreshSegments(this.currentVideoId);
    },

    // ================= 工具 =================
    formatTime(s) {
        if (!s) return "00:00";
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        const pad = n => n.toString().padStart(2, '0');
        return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
    },

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    escapeJS(str) {
        return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
    }
};

// 启动
document.addEventListener('DOMContentLoaded', () => VideoApp.init());