const express = require('express');
const router = express.Router();
const { listLogs, getLogFile } = require('../services/ansible');
const fs = require('fs');

router.get('/logs', (req, res) => {
  const logs = listLogs();
  res.json(logs.map(l => ({
    jobId: l.jobId,
    command: l.command,
    status: l.status,
    startedAt: l.startedAt,
    finishedAt: l.finishedAt,
    exitCode: l.exitCode
  })));
});

router.get('/logs/:jobId', (req, res) => {
  const logFile = getLogFile(req.params.jobId);
  if (!fs.existsSync(logFile)) return res.status(404).json({ error: 'Not found' });
  try {
    const content = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    res.json(content);
  } catch {
    res.status(500).json({ error: 'Failed to read log' });
  }
});

router.delete('/logs/:jobId', (req, res) => {
  const logFile = getLogFile(req.params.jobId);
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
  res.json({ ok: true });
});

module.exports = router;
