import dotenv from 'dotenv';
dotenv.config();

export interface Config {
    port: number;
    databaseUrl: string;
    exportOutputDir: string;
    nodeEnv: string;
}

const config: Config = {
    port: parseInt(process.env.PORT || '8080', 10),
    databaseUrl:
        process.env.DATABASE_URL ||
        'postgresql://user:password@localhost:5432/mydatabase',
    exportOutputDir: process.env.EXPORT_OUTPUT_DIR || './output',
    nodeEnv: process.env.NODE_ENV || 'development',
};

export default config;
