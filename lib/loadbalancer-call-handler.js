/**
 * Call comes in and its a SIPREC call (multi-part content)
 * Parse the payload into two sdps
 * Creeate a uuid and store the uniused sdp by uuid
 * Srf#createB2BUA where localSdpA is the SDP we will use first,
 * and localSdpB is a function that pulls the sdp back out of redis
 * and creates a multipart SDP
 * Now, when the other INVITE comes in from freeswwitch
 * we pull the unused SDP out of redis and stick the one FS is offering back in there
 * we send 200 OK with the unused SDP and we are done
 */
const payloadParser = require('./payload-parser');
const { getAvailableLoadBalancers } = require('./utils');
const debug = require('debug')('drachtio:siprec-recording-server');

module.exports = (logger) => {
  if (logger) {
    logger.info('Entered recorder call handler');
  }
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
};

function handleIncomingSiprecInvite(req, res, opts) {
  const srf = req.srf;
  debug(`request: ${req}`);
  return payloadParser(opts)
    .then((opts) => {
      const recorderUri = getAvailableLoadBalancers();
      opts.logger.info(`handleIncomingSiprecInvite: sending to ${recorderUri}`);

      const headers = {
        'X-SBC-Call-ID': opts.originalCallId,
        'User-To-User': opts.ucid,
        'X-Recording-Method': 'SIPREC'
      };

      const callOpts = {
        callingNumber: opts.caller.number,
        calledNumber: opts.callee.number,
        passProvisionalResponses: false,
        headers,
        proxyRequestHeaders: ['Content-Type']
        // localSdpB: req.SipMessage.body
        // localSdpA: createSdpForResponse.bind(null, opts.sessionId)
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
