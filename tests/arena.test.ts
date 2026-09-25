import { describe, expect, it } from "vitest";
import {
  defaultArenaConfig,
  arenaPassportActivityId,
  arenaRankingIsLocked,
  arenaRankingRevealAt,
  publicArenaRanking,
  rankArenaParticipants,
  rankingDisplayName,
} from "../src/server/arena";
import { STAMP_XP_REWARD } from "../src/lib/xp";
import { rewardRedemptionMode, rewardXpCost } from "../src/lib/rewards";

const people = [
  { id: "p1", name: "Mariana Costa Silva", semester: 6 },
  { id: "p2", name: "João Ribeiro", semester: 8 },
];
const earn = (
  participantId: string,
  amount: number,
  at: string,
  id: string,
) => ({
  id,
  participantId,
  balanceDelta: amount,
  rankingDelta: amount,
  createdAt: at,
});

describe("Farma Arena", () => {
  it("mantém as posições ocultas até o horário configurado", () => {
    const config = {
      ...defaultArenaConfig("edition"),
      rankingVisibility: "SCHEDULED:2026-09-25T19:00:00.000Z",
    };
    expect(
      arenaRankingIsLocked(config, new Date("2026-09-25T18:59:59.000Z")),
    ).toBe(true);
    expect(
      arenaRankingIsLocked(config, new Date("2026-09-25T19:00:00.000Z")),
    ).toBe(false);
    expect(arenaRankingRevealAt(config)?.toISOString()).toBe(
      "2026-09-25T19:00:00.000Z",
    );
  });

  it("deixa o ranking livre quando não há horário programado", () => {
    expect(arenaRankingIsLocked(defaultArenaConfig("edition"))).toBe(false);
  });

  it("separa XP total do saldo disponível ao comprar", () => {
    const rows = rankArenaParticipants(
      people,
      [
        earn("p1", 500, "2026-09-20T10:00:00Z", "a"),
        {
          id: "b",
          participantId: "p1",
          balanceDelta: -300,
          rankingDelta: 0,
          createdAt: "2026-09-20T11:00:00Z",
        },
      ],
      [],
      defaultArenaConfig("edition"),
    );
    expect(rows[0]).toMatchObject({ xpTotal: 500, xpAvailable: 200 });
  });

  it("transforma cada carimbo válido em XP de ranking e saldo", () => {
    const rows = rankArenaParticipants(
      people,
      [],
      [],
      defaultArenaConfig("edition"),
      [
        {
          id: "s1",
          participantId: "p1",
          issuedAt: "2026-09-20T10:00:00Z",
        },
        {
          id: "s2",
          participantId: "p1",
          issuedAt: "2026-09-20T11:00:00Z",
        },
      ],
    );
    expect(rows.find((row) => row.participantId === "p1")).toMatchObject({
      xpTotal: STAMP_XP_REWARD * 2,
      xpAvailable: STAMP_XP_REWARD * 2,
    });
  });

  it("não soma XP extra pelo carimbo único da Farma Arena", () => {
    const rows = rankArenaParticipants(
      people,
      [earn("p1", 150, "2026-09-20T10:00:00Z", "arena")],
      [],
      defaultArenaConfig("edition"),
      [
        {
          id: "arena-stamp",
          participantId: "p1",
          activityId: arenaPassportActivityId("edition"),
          issuedAt: "2026-09-20T10:00:00Z",
        },
      ],
    );
    expect(rows.find((row) => row.participantId === "p1")).toMatchObject({
      xpTotal: 150,
      xpAvailable: 150,
    });
  });

  it("mantém o chaveiro por carimbo e migra os demais brindes para XP", () => {
    expect(rewardRedemptionMode({ name: "Chaveiro" })).toBe("ELIGIBILITY");
    expect(rewardRedemptionMode({ name: "Caneta" })).toBe("XP_STORE");
    expect(rewardXpCost({ name: "Caneta" })).toBe(200);
    expect(
      rewardXpCost({ name: "Caneta", redemptionMode: "XP_STORE", xpCost: 0 }),
    ).toBe(0);
  });

  it("gastar XP de carimbo preserva o total do ranking", () => {
    const rows = rankArenaParticipants(
      people,
      [
        {
          id: "purchase",
          participantId: "p1",
          balanceDelta: -50,
          rankingDelta: 0,
          createdAt: "2026-09-20T11:00:00Z",
        },
      ],
      [],
      defaultArenaConfig("edition"),
      [
        {
          id: "s1",
          participantId: "p1",
          issuedAt: "2026-09-20T10:00:00Z",
        },
      ],
    );
    expect(rows.find((row) => row.participantId === "p1")).toMatchObject({
      xpTotal: STAMP_XP_REWARD,
      xpAvailable: STAMP_XP_REWARD - 50,
    });
  });

  it("reembolso devolve saldo sem aumentar o ranking", () => {
    const rows = rankArenaParticipants(
      people,
      [
        earn("p1", 500, "2026-09-20T10:00:00Z", "a"),
        {
          id: "b",
          participantId: "p1",
          balanceDelta: -300,
          rankingDelta: 0,
          createdAt: "2026-09-20T11:00:00Z",
        },
        {
          id: "c",
          participantId: "p1",
          balanceDelta: 300,
          rankingDelta: 0,
          createdAt: "2026-09-20T12:00:00Z",
        },
      ],
      [],
      defaultArenaConfig("edition"),
    );
    expect(rows[0]).toMatchObject({ xpTotal: 500, xpAvailable: 500 });
  });

  it("revogação compensa saldo e ranking", () => {
    const rows = rankArenaParticipants(
      people,
      [
        earn("p1", 200, "2026-09-20T10:00:00Z", "a"),
        {
          id: "b",
          participantId: "p1",
          balanceDelta: -200,
          rankingDelta: -200,
          createdAt: "2026-09-20T11:00:00Z",
        },
      ],
      [],
      defaultArenaConfig("edition"),
    );
    expect(rows.find((row) => row.participantId === "p1")).toMatchObject({
      xpTotal: 0,
      xpAvailable: 0,
    });
  });

  it("usa desafios distintos e tempo como desempate determinístico", () => {
    const rows = rankArenaParticipants(
      people,
      [
        earn("p1", 100, "2026-09-20T10:00:00Z", "a"),
        earn("p2", 100, "2026-09-20T09:00:00Z", "b"),
      ],
      [
        { participantId: "p1", challengeId: "c1" },
        { participantId: "p2", challengeId: "c1" },
        { participantId: "p2", challengeId: "c2" },
      ],
      defaultArenaConfig("edition"),
    );
    expect(rows.map((row) => row.participantId)).toEqual(["p2", "p1"]);
  });

  it("atribui títulos apenas pela posição atual", () => {
    const rows = rankArenaParticipants(
      people,
      [
        earn("p1", 200, "2026-09-20T10:00:00Z", "a"),
        earn("p2", 100, "2026-09-20T10:00:00Z", "b"),
      ],
      [],
      defaultArenaConfig("edition"),
    );
    expect(rows[0].title).toBe("Rei da Jornada");
    expect(rows[1].title).toBe("Guerreiro da Jornada");
  });

  it("gera nome público sem expor RA ou nome completo", () => {
    expect(rankingDisplayName("Mariana Costa Silva")).toBe("Mariana S.");
  });

  it("não deixa um prêmio pendente alterar o ranking sem ledger", () => {
    const rows = rankArenaParticipants(
      people,
      [],
      [{ participantId: "p1", challengeId: "c1", status: "VALID" }],
      defaultArenaConfig("edition"),
    );
    expect(rows.find((row) => row.participantId === "p1")?.xpTotal).toBe(0);
  });

  it("o payload público contém apenas os campos permitidos", () => {
    const rows = rankArenaParticipants(
      [{ ...people[0], ra: "48884" }],
      [earn("p1", 100, "2026-09-20T10:00:00Z", "a")],
      [],
      defaultArenaConfig("edition"),
    );
    expect(Object.keys(publicArenaRanking(rows)[0]).sort()).toEqual(
      [
        "displayName",
        "participantId",
        "photoUrl",
        "rank",
        "semester",
        "title",
        "xpTotal",
      ].sort(),
    );
    expect(JSON.stringify(publicArenaRanking(rows))).not.toContain("48884");
  });

  it("mantém edições isoladas quando as consultas fornecem seus próprios dados", () => {
    const config = defaultArenaConfig("edition-a");
    const editionA = rankArenaParticipants(
      [people[0]],
      [earn("p1", 300, "2026-09-20T10:00:00Z", "a")],
      [],
      config,
    );
    const editionB = rankArenaParticipants(
      [people[1]],
      [],
      [],
      defaultArenaConfig("edition-b"),
    );
    expect(editionA[0].xpTotal).toBe(300);
    expect(editionB[0].xpTotal).toBe(0);
  });
});
