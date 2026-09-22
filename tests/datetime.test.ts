import { describe, expect, it } from "vitest";
import { dateKeyInTimeZone } from "@/lib/datetime";

describe("dateKeyInTimeZone", () => {
  it("keeps a late-evening activity on its local event day", () => {
    expect(
      dateKeyInTimeZone("2026-09-24T00:00:00.000Z", "America/Manaus"),
    ).toBe("2026-09-23");
  });

  it("keeps the next day's activities on the next local date", () => {
    expect(
      dateKeyInTimeZone("2026-09-24T22:30:00.000Z", "America/Manaus"),
    ).toBe("2026-09-24");
  });
});
