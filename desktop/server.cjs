// Run in Electron's Node utility process, never in the game renderer.
if (process.env.IPL_DESKTOP_OFFLINE_TEST === '1') require('./offline-test.cjs');
require(process.argv[2]);
