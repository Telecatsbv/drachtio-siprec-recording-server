const config = require('config');
const assert = require('assert');
const Client = require('rtpengine-client').Client ;
const obj = module.exports = {} ;

let idr = 0;
let loadbalancers;
obj.getAvailableLoadBalancers = () => {
  loadbalancers = loadbalancers || config.get('loadbalancer');
  if (idr == loadbalancers.length) idr = 0;
  return loadbalancers[idr++];
};

obj.isFreeswitchSource = (req) => {
  console.log(`has token? ${req.has('X-Return-Token')}: ${req.get('X-Return-Token')}`);
  return req.has('X-Return-Token');
};

let idx = 0;
let servers;
obj.getAvailableFreeswitch = () => {
  servers = servers || config.get('freeswitch');
  if (idx == servers.length) idx = 0;
  return servers[idx++];
};


let idxRtpe = 0;
let rtpes;
obj.getAvailableRtpengine = () => {
  if (!rtpes) {
    let rtpEngines = config.get('rtpengine');
    rtpEngines = Array.isArray(rtpEngines) ? rtpEngines : [rtpEngines];
    rtpes = rtpEngines.map((r) => {
      // console.log(r);
      const port = r.localPort || 0;
      // console.log(`port: ${port}`);
      const rtpe = new Client({localPort: port, timeout: 3000});
      rtpe.remote = r.remote;
      rtpe.record = r.record;
      rtpe.mediaAddress = r.mediaAddress;
      return rtpe;
    });
  }
  assert(rtpes.length > 0);
  if (idxRtpe == rtpes.length) idxRtpe = 0;
  return rtpes[idxRtpe++];
};
