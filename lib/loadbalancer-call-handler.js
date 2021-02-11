/**
 * Call comes in and its a SIPREC call (multi-part content)
 * Parse the payload into two sdps
 * Creeate a uuid and store the uniused sdp by uuid
 * Srf#createB2BUA where localSdpA is the SDP we will use first,
 * and localSdpB is a function that pulls the sdp back out of redis
 * and creates a multipart SDP
 */
const config = require('config');
const payloadParser = require('./payload-parser');
const { getAvailableLoadBalancers } = require('./utils');
const debug = require('debug')('drachtio:siprec-recording-server');
const redis = require('redis');
const ddiredis = require('../ddi_redis');
let client;

module.exports = (logger) => {
  if (logger) {
    logger.info('Entered recorder call handler');
  }

  const redisOpts = Object.assign({auth_pass: config.get('redis.pass')}
  );

  client = redis.createClient(config.get('redis.port'), config.get('redis.host'), redisOpts);
  client.on('connect', () => {
    logger.info(`successfully connected to redis at ${config.get('redis.host')}:${config.get('redis.port')}`);
  })
    .on('error', (err) => {
      logger.error(err, 'redis connection error');
    });

  return handler;
};

const handler = (req, res) => {
  const callid = req.get('Call-ID');
  const logger = req.srf.locals.logger.child({ callid });
  const opts = { req, res, logger };
  const ctype = req.get('Content-Type') || '';

  if (ctype.includes('multipart/mixed')) {
    logger.info(`received SIPREC invite: ${req.uri}`);
    handleIncomingSiprecInvite(req, res, opts);
  } else {
    logger.info(`rejecting INVITE from ${req.source_address} because it is not a siprec INVITE`);
    res.send(488);
  }
  delete require.cache[require.resolve('config')];
};

function handleIncomingSiprecInvite(req, res, opts) {
  const srf = req.srf;
  let recorderUri;
  debug(`request: ${req}`);
  return payloadParser(opts)
    .then(getRecorderUri)
    .then((opts) => {
      opts.logger.info(`Called number: ${opts.callee.number}`);

      // const recorderUri = getRecorderUri.bind(null, opts.callee.number);
      console.log(opts.result);
      if (opts.result != null) {
        recorderUri = opts.result;
      } else {
        recorderUri = getAvailableLoadBalancers();
      }

      opts.logger.info(`handleIncomingSiprecInvite: sending to ${recorderUri}`);

      const headers = {
        'X-SBC-Call-ID': opts.originalCallId,
        'User-To-User': opts.ucid,
        'X-Recording-Method': 'SIPREC',
        'X-Original-From': opts.caller.aor,
        'X-Original-To': opts.callee.aor,
        'User-Agent': opts.caller.host
      };

      const callOpts = {
        callingNumber: opts.caller.number,
        calledNumber: opts.callee.number,
        passProvisionalResponses: false,
        headers,
        proxyRequestHeaders: ['Content-Type']
      };

      return srf.createB2BUA(req, res, recorderUri, callOpts);
    })
    .catch((err) => {
      opts.logger.error(err, 'Error connecting incoming SIPREC call to recorder');
      throw err;
    })
    .then(setDialogHandlers.bind(this, opts.logger));
}

function setDialogHandlers(logger, { uas, uac }) {
  uas
    .on('destroy', () => {
      logger.info('call ended normally from SRC');
      uac.destroy();
    })
    .on('refresh', () => logger.info('received refreshing re-INVITE from siprec client'))
    .on('modify', (req, res) => {
      logger.info('received re-INVITE from SRC');
      res.send(200, {
        body: uas.local.sdp
      });
    });

  uac
    .on('destroy', () => {
      logger.info('call ended unexpectedly with BYE from Recorder');
      uas.destroy();
    })
    .on('refresh', () => logger.info('received refreshing re-INVITE from Recorder'));
}

function getRecorderUri(opts) {
  return new Promise((resolve, reject) => {
    client.get(opts.callee.number, (err, result) => {
      if (err) {
        return reject(err);
      }
      opts.result = result;
      resolve(opts);
    });
  });
}
