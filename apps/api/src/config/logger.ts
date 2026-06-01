import pino from "pino";
import { isProduction } from "./env.js";

const options: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug")
};

if (!isProduction) {
  options.transport = {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard"
    }
  };
}

export const logger = pino(options);
