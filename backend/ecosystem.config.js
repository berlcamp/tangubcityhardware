module.exports = {
  apps: [
    {
      name: "tangub-backend",
      script: "dist/main.js",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        DATABASE_URL:
          "postgresql://postgres:postgres@localhost:5432/tangubcityhardware",
      },
    },
  ],
};
