import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/queue/connection";

export const POSTWAVE_QUEUE_NAME = "postwave-publishing";

export type PublishJobData = {
  postId: string;
  userId: string;
  targetIds?: string[];
  idempotencyKey: string;
};

type QueueGlobals = typeof globalThis & {
  __postwavePublishQueue?: Queue<PublishJobData>;
};

const globals = globalThis as QueueGlobals;

export function getPublishQueue() {
  return (
    globals.__postwavePublishQueue ??
    (globals.__postwavePublishQueue = new Queue<PublishJobData>(
      POSTWAVE_QUEUE_NAME,
      {
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 1_500 },
          removeOnComplete: { age: 86_400, count: 1_000 },
          removeOnFail: { age: 604_800, count: 5_000 },
        },
      },
    ))
  );
}
