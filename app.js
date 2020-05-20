const assert = require('assert');
const config = require('config');
const pino = require('pino');
const methods = require('sip-methods') ;
const Srf = require('drachtio-srf');
const srf = new Srf() ;
const logger = srf.locals.logger = pino();
let callHandler;

if (config.has('drachtio.host')) {
  logger.info(config.get('drachtio'), 'attempting inbound connection');
  srf.connect(config.get('drachtio'));
  srf
    .on('connect', (err, hp) => { logger.info(`inbound connection to drachtio listening on ${hp}`);})
    .on('error', (err) => { logger.error(err, `Error connecting to drachtio server: ${err}`); });
}
else {
  logger.info(config.get('drachtio'), 'listening for outbound connections');
  srf.listen(config.get('drachtio'));
}

if (config.has('rtpengine')) {
  logger.info(config.get('rtpengine'), 'using rtpengine as the recorder');
  callHandler = require('./lib/rtpengine-call-handler');

  // we only want to deal with siprec invites (having multipart content) in this application
  srf.use('invite', (req, res, next) => {
    const ctype = req.get('Content-Type') || '';
    if (!ctype.includes('multipart/mixed')) {
      logger.info(`rejecting non-SIPREC INVITE with call-id ${req.get('Call-ID')}`);
      return res.send(488);
    }
    next();
  });

}
else if (config.has('freeswitch')) {
  logger.info(config.get('freeswitch'), 'using freeswitch as the recorder');
  callHandler = require('./lib/freeswitch-call-handler')(logger);
}
else {
  assert('recorder type not specified in configuration: must be either rtpengine or freeswitch');
}

//Here we define a handler for incoming SIP OPTIONS. We reply 200 OK on the request with the (extra) headers
const allowedMethods = 'INVITE, ACK, CANCEL, OPTIONS, BYE, UPDATE';
srf.use('options', (req, res, next) => {
  const callid = req.get('Call-ID');
  const logger = req.srf.locals.logger.child({callid});
  logger.info('Received options, reply 200 OK');
  return res.send(200, {
    headers: { 
      'Allow': allowedMethods,
	  'Accept': 'application/sdp'
    }
  });
});


//methods contains all the known SIP methods. We have our own allowedMethods (used for OPTIONS response).
//Here we define a handler for all methods not listed in the allowedMethods.
methods.forEach((method) => {
	if ( ! allowedMethods.includes(method) ) {
		logger.info(`Adding reject handler for sip method ${method}`);
		srf.use( method.toLowerCase(), (req, res, next) => {
			const callid = req.get('Call-ID');
			const logger = req.srf.locals.logger.child({callid});
			logger.info('Received unwanted method, reply 405');
			return res.send(405);
		} )
	}
} );

srf.invite(callHandler);

module.exports = srf;
