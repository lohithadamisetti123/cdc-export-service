import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import * as exportService from './exportService';
import * as logger from './logger';
import { ExportJobResponse } from './types';

const app = express();
app.use(express.json());

app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});

function getConsumerId(req: Request, res: Response): string | null {
    const consumerId = req.header('X-Consumer-ID');
    if (!consumerId) {
        res.status(400).json({ error: 'X-Consumer-ID header is required' });
        return null;
    }
    return consumerId;
}

app.post('/exports/full', (req: Request, res: Response) => {
    const consumerId = getConsumerId(req, res);
    if (!consumerId) return;

    const jobId = randomUUID();

    setImmediate(async () => {
        try {
            await exportService.runFullExport(jobId, consumerId);
        } catch (err: any) {
            logger.error('Background full export failed', {
                jobId,
                consumerId,
                error: err.message,
            });
        }
    });

    const outputFilename = exportService.buildOutputFilename('full', consumerId);
    const response: ExportJobResponse = {
        jobId,
        status: 'started',
        exportType: 'full',
        outputFilename,
    };
    res.status(202).json(response);
});

app.post('/exports/incremental', (req: Request, res: Response) => {
    const consumerId = getConsumerId(req, res);
    if (!consumerId) return;

    const jobId = randomUUID();

    setImmediate(async () => {
        try {
            await exportService.runIncrementalExport(jobId, consumerId);
        } catch (err: any) {
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
    const response: ExportJobResponse = {
        jobId,
        status: 'started',
        exportType: 'incremental',
        outputFilename,
    };
    res.status(202).json(response);
});

app.post('/exports/delta', (req: Request, res: Response) => {
    const consumerId = getConsumerId(req, res);
    if (!consumerId) return;

    const jobId = randomUUID();

    setImmediate(async () => {
        try {
            await exportService.runDeltaExport(jobId, consumerId);
        } catch (err: any) {
            logger.error('Background delta export failed', {
                jobId,
                consumerId,
                error: err.message,
            });
        }
    });

    const outputFilename = exportService.buildOutputFilename('delta', consumerId);
    const response: ExportJobResponse = {
        jobId,
        status: 'started',
        exportType: 'delta',
        outputFilename,
    };
    res.status(202).json(response);
});

app.get('/exports/watermark', async (req: Request, res: Response) => {
    const consumerId = getConsumerId(req, res);
    if (!consumerId) return;

    try {
        const watermark = await exportService.getWatermark(consumerId);
        if (!watermark) {
            return res.status(404).json({ error: 'Watermark not found' });
        }
        // Handle both Date objects and strings that might come from DB
        const lastExportedAt = watermark instanceof Date ? watermark.toISOString() : new Date(watermark).toISOString();
        res.status(200).json({
            consumerId,
            lastExportedAt,
        });
    } catch (err: any) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default app;
