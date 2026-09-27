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
  // An explicit XP item with cost 0 is intentionally awaiting pricing. The
  // legacy table only upgrades records created before redemptionMode existed.
  if (reward?.redemptionMode === "XP_STORE") {
    return Math.max(0, configured);
  }
  return configured > 0
    ? configured
    : legacyXpCosts[normalizedRewardName(reward?.name)] || 0;
}

/** Public copy that reflects the current ranking and XP-store rules. */
export function rewardStoreDescription(reward: any) {
  const name = normalizedRewardName(reward?.name);
  if (name.includes("scrub"))
    return "Prêmio exclusivo do 1º lugar do ranking da Farma Arena, reservado automaticamente e sem gasto de XP.";
  if (name.includes("copo"))
    return "Prêmio exclusivo do 2º ao 21º lugar do ranking da Farma Arena, reservado automaticamente e sem gasto de XP.";
  if (name.includes("eco"))
    return "Prêmio do 1º lugar e do 22º ao 45º lugar do ranking da Farma Arena, reservado automaticamente e sem gasto de XP.";
  if (name.includes("bot"))
    return "Compra com XP sujeita ao estoque. Se os pedidos superarem a quantidade disponível, a distribuição será definida por sorteio.";
  if (name.includes("caneta"))
    return "Compra com XP sujeita ao estoque. Em caso de excesso de pedidos, o sistema sorteia e pode realocar para o próximo item disponível.";
  if (name.includes("bloco"))
    return "Compra com XP sujeita ao estoque. O valor reduz o saldo disponível, sem alterar o XP acumulado nem a posição no ranking.";
  if (name.includes("chave"))
    return "Lembrança da Jornada liberada pela regra de carimbos do passaporte. A retirada é registrada pela organização usando o RA.";
  return String(reward?.description || "");
}
