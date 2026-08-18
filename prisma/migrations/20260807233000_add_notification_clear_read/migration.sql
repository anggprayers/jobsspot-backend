-- Preserve cleared notifications for idempotency/audit while hiding them from user inboxes.
ALTER TABLE "Notification" ADD COLUMN "clearedAt" TIMESTAMP(3);

CREATE INDEX "Notification_userId_audience_clearedAt_createdAt_idx"
ON "Notification"("userId", "audience", "clearedAt", "createdAt");
