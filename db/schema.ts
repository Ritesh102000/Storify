import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const worldPreviews = sqliteTable("world_previews", {
  previewId: text("preview_id").primaryKey(),
  templateId: text("template_id"),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const worldSessions = sqliteTable("world_sessions", {
  universeId: text("universe_id").primaryKey(),
  branchId: text("branch_id").notNull(),
  templateId: text("template_id"),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const generationLogs = sqliteTable("generation_logs", {
  logId: text("log_id").primaryKey(),
  universeId: text("universe_id"),
  operation: text("operation").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  status: text("status").notNull(),
  latencyMs: text("latency_ms").notNull(),
  usedFallback: text("used_fallback").notNull(),
  createdAt: text("created_at").notNull(),
});

export const detectiveSessions = sqliteTable("detective_sessions", {
  caseId: text("case_id").primaryKey(),
  revision: integer("revision").notNull(),
  status: text("status").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
