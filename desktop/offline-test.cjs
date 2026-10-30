// Test harness only: allow loopback, reject all other DNS lookups in the server.
const dns = require('node:dns');
dns.lookup = (host, options, callback) => {
  if (typeof options === 'function') { callback = options; options = {}; }
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    const address = host === '::1' ? '::1' : '127.0.0.1';
    const family = host === '::1' ? 6 : 4;
    return process.nextTick(() => options?.all ? callback(null, [{ address, family }]) : callback(null, address, family));
  }
  process.nextTick(() => callback(Object.assign(new Error('Offline desktop test'), { code: 'ENOTFOUND' })));
};
