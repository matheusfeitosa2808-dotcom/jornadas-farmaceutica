type ActivityWindow = {
  startAt: string | Date;
  enrollmentDeadline?: string | Date | null;
  swapDeadline?: string | Date | null;
  enrollmentOpen?: boolean;
  status?: string;
};

export function activityEnrollmentDeadline(
  activity: ActivityWindow,
  lateMinutes: number,
) {
  const explicit = activity.enrollmentDeadline || activity.swapDeadline;
  if (explicit) return new Date(explicit).getTime();
  return new Date(activity.startAt).getTime() + lateMinutes * 60_000;
}

export function activitySwapDeadline(
  activity: ActivityWindow,
  lateMinutes: number,
) {
  return activity.swapDeadline
    ? new Date(activity.swapDeadline).getTime()
    : activityEnrollmentDeadline(activity, lateMinutes);
}

export function isActivityOpenInProgram(
  activity: ActivityWindow,
  now: string | Date,
  lateMinutes: number,
) {
  if (["DRAFT", "CANCELLED", "FINISHED"].includes(activity.status || ""))
    return false;
  if (activity.enrollmentOpen === false) return false;
  return (
    new Date(now).getTime() <= activityEnrollmentDeadline(activity, lateMinutes)
  );
}
