// PM2 Ecosystem Config for Serv00 Deployment
// Run with: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'silenx-backend',
      script: 'dist/server.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // Restart if it crashes, wait 5s between restarts
      restart_delay: 5000,
      // Keep logs stored in ~/logs/
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Auto-save process list so it survives server reboots
      exp_backoff_restart_delay: 100,
    },
  ],
};
