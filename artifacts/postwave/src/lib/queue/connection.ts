import Redis from "ioredis";
import { HttpError } from "@/lib/http";

type RedisGlobals = typeof globalThis & {
  __postwaveRedis?: Redis;
};

const globals = globalThis as RedisGlobals;

export function getRedisConnection() {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new HttpError(503, "The publishing queue is not configured.");
  }

  return (
    globals.__postwaveRedis ??
    (globals.__postwaveRedis = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    }))
  );
}
