-- CreateTable
CREATE TABLE "Edition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "slogan" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Manaus',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "maxActivities" INTEGER NOT NULL DEFAULT 5,
    "maxCheckins" INTEGER NOT NULL DEFAULT 5,
    "normalMinutes" INTEGER NOT NULL DEFAULT 15,
    "noShowMinutes" INTEGER NOT NULL DEFAULT 20,
    "lateMinutes" INTEGER NOT NULL DEFAULT 25,
    "checkoutMinutes" INTEGER NOT NULL DEFAULT 24,
    "reminderMinutes" TEXT NOT NULL DEFAULT '30,10',
    "allowMultipleRewards" BOOLEAN NOT NULL DEFAULT true,
    "logoUrl" TEXT NOT NULL DEFAULT '/assets/brand/logo-jornada-2026.png',
    "primaryColor" TEXT NOT NULL DEFAULT '#183d43',
    "secondaryColor" TEXT NOT NULL DEFAULT '#ba975b',
    "backgroundColor" TEXT NOT NULL DEFAULT '#f8f6f0',
    "certificateTemplateUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "ra" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "photoUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Participant_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "description" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    PRIMARY KEY ("roleId", "permissionId"),
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "permissions" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminUser_role_fkey" FOREIGN KEY ("role") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "adminId" TEXT,
    "participantId" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#183d43',
    "icon" TEXT NOT NULL DEFAULT 'book',
    "order" INTEGER NOT NULL DEFAULT 0,
    "requiresEnrollment" BOOLEAN NOT NULL DEFAULT true,
    "requiresCheckin" BOOLEAN NOT NULL DEFAULT true,
    "requiresCheckout" BOOLEAN NOT NULL DEFAULT false,
    "generatesStamp" BOOLEAN NOT NULL DEFAULT true,
    "generatesCertificate" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stampUrl" TEXT,
    CONSTRAINT "ActivityCategory_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Speaker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "photoUrl" TEXT,
    "curriculumUrl" TEXT,
    "institution" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Speaker_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "block" TEXT NOT NULL DEFAULT '',
    "room" TEXT NOT NULL DEFAULT '',
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "enrollmentOpen" BOOLEAN NOT NULL DEFAULT true,
    "enrollmentDeadline" DATETIME,
    "swapDeadline" DATETIME,
    "workload" REAL NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "allowWaitlist" BOOLEAN NOT NULL DEFAULT true,
    "stampUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Activity_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Activity_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ActivityCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivitySpeaker" (
    "activityId" TEXT NOT NULL,
    "speakerId" TEXT NOT NULL,

    PRIMARY KEY ("activityId", "speakerId"),
    CONSTRAINT "ActivitySpeaker_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivitySpeaker_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "Speaker" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lateEnrollment" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'PARTICIPANT',
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Enrollment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Enrollment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotedAt" DATETIME,
    CONSTRAINT "WaitlistEntry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WaitlistEntry_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "checkinAt" DATETIME,
    "checkoutAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    CONSTRAINT "Attendance_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Attendance_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attendanceId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceEvent_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PassportStamp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    CONSTRAINT "PassportStamp_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PassportStamp_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PassportStamp_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ActivityCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PassportStamp_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "total" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "confirmationMinutes" INTEGER NOT NULL DEFAULT 60,
    "exclusiveGroup" TEXT,
    CONSTRAINT "RewardItem_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "minCheckins" INTEGER NOT NULL DEFAULT 1,
    "categoryId" TEXT,
    "activityId" TEXT,
    "completeJourney" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RewardRule_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "RewardItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RewardRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ActivityCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RewardRule_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardEligibility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "eligible" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RewardEligibility_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "RewardItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RewardEligibility_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardDraw" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "stockSnapshot" INTEGER NOT NULL,
    "eligibleCount" INTEGER NOT NULL,
    "operatorId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'EXECUTED',
    "randomSeed" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    CONSTRAINT "RewardDraw_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "RewardItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardDrawEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drawId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "winner" BOOLEAN NOT NULL,
    "rank" INTEGER NOT NULL,
    CONSTRAINT "RewardDrawEntry_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "RewardDraw" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RewardDrawEntry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "drawId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_CONFIRMATION',
    "expiresAt" DATETIME NOT NULL,
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RewardReservation_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "RewardItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RewardReservation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RewardReservation_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "RewardDraw" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "operatorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DELIVERED',
    "deliveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" DATETIME,
    "reverseReason" TEXT,
    CONSTRAINT "RewardDelivery_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RewardDelivery_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "RewardItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RewardDelivery_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "RewardReservation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "workload" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RELEASED',
    "pdfUrl" TEXT,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invalidatedAt" DATETIME,
    "invalidationReason" TEXT,
    CONSTRAINT "Certificate_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Certificate_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'selected',
    "dedupeKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notificationId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "readAt" DATETIME,
    "pushedAt" DATETIME,
    CONSTRAINT "NotificationRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NotificationRecipient_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "participantId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "valid" INTEGER NOT NULL,
    "invalid" INTEGER NOT NULL,
    "duplicates" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "ra" TEXT NOT NULL,
    "semester" INTEGER,
    "status" TEXT NOT NULL,
    "error" TEXT,
    CONSTRAINT "ImportRow_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "editionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "url" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Sponsor_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Edition_slug_key" ON "Edition"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_editionId_ra_key" ON "Participant"("editionId", "ra");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityCategory_editionId_slug_key" ON "ActivityCategory"("editionId", "slug");

-- CreateIndex
CREATE INDEX "Activity_editionId_startAt_idx" ON "Activity"("editionId", "startAt");

-- CreateIndex
CREATE INDEX "Enrollment_editionId_activityId_status_idx" ON "Enrollment"("editionId", "activityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_participantId_activityId_key" ON "Enrollment"("participantId", "activityId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_activityId_status_createdAt_idx" ON "WaitlistEntry"("activityId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_participantId_activityId_key" ON "WaitlistEntry"("participantId", "activityId");

-- CreateIndex
CREATE INDEX "Attendance_editionId_idx" ON "Attendance"("editionId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_participantId_activityId_key" ON "Attendance"("participantId", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "PassportStamp_attendanceId_key" ON "PassportStamp"("attendanceId");

-- CreateIndex
CREATE UNIQUE INDEX "PassportStamp_participantId_activityId_key" ON "PassportStamp"("participantId", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardEligibility_rewardId_participantId_key" ON "RewardEligibility"("rewardId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardDraw_rewardId_round_key" ON "RewardDraw"("rewardId", "round");

-- CreateIndex
CREATE UNIQUE INDEX "RewardDrawEntry_drawId_participantId_key" ON "RewardDrawEntry"("drawId", "participantId");

-- CreateIndex
CREATE INDEX "RewardReservation_editionId_status_expiresAt_idx" ON "RewardReservation"("editionId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_code_key" ON "Certificate"("code");

-- CreateIndex
CREATE INDEX "Certificate_editionId_participantId_activityId_idx" ON "Certificate"("editionId", "participantId", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecipient_notificationId_participantId_key" ON "NotificationRecipient"("notificationId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "AuditLog_editionId_createdAt_idx" ON "AuditLog"("editionId", "createdAt");
