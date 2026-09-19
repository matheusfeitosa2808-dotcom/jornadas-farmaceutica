import { describe, expect, it } from "vitest";
import { ApiResponseError, readApiResponse } from "../src/lib/api-response";

describe("readApiResponse", () => {
  it("converts an HTML gateway failure into a useful message", async () => {
    const response = new Response("<!DOCTYPE html><title>Bad gateway</title>", {
      status: 502,
      headers: { "content-type": "text/html" },
    });

    await expect(readApiResponse(response)).rejects.toThrow(
      "O servidor está temporariamente ocupado",
    );
  });

  it("preserves structured API error details", async () => {
    const response = Response.json(
      { error: "RA já cadastrado.", code: "DUPLICATE", details: { ra: "1" } },
      { status: 409 },
    );

    try {
      await readApiResponse(response);
      throw new Error("expected an API error");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiResponseError);
      expect(error).toMatchObject({
        message: "RA já cadastrado.",
        code: "DUPLICATE",
        details: { ra: "1" },
      });
    }
  });

  it("returns a valid JSON payload", async () => {
    const response = Response.json({ ok: true, result: { id: "participant" } });
    await expect(readApiResponse(response)).resolves.toEqual({
      ok: true,
      result: { id: "participant" },
    });
  });
});
