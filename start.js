const { spawn } = require('child_process');
const { join } = require('path');

const RAILWAY_SERVICE_NAME = process.env.RAILWAY_SERVICE_NAME;
const RAILWAY_SERVICE_ID = process.env.RAILWAY_SERVICE_ID;
const isLavalinkService = RAILWAY_SERVICE_NAME === 'lavalink' || RAILWAY_SERVICE_ID === '2e648e5b-75b2-43d2-a1e0-949364ad5439';

if (isLavalinkService) {
  const jarPath = join(__dirname, 'lavalink', 'Lavalink.jar');
  console.log('Starting Lavalink service from', jarPath);

  const proc = spawn('java', ['-jar', jarPath], { stdio: 'inherit' });

  proc.on('exit', code => {
    process.exit(code);
  });
  proc.on('error', error => {
    console.error('Failed to start Lavalink:', error);
    process.exit(1);
  });
} else {
  require('./src/index.js');
}
