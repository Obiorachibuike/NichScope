export const JOB_NAMES = [
  "youtube.discovery",
  "youtube.video-metadata",
  "youtube.channel-metadata",
  "data.retention",
  "data.refresh",
  "licensed.ingest",
  "rankings.generate",
  "ai.report.generate",
  "watchlist.monitor",
  "quota.monitor",
  "snapshots.cleanup",
  "worker.heartbeat",
] as const;

export type JobName = (typeof JOB_NAMES)[number];

export function isJobName(value: string): value is JobName {
  return (JOB_NAMES as readonly string[]).includes(value);
}

export const JOB_DESCRIPTIONS: Record<JobName, string> = {
  "youtube.discovery": "Runs a quota-aware YouTube discovery search for a supplied query.",
  "youtube.video-metadata": "Refreshes stored video metadata that is due for refresh.",
  "youtube.channel-metadata": "Refreshes stored channel metadata that is due for refresh.",
  "data.retention": "Deletes public YouTube data older than the 30-day policy window.",
  "data.refresh": "Refreshes eligible public data and purges expired snapshots.",
  "licensed.ingest": "Ingests licensed analytics data when a provider adapter is configured.",
  "rankings.generate": "Recalculates opportunity rankings for all eligible sources.",
  "ai.report.generate": "Generates an AI research report asynchronously.",
  "watchlist.monitor": "Creates watchlist alerts for eligible ranking or metric changes.",
  "quota.monitor": "Checks YouTube quota consumption and raises operational warnings.",
  "snapshots.cleanup": "Removes expired cached API snapshots.",
  "worker.heartbeat": "Writes a worker liveness heartbeat for the admin health page.",
};

export interface JobPayload {
  [key: string]: unknown;
}
