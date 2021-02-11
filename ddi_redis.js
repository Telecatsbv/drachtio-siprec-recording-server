const config = require('config');
const redis = require('redis');
const pino = require('pino');
const logger = pino();

const redisOpts = Object.assign({auth_pass: config.get('redis.pass')}
);

const client = redis.createClient(config.get('redis.port'), config.get('redis.host'), redisOpts);
client.on('connect', () => {
  logger.info(`successfully connected to redis at ${config.get('redis.host')}:${config.get('redis.port')}`);
})
  .on('error', (err) => {
    logger.error(err, 'redis connection error');
  });

// Place DDI's in Redis
try {
  const ddis = config.get('ddi');
  for (const [ddi, uri] of Object.entries(ddis)) {
    console.log(`${ddi}: ${uri}`);
    storeRecorderDDI(ddi, uri);
  }
  // return ddi[user] || false;
} catch (err) {
  // return false;
  console.log(err);
}

return 'success';

function storeRecorderDDI(ddi, uri) {
  return new Promise((resolve) => {
    client.set(ddi, uri, (err, reply) => {
      if (err) throw err;
      resolve(reply);
    });
  });
}
