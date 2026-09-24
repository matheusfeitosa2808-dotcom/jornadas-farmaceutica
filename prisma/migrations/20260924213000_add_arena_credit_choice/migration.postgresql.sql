CREATE TABLE IF NOT EXISTS "ArenaCreditChoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL REFERENCES "Edition"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "challengeId" TEXT NOT NULL REFERENCES "ArenaChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "participantId" TEXT NOT NULL REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "discipline" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ArenaCreditChoice_participantId_challengeId_key" ON "ArenaCreditChoice"("participantId", "challengeId");
CREATE INDEX IF NOT EXISTS "ArenaCreditChoice_editionId_createdAt_idx" ON "ArenaCreditChoice"("editionId", "createdAt");
