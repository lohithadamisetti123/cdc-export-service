import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import config from '../config';

const pool = new Pool({ connectionString: config.databaseUrl });

async function main() {
    const client = await pool.connect();
    try {
        console.log('Checking existing users...');
        const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM users');
        const count = rows[0].count;
        if (count >= 100000) {
            console.log('Users already seeded, skipping.');
            return;
        }

        console.log('Seeding users...');
        const total = 100000;
        const batchSize = 5000;
        const now = new Date();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

        for (let offset = 0; offset < total; offset += batchSize) {
            const values: any[] = [];
            for (let i = 0; i < batchSize && offset + i < total; i++) {
                const createdAt = new Date(now.getTime() - Math.random() * sevenDaysMs);
                const updatedAt = new Date(createdAt.getTime() + Math.random() * (now.getTime() - createdAt.getTime()));
                const isDeleted = Math.random() < 0.01; // ~1%

                values.push({
                    name: faker.person.fullName(),
                    email: faker.internet.email().toLowerCase() + `+${offset + i}@example.com`,
                    created_at: createdAt,
                    updated_at: updatedAt,
                    is_deleted: isDeleted,
                });
            }

            const params: any[] = [];
            const valueStrings = values.map((v, idx) => {
                const base = idx * 5;
                params.push(v.name, v.email, v.created_at, v.updated_at, v.is_deleted);
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
            });

            const sql = `
        INSERT INTO users (name, email, created_at, updated_at, is_deleted)
        VALUES ${valueStrings.join(', ')}
        ON CONFLICT (email) DO NOTHING
      `;
            await client.query(sql, params);
            console.log(`Inserted batch up to ${offset + values.length}`);
        }

        console.log('Seeding completed.');
    } catch (err) {
        console.error('Seeding failed', err);
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((err) => {
    console.error('Seeding failed', err);
    process.exit(1);
});
