import app from './app';
import config from '../config';
import * as logger from './logger';

const port = config.port;

app.listen(port, () => {
    logger.info(`Server started on port ${port}`);
});
