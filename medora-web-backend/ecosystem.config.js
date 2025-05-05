module.exports = {
  apps: [
    {
      name: "backend",
      script: "/var/www/medora-web-backend/grok_server.py",
      cwd: "/var/www/medora-web-backend",
      interpreter: "python3",
      env: {
        FLASK_ENV: "development",
        PORT: 5000,
        LOG_LEVEL: "DEBUG",
        XAI_API_KEY: "xai-JsuTwtlWoA40i9QsLoHlVuA8qRLd2gAo1qJmckB7a1CURT5iPmO6G5kHDRec6V1uJy637pg5icPKN7IR",
        XAI_API_URL: "https://api.x.ai/v1/chat/completions",
        DEEPL_API_KEY: "",
        DEEPL_API_URL: "https://api-free.deepl.com/v2/translate",
        MONGO_URI: "mongodb://medoramd:MedoraPass123@docdb-staging.cluster-cjisimciy64z.ap-south-1.docdb.amazonaws.com:27017/medora?tls=true&tlsCAFile=/var/www/medora-web-backend/global-bundle.pem&authSource=medora&authMechanism=SCRAM-SHA-1&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false",
        MONGO_DB_NAME: "medora"
      }
    }
  ]
};
