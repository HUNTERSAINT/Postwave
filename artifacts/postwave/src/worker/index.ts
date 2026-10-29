import { Worker } from "bullmq";
import { POSTWAVE_QUEUE_NAME, type PublishJobData } from "@/lib/queue/publish-queue";
import { getRedisConnection } from "@/lib/queue/connection";
import { logger } from "@/lib/logger";
import { processPublishJob } from "@/lib/worker/publish-post";
import { enqueueDueScheduledPosts } from "@/lib/worker/schedule-due-posts";

const connection = getRedisConnection();
const worker = new Worker<PublishJobData>(
  POSTWAVE_QUEUE_NAME,
  async (job) => processPublishJob(job.data, job),
  {
    connection,
    concurrency: 5,
  },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id, name: job.name }, "Postwave job completed");
});

worker.on("failed", (job, error) => {
  logger.error(
    {
      jobId: job?.id,
      name: job?.name,
      errorName: error.name,
    },
    "Postwave job exhausted its retries",
  );
});

worker.on("error", (error) => {
  logger.error({ errorName: error.name }, "Postwave worker error");
});

let scanningScheduledPosts = false;
async function scanScheduledPosts() {
  if (scanningScheduledPosts) return;
  scanningScheduledPosts = true;
  try {
    await enqueueDueScheduledPosts();
  } catch (error) {
    logger.error(
      {
        errorName: error instanceof Error ? error.name : "UnknownError",
      },
      "Scheduled post scanner failed",
    );
  } finally {
    scanningScheduledPosts = false;
  }
}

void scanScheduledPosts();
const scheduledPostScanTimer = setInterval(
  () => void scanScheduledPosts(),
  15_000,
);
scheduledPostScanTimer.unref();

const shutdown = async () => {
  clearInterval(scheduledPostScanTimer);
  await worker.close();
  await connection.quit();
};

process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());

logger.info({ queue: POSTWAVE_QUEUE_NAME }, "Postwave publishing worker started");
