const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

const CONSUMER = 'test-consumer';

async function resetDb() {
  await db.query('TRUNCATE watermarks RESTART IDENTITY CASCADE');
  await db.query('TRUNCATE users RESTART IDENTITY CASCADE');
}

async function seedUsers() {
  const now = new Date();
  const earlier = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO users (name, email, created_at, updated_at, is_deleted)
     VALUES
     ('User 1','u1@example.com',$1,$1,FALSE),
     ('User 2','u2@example.com',$2,$2,FALSE),
     ('User 3','u3@example.com',$2,$2,TRUE)`,
    [earlier, now],
  );
}

describe('Export flows', () => {
  beforeAll(async () => {
    await resetDb();
    await seedUsers();
  });

  afterAll(async () => {
    await db.pool.end();
  });

  test('GET watermark returns 404 for new consumer', async () => {
    const res = await request(app)
      .get('/exports/watermark')
      .set('X-Consumer-ID', CONSUMER);
    expect(res.status).toBe(404);
  });

  test('Full export sets watermark', async () => {
    const res = await request(app)
      .post('/exports/full')
      .set('X-Consumer-ID', CONSUMER);
    expect(res.status).toBe(202);
    expect(res.body.jobId).toBeDefined();
    expect(res.body.exportType).toBe('full');

    // Wait a bit for background job
    await new Promise((r) => setTimeout(r, 1000));

    const wmRes = await request(app)
      .get('/exports/watermark')
      .set('X-Consumer-ID', CONSUMER);
    expect(wmRes.status).toBe(200);
    expect(wmRes.body.consumerId).toBe(CONSUMER);
    expect(wmRes.body.lastExportedAt).toBeDefined();
  });

  test('Incremental export after updates', async () => {
    const now = new Date();
    await db.query(
      `UPDATE users
       SET updated_at = $1
       WHERE email = 'u1@example.com'`,
      [now],
    );

    const res = await request(app)
      .post('/exports/incremental')
      .set('X-Consumer-ID', CONSUMER);
    expect(res.status).toBe(202);

    await new Promise((r) => setTimeout(r, 1000));

    const wmRes = await request(app)
      .get('/exports/watermark')
      .set('X-Consumer-ID', CONSUMER);
    expect(wmRes.status).toBe(200);
  });

  test('Delta export operations', async () => {
    const consumer2 = 'consumer-delta';

    await request(app)
      .post('/exports/full')
      .set('X-Consumer-ID', consumer2);
    await new Promise((r) => setTimeout(r, 1000));

    const now = new Date();
    await db.query(
      `INSERT INTO users (name, email, created_at, updated_at, is_deleted)
       VALUES ('New User','new@example.com',$1,$1,FALSE)`,
      [now],
    );

    const later = new Date(now.getTime() + 1000);
    await db.query(
      `UPDATE users
       SET name = 'Updated User', updated_at = $1
       WHERE email = 'u2@example.com'`,
      [later],
    );

    const after = new Date(later.getTime() + 1000);
    await db.query(
      `UPDATE users
       SET is_deleted = TRUE, updated_at = $1
       WHERE email = 'u1@example.com'`,
      [after],
    );

    const res = await request(app)
      .post('/exports/delta')
      .set('X-Consumer-ID', consumer2);
    expect(res.status).toBe(202);
  });
});
