ALTER TABLE "RewardItem" ADD COLUMN "redemptionMode" TEXT NOT NULL DEFAULT 'ELIGIBILITY';
ALTER TABLE "RewardItem" ADD COLUMN "xpCost" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RewardItem" ADD COLUMN "maxPerParticipant" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "ArenaConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "editionId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "logoUrl" TEXT,
  "accentColor" TEXT NOT NULL DEFAULT '#9f2f2f',
  "rankingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "rankingVisibility" TEXT NOT NULL DEFAULT 'AUTHENTICATED',
  "firstPlaceTitle" TEXT NOT NULL DEFAULT 'Rei da Jornada',
  "secondPlaceTitle" TEXT NOT NULL DEFAULT 'Guerreiro da Jornada',
  "thirdPlaceTitle" TEXT NOT NULL DEFAULT 'Desafiante da Jornada',
  "transitionEffect" TEXT NOT NULL DEFAULT 'EMBER_STAMP',
  "xpReleaseMode" TEXT NOT NULL DEFAULT 'MANUAL',
  "xpReleaseDelaySeconds" INTEGER NOT NULL DEFAULT 0,
  "combinePendingAwards" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ArenaConfig_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ArenaConfig_editionId_key" ON "ArenaConfig"("editionId");

CREATE TABLE "ArenaChallenge" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "editionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "instructions" TEXT NOT NULL DEFAULT '',
  "iconUrl" TEXT,
  "xpReward" INTEGER NOT NULL DEFAULT 100,
  "mode" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
  "validationMode" TEXT NOT NULL DEFAULT 'OPERATOR',
  "minTeamSize" INTEGER NOT NULL DEFAULT 1,
  "maxTeamSize" INTEGER NOT NULL DEFAULT 1,
  "repeatable" BOOLEAN NOT NULL DEFAULT false,
  "maxCompletionsPerParticipant" INTEGER NOT NULL DEFAULT 1,
  "startsAt" DATETIME,
  "endsAt" DATETIME,
  "category" TEXT NOT NULL DEFAULT 'CONHECIMENTO',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ArenaChallenge_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ArenaChallenge_editionId_slug_key" ON "ArenaChallenge"("editionId", "slug");
CREATE INDEX "ArenaChallenge_editionId_active_order_idx" ON "ArenaChallenge"("editionId", "active", "order");

CREATE TABLE "ArenaCompletion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "editionId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "teamSessionId" TEXT,
  "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validatedBy" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'VALID',
  "xpAwarded" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArenaCompletion_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ArenaCompletion_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "ArenaChallenge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ArenaCompletion_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ArenaCompletion_editionId_participantId_status_idx" ON "ArenaCompletion"("editionId", "participantId", "status");
CREATE INDEX "ArenaCompletion_challengeId_participantId_status_idx" ON "ArenaCompletion"("challengeId", "participantId", "status");

CREATE TABLE "XpTransaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "editionId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "balanceDelta" INTEGER NOT NULL,
  "rankingDelta" INTEGER NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "idempotencyKey" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "XpTransaction_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "XpTransaction_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "XpTransaction_idempotencyKey_key" ON "XpTransaction"("idempotencyKey");
CREATE INDEX "XpTransaction_editionId_participantId_createdAt_idx" ON "XpTransaction"("editionId", "participantId", "createdAt");
CREATE INDEX "XpTransaction_editionId_rankingDelta_idx" ON "XpTransaction"("editionId", "rankingDelta");

CREATE TABLE "ArenaXpAward" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "editionId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "completionId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "releaseMode" TEXT NOT NULL DEFAULT 'MANUAL',
  "releaseAt" DATETIME,
  "releasedAt" DATETIME,
  "releasedBy" TEXT,
  "xpTransactionId" TEXT,
  "animationStatus" TEXT NOT NULL DEFAULT 'QUEUED',
  "animationDeliveredAt" DATETIME,
  "animationSeenAt" DATETIME,
  "animationVariant" TEXT NOT NULL DEFAULT 'STANDARD',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ArenaXpAward_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ArenaXpAward_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ArenaXpAward_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "ArenaChallenge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ArenaXpAward_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "ArenaCompletion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ArenaXpAward_xpTransactionId_fkey" FOREIGN KEY ("xpTransactionId") REFERENCES "XpTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ArenaXpAward_completionId_key" ON "ArenaXpAward"("completionId");
CREATE UNIQUE INDEX "ArenaXpAward_xpTransactionId_key" ON "ArenaXpAward"("xpTransactionId");
CREATE INDEX "ArenaXpAward_editionId_status_releaseAt_idx" ON "ArenaXpAward"("editionId", "status", "releaseAt");
CREATE INDEX "ArenaXpAward_participantId_animationStatus_idx" ON "ArenaXpAward"("participantId", "animationStatus");
