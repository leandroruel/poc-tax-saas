import { Queue, Worker, type Job, type Processor } from "bullmq";

export const taxmanQueueName = "taxman-background-jobs";

export type TaxmanJobData = Readonly<Record<string, string | number | boolean>>;

function redisConnection(maxRetriesPerRequest: number | null) {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required.");
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
    maxRetriesPerRequest,
  };
}

export function createTaxmanQueue() {
  return new Queue<TaxmanJobData, void, string>(taxmanQueueName, {
    connection: redisConnection(1),
  });
}

export function createTaxmanWorker(
  processor: Processor<TaxmanJobData>,
  concurrency = 4,
) {
  return new Worker<TaxmanJobData, void, string>(taxmanQueueName, processor, {
    connection: redisConnection(null),
    concurrency,
  });
}

export type TaxmanJob = Job<TaxmanJobData, void, string>;
