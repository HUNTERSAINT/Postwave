import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "authorization",
      "headers.authorization",
      "req.headers.authorization",
      "apiKey",
      "token",
      "password",
      "passwordHash",
      "secret",
    ],
    censor: "[REDACTED]",
  },
});
