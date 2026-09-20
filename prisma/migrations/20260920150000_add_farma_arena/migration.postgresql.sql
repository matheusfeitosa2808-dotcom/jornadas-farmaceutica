ALTER TABLE "RewardItem" ADD COLUMN IF NOT EXISTS "redemptionMode" TEXT NOT NULL DEFAULT 'ELIGIBILITY';
ALTER TABLE "RewardItem" ADD COLUMN IF NOT EXISTS "xpCost" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RewardItem" ADD COLUMN IF NOT EXISTS "maxPerParticipant" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "ArenaConfig" (
  "id" TEXT PRIMARY KEY, "editionId" TEXT NOT NULL UNIQUE REFERENCES "Edition"("id"),
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE, "logoUrl" TEXT, "accentColor" TEXT NOT NULL DEFAULT '#9f2f2f',
  "rankingEnabled" BOOLEAN NOT NULL DEFAULT TRUE, "rankingVisibility" TEXT NOT NULL DEFAULT 'AUTHENTICATED',
  "firstPlaceTitle" TEXT NOT NULL DEFAULT 'Rei da Jornada', "secondPlaceTitle" TEXT NOT NULL DEFAULT 'Guerreiro da Jornada',
  "thirdPlaceTitle" TEXT NOT NULL DEFAULT 'Desafiante da Jornada', "transitionEffect" TEXT NOT NULL DEFAULT 'EMBER_STAMP',
  "xpReleaseMode" TEXT NOT NULL DEFAULT 'MANUAL', "xpReleaseDelaySeconds" INTEGER NOT NULL DEFAULT 0,
  "combinePendingAwards" BOOLEAN NOT NULL DEFAULT FALSE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "ArenaChallenge" (
  "id" TEXT PRIMARY KEY, "editionId" TEXT NOT NULL REFERENCES "Edition"("id"), "title" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '', "instructions" TEXT NOT NULL DEFAULT '', "iconUrl" TEXT, "xpReward" INTEGER NOT NULL DEFAULT 100,
  "mode" TEXT NOT NULL DEFAULT 'INDIVIDUAL', "validationMode" TEXT NOT NULL DEFAULT 'OPERATOR', "minTeamSize" INTEGER NOT NULL DEFAULT 1,
  "maxTeamSize" INTEGER NOT NULL DEFAULT 1, "repeatable" BOOLEAN NOT NULL DEFAULT FALSE, "maxCompletionsPerParticipant" INTEGER NOT NULL DEFAULT 1,
  "startsAt" TIMESTAMP(3), "endsAt" TIMESTAMP(3), "category" TEXT NOT NULL DEFAULT 'CONHECIMENTO', "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "order" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("editionId", "slug")
);
CREATE INDEX IF NOT EXISTS "ArenaChallenge_editionId_active_order_idx" ON "ArenaChallenge"("editionId", "active", "order");
CREATE TABLE IF NOT EXISTS "ArenaCompletion" (
  "id" TEXT PRIMARY KEY, "editionId" TEXT NOT NULL REFERENCES "Edition"("id"), "challengeId" TEXT NOT NULL REFERENCES "ArenaChallenge"("id"),
  "participantId" TEXT NOT NULL REFERENCES "Participant"("id"), "teamSessionId" TEXT, "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validatedBy" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'VALID', "xpAwarded" INTEGER NOT NULL DEFAULT 0, "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ArenaCompletion_editionId_participantId_status_idx" ON "ArenaCompletion"("editionId", "participantId", "status");
CREATE INDEX IF NOT EXISTS "ArenaCompletion_challengeId_participantId_status_idx" ON "ArenaCompletion"("challengeId", "participantId", "status");
CREATE TABLE IF NOT EXISTS "XpTransaction" (
  "id" TEXT PRIMARY KEY, "editionId" TEXT NOT NULL REFERENCES "Edition"("id"), "participantId" TEXT NOT NULL REFERENCES "Participant"("id"),
  "type" TEXT NOT NULL, "balanceDelta" INTEGER NOT NULL, "rankingDelta" INTEGER NOT NULL, "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '', "idempotencyKey" TEXT NOT NULL UNIQUE, "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "XpTransaction_editionId_participantId_createdAt_idx" ON "XpTransaction"("editionId", "participantId", "createdAt");
CREATE INDEX IF NOT EXISTS "XpTransaction_editionId_rankingDelta_idx" ON "XpTransaction"("editionId", "rankingDelta");
CREATE TABLE IF NOT EXISTS "ArenaXpAward" (
  "id" TEXT PRIMARY KEY, "editionId" TEXT NOT NULL REFERENCES "Edition"("id"), "participantId" TEXT NOT NULL REFERENCES "Participant"("id"),
  "challengeId" TEXT NOT NULL REFERENCES "ArenaChallenge"("id"), "completionId" TEXT NOT NULL UNIQUE REFERENCES "ArenaCompletion"("id"),
  "amount" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "releaseMode" TEXT NOT NULL DEFAULT 'MANUAL', "releaseAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3), "releasedBy" TEXT, "xpTransactionId" TEXT UNIQUE REFERENCES "XpTransaction"("id") ON DELETE SET NULL,
  "animationStatus" TEXT NOT NULL DEFAULT 'QUEUED', "animationDeliveredAt" TIMESTAMP(3), "animationSeenAt" TIMESTAMP(3),
  "animationVariant" TEXT NOT NULL DEFAULT 'STANDARD', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ArenaXpAward_editionId_status_releaseAt_idx" ON "ArenaXpAward"("editionId", "status", "releaseAt");
CREATE INDEX IF NOT EXISTS "ArenaXpAward_participantId_animationStatus_idx" ON "ArenaXpAward"("participantId", "animationStatus");
