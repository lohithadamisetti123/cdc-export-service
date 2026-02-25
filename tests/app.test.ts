import request from 'supertest';
import app from '../src/app';

describe('Health endpoint', () => {
    test('GET /health returns ok', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.timestamp).toBeDefined();
    });
});

describe('Header validation', () => {
    test('POST /exports/full requires consumer header', async () => {
        const res = await request(app).post('/exports/full');
        expect(res.status).toBe(400);
    });
});
