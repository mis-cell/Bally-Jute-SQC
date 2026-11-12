// ==============================================================================
// PM2 Ecosystem Configuration for SQC Management System
// Target Server : BJCL
// Port          : 3001
// Auto-restart on failure, memory limit monitoring, and Windows boot auto-start
// ==============================================================================

module.exports = {
  apps: [
    {
      name: 'sqc-server',
      script: './server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DB_HOST: 'BJCL',
        DB_PORT: 5432,
        DB_NAME: 'IT SQC',
        DB_USER: 'postgres',
        DB_PASSWORD: 'postgres',
      },
      error_file: './logs/sqc-error.log',
      out_file: './logs/sqc-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
