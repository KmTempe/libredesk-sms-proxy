module.exports = {
  apps: [
    {
      name: 'sms-proxy',
      script: './server/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3400,
        DATA_DIR: './data'
      },
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: './data/err.log',
      out_file: './data/out.log',
      merge_logs: true
    }
  ]
};
