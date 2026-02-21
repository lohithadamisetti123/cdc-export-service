require('dotenv').config();

module.exports = {
  port: process.env.PORT || 8080,
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://user:password@localhost:5432/mydatabase',
  exportOutputDir: process.env.EXPORT_OUTPUT_DIR || './output',
  nodeEnv: process.env.NODE_ENV || 'development',
};
