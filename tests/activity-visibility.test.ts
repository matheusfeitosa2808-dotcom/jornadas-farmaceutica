import { describe, expect, it } from "vitest";
import {
  activityEnrollmentDeadline,
  activitySwapDeadline,
  isActivityOpenInProgram,
} from "../src/lib/activity-visibility";

const activity = {
  startAt: "2026-09-24T22:00:00.000Z",
  enrollmentOpen: true,
  status: "OPEN",
};

describe("visibilidade da programação", () => {
  it("usa o prazo de inscrição configurado", () => {
    const withDeadline = {
      ...activity,
      enrollmentDeadline: "2026-09-24T20:00:00.000Z",
      swapDeadline: "2026-09-24T21:00:00.000Z",
    };
    expect(activityEnrollmentDeadline(withDeadline, 15)).toBe(
      new Date(withDeadline.enrollmentDeadline).getTime(),
    );
    expect(
      isActivityOpenInProgram(withDeadline, "2026-09-24T20:00:01.000Z", 15),
    ).toBe(false);
  });

  it("usa o prazo de troca quando não existe prazo de inscrição", () => {
    const withSwap = {
      ...activity,
      swapDeadline: "2026-09-24T21:00:00.000Z",
    };
    expect(
      isActivityOpenInProgram(withSwap, "2026-09-24T20:59:00.000Z", 15),
    ).toBe(true);
    expect(
      isActivityOpenInProgram(withSwap, "2026-09-24T21:01:00.000Z", 15),
    ).toBe(false);
  });

  it("preserva o prazo específico de troca para quem já está inscrito", () => {
    const withDeadlines = {
      ...activity,
      enrollmentDeadline: "2026-09-24T20:00:00.000Z",
      swapDeadline: "2026-09-24T21:00:00.000Z",
    };
    expect(activitySwapDeadline(withDeadlines, 15)).toBe(
      new Date(withDeadlines.swapDeadline).getTime(),
    );
  });

  it("oculta atividades encerradas, canceladas e com inscrição fechada", () => {
    expect(
      isActivityOpenInProgram(
        { ...activity, status: "CANCELLED" },
        "2026-09-24T19:00:00.000Z",
        15,
      ),
    ).toBe(false);
    expect(
      isActivityOpenInProgram(
        { ...activity, enrollmentOpen: false },
        "2026-09-24T19:00:00.000Z",
        15,
      ),
    ).toBe(false);
  });

  it("usa o início mais a tolerância como último recurso", () => {
    expect(
      isActivityOpenInProgram(activity, "2026-09-24T22:14:59.000Z", 15),
    ).toBe(true);
    expect(
      isActivityOpenInProgram(activity, "2026-09-24T22:15:01.000Z", 15),
    ).toBe(false);
  });
});
