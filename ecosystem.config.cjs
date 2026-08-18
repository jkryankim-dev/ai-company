module.exports = {
  apps: [
    { name: 'doore-scheduler', script: 'runtime/scheduler.mjs', interpreter: 'node', autorestart: true, max_restarts: 20 },
    { name: 'doore-gateway',   script: 'runtime/gateway.mjs',   interpreter: 'node', autorestart: true, max_restarts: 20 },
  ],
};
