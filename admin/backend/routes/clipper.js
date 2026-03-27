// backend/routes/clipper.js
const express = require('express');
const router = express.Router();
const { processClipTask } = require('../services/clipperService');

router.post('/clip', async (req, res) => {
    const { videoPath, startTime, endTime, sourceId } = req.body;

    try {
        // 💡 使用 await，直到 FFmpeg 跑完才会执行下一行
        const result = await processClipTask(videoPath, startTime, endTime, sourceId);
        
        // 只有成功了才会发这个 json
        res.json({ success: true, taskId: result.taskId });
    } catch (err) {
        console.error("[Clipper Route Error]", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;