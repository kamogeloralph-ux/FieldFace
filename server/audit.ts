import { db } from "./db";
import { auditLogs } from "../drizzle/schema";

export async function writeAudit(input: {
  actorType: string;
  actorId?: string;
  employerId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    actorType: input.actorType,
    actorId: input.actorId,
    employerId: input.employerId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
  });
}
