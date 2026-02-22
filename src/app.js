// src/app.js
const express = require('express');
const { randomUUID } = require('crypto');
const exportService = require('./exportService');
const logger = require('./logger');
const config = require('../config');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

function getConsumerId(req, res) {
  const consumerId = req.header('X-Consumer-ID');
  if (!consumerId) {
    res.status(400).json({ error: 'X-Consumer-ID header is required' });
    return null;
  }
  return consumerId;
}

app.post('/exports/full', (req, res) => {
  const consumerId = getConsumerId(req, res);
  if (!consumerId) return;

  const jobId = randomUUID();

  setImmediate(async () => {
    try {
      await exportService.runFullExport(jobId, consumerId);
    } catch (err) {
      logger.error('Background full export failed', {
        jobId,
        consumerId,
        error: err.message,
      });
    }
  });

  const outputFilename = exportService.buildOutputFilename('full', consumerId);
  res.status(202).json({
    jobId,
    status: 'started',
    exportType: 'full',
    outputFilename,
  });
});

app.post('/exports/incremental', (req, res) => {
  const consumerId = getConsumerId(req, res);
  if (!consumerId) return;

  const jobId = randomUUID();

  setImmediate(async () => {
    try {
      await exportService.runIncrementalExport(jobId, consumerId);
    } catch (err) {
      logger.error('Background incremental export failed', {
        jobId,
        consumerId,
        error: err.message,
      });
    }
  });

  const outputFilename = exportService.buildOutputFilename(
    'incremental',
    consumerId,
  );
  res.status(202).json({
    jobId,
    status: 'started',
    exportType: 'incremental',
    outputFilename,
  });
});

app.post('/exports/delta', (req, res) => {
  const consumerId = getConsumerId(req, res);
  if (!consumerId) return;

  const jobId = randomUUID();

  setImmediate(async () => {
    try {
      await exportService.runDeltaExport(jobId, consumerId);
    } catch (err) {
      logger.error('Background delta export failed', {
        jobId,
        consumerId,
        error: err.message,
      });
    }
  });

  const outputFilename = exportService.buildOutputFilename('delta', consumerId);
  res.status(202).json({
    jobId,
    status: 'started',
    exportType: 'delta',
    outputFilename,
  });
});

app.get('/exports/watermark', async (req, res) => {
  const consumerId = getConsumerId(req, res);
  if (!consumerId) return;

  try {
    const watermark = await exportService.getWatermark(consumerId);
    if (!watermark) {
      return res.status(404).json({ error: 'Watermark not found' });
    }
    res.status(200).json({
      consumerId,
      lastExportedAt: watermark.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = app;
