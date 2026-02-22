// jest.setup.js
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://user:password@db:5432/mydatabase';
}
