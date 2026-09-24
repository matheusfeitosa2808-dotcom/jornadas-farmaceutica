CREATE TABLE "ArenaCreditChoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArenaCreditChoice_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ArenaCreditChoice_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "ArenaChallenge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ArenaCreditChoice_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ArenaCreditChoice_participantId_challengeId_key" ON "ArenaCreditChoice"("participantId", "challengeId");
CREATE INDEX "ArenaCreditChoice_editionId_createdAt_idx" ON "ArenaCreditChoice"("editionId", "createdAt");
