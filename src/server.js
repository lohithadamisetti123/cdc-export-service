const app = require('./app');
const config = require('../config');

app.listen(config.port, () => {
  // Simple startup log
  console.log(
    JSON.stringify({
      level: 'info',
      message: `Server started on port ${config.port}`,
      timestamp: new Date().toISOString(),
    }),
  );
});
