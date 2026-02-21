const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const db = require('./db');
const config = require('../config');
const logger = require('./logger');

function buildOutputFilename(exportType, consumerId) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `${exportType}_${consumerId}_${ts}.csv`;
}

async function getWatermark(consumerId) {
  const res = await db.query(
    'SELECT last_exported_at FROM watermarks WHERE consumer_id = $1',
    [consumerId],
  );
  if (res.rows.length === 0) return null;
  return res.rows[0].last_exported_at;
}

async function upsertWatermark(client, consumerId, lastExportedAt) {
  const now = new Date();
  await client.query(
    `
    INSERT INTO watermarks (consumer_id, last_exported_at, updated_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (consumer_id)
    DO UPDATE SET last_exported_at = EXCLUDED.last_exported_at,
                  updated_at = EXCLUDED.updated_at
  `,
    [consumerId, lastExportedAt, now],
  );
}

async function exportToCsv({ rows, exportType, consumerId, filename }) {
  const outputDir = config.exportOutputDir;
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filePath = path.join(outputDir, filename);

  const header = [];
  if (exportType === 'delta') {
    header.push({ id: 'operation', title: 'operation' });
  }
  header.push(
    { id: 'id', title: 'id' },
    { id: 'name', title: 'name' },
    { id: 'email', title: 'email' },
    { id: 'created_at', title: 'created_at' },
    { id: 'updated_at', title: 'updated_at' },
    { id: 'is_deleted', title: 'is_deleted' },
  );

  const csvWriter = createCsvWriter({
    path: filePath,
    header,
  });

  const mappedRows =
    exportType === 'delta'
      ? rows.map((r) => {
          let operation = 'UPDATE';
          if (r.is_deleted) operation = 'DELETE';
          else if (r.created_at.getTime() === r.updated_at.getTime())
            operation = 'INSERT';
          return {
            operation,
            id: r.id,
            name: r.name,
            email: r.email,
            created_at: r.created_at.toISOString(),
            updated_at: r.updated_at.toISOString(),
            is_deleted: r.is_deleted,
          };
        })
      : rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          created_at: r.created_at.toISOString(),
          updated_at: r.updated_at.toISOString(),
          is_deleted: r.is_deleted,
        }));

  await csvWriter.writeRecords(mappedRows);
  return { filePath, rowsExported: rows.length };
}

async function runFullExport(jobId, consumerId) {
  const start = Date.now();
  const client = await db.getClient();
  try {
    logger.info('Export job started', {
      jobId,
      consumerId,
      exportType: 'full',
    });

    await client.query('BEGIN');

    const res = await client.query(
      `SELECT id, name, email, created_at, updated_at, is_deleted
       FROM users
       WHERE is_deleted = FALSE
       ORDER BY updated_at ASC`,
    );
    const rows = res.rows;

    if (rows.length === 0) {
      await client.query('COMMIT');
      logger.info('Export job completed', {
        jobId,
        rowsExported: 0,
        durationMs: Date.now() - start,
      });
      return;
    }

    const filename = buildOutputFilename('full', consumerId);
    await exportToCsv({
      rows,
      exportType: 'full',
      consumerId,
      filename,
    });

    const lastUpdated = rows[rows.length - 1].updated_at;
    await upsertWatermark(client, consumerId, lastUpdated);

    await client.query('COMMIT');

    logger.info('Export job completed', {
      jobId,
      rowsExported: rows.length,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Export job failed', { jobId, error: err.message });
    throw err;
  } finally {
    client.release();
  }
}

async function runIncrementalExport(jobId, consumerId) {
  const start = Date.now();
  const client = await db.getClient();
  try {
    logger.info('Export job started', {
      jobId,
      consumerId,
      exportType: 'incremental',
    });

    await client.query('BEGIN');

    const watermark = await getWatermark(consumerId);
    if (!watermark) {
      await client.query('ROLLBACK');
      logger.error('Incremental export without watermark', {
        jobId,
        consumerId,
      });
      throw new Error('No watermark for consumer');
    }

    const res = await client.query(
      `SELECT id, name, email, created_at, updated_at, is_deleted
       FROM users
       WHERE is_deleted = FALSE
         AND updated_at > $1
       ORDER BY updated_at ASC`,
      [watermark],
    );
    const rows = res.rows;
    if (rows.length === 0) {
      await client.query('COMMIT');
      logger.info('Export job completed', {
        jobId,
        rowsExported: 0,
        durationMs: Date.now() - start,
      });
      return;
    }

    const filename = buildOutputFilename('incremental', consumerId);
    await exportToCsv({
      rows,
      exportType: 'incremental',
      consumerId,
      filename,
    });

    const lastUpdated = rows[rows.length - 1].updated_at;
    await upsertWatermark(client, consumerId, lastUpdated);

    await client.query('COMMIT');

    logger.info('Export job completed', {
      jobId,
      rowsExported: rows.length,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Export job failed', { jobId, error: err.message });
    throw err;
  } finally {
    client.release();
  }
}

async function runDeltaExport(jobId, consumerId) {
  const start = Date.now();
  const client = await db.getClient();
  try {
    logger.info('Export job started', {
      jobId,
      consumerId,
      exportType: 'delta',
    });

    await client.query('BEGIN');

    const watermark = await getWatermark(consumerId);
    if (!watermark) {
      await client.query('ROLLBACK');
      logger.error('Delta export without watermark', {
        jobId,
        consumerId,
      });
      throw new Error('No watermark for consumer');
    }

    const res = await client.query(
      `SELECT id, name, email, created_at, updated_at, is_deleted
       FROM users
       WHERE updated_at > $1
       ORDER BY updated_at ASC`,
      [watermark],
    );
    const rows = res.rows;
    if (rows.length === 0) {
      await client.query('COMMIT');
      logger.info('Export job completed', {
        jobId,
        rowsExported: 0,
        durationMs: Date.now() - start,
      });
      return;
    }

    const filename = buildOutputFilename('delta', consumerId);
    await exportToCsv({
      rows,
      exportType: 'delta',
      consumerId,
      filename,
    });

    const lastUpdated = rows[rows.length - 1].updated_at;
    await upsertWatermark(client, consumerId, lastUpdated);

    await client.query('COMMIT');

    logger.info('Export job completed', {
      jobId,
      rowsExported: rows.length,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Export job failed', { jobId, error: err.message });
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  runFullExport,
  runIncrementalExport,
  runDeltaExport,
  getWatermark,
  buildOutputFilename,
};
