import { Pool, PoolClient, QueryResult } from 'pg';
import config from '../config';

const pool = new Pool({
    connectionString: config.databaseUrl,
});

export const query = (text: string, params?: any[]): Promise<QueryResult> =>
    pool.query(text, params);

export const getClient = (): Promise<PoolClient> => pool.connect();

export { pool };
