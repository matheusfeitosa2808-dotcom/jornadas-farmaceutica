const legacyXpCosts: Record<string, number> = {
  caneta: 200,
  bloco: 200,
  botton: 300,
  ecobag: 400,
  garrafa: 500,
};

const normalizedRewardName = (name: unknown) =>
  String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/** Keeps the original keychain rule while upgrading the old seeded catalog. */
export function rewardRedemptionMode(reward: any) {
  if (reward?.redemptionMode === "XP_STORE") return "XP_STORE";
  return legacyXpCosts[normalizedRewardName(reward?.name)]
    ? "XP_STORE"
    : "ELIGIBILITY";
}

export function rewardXpCost(reward: any) {
  const configured = Number(reward?.xpCost || 0);
  return configured > 0
    ? configured
    : legacyXpCosts[normalizedRewardName(reward?.name)] || 0;
}
