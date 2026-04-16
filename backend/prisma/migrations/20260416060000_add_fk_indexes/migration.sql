-- CreateIndex
CREATE INDEX "User_eventId_idx" ON "User"("eventId");

-- CreateIndex
CREATE INDEX "Checkpoint_eventId_idx" ON "Checkpoint"("eventId");

-- CreateIndex
CREATE INDEX "TeamRoute_teamId_idx" ON "TeamRoute"("teamId");
