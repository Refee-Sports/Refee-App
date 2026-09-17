import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  mapStatus,
  unlocksActions,
  verifySignature,
} from "../../../../supabase/functions/_shared/didit";

describe("Didit status mapping", () => {
  it("maps every status Didit documents", () => {
    expect(mapStatus("Not Started")).toBe("unstarted");
    expect(mapStatus("In Progress")).toBe("in_progress");
    expect(mapStatus("Awaiting User")).toBe("in_progress");
    expect(mapStatus("Resubmitted")).toBe("in_progress");
    expect(mapStatus("In Review")).toBe("in_review");
    expect(mapStatus("Approved")).toBe("approved");
    expect(mapStatus("Declined")).toBe("declined");
    expect(mapStatus("Expired")).toBe("expired");
    expect(mapStatus("Kyc Expired")).toBe("expired");
    expect(mapStatus("Abandoned")).toBe("abandoned");
  });

  it("holds anything it doesn't recognise for review rather than guessing", () => {
    expect(mapStatus("Something New")).toBe("in_review");
    expect(mapStatus("")).toBe("in_review");
    expect(mapStatus(null)).toBe("in_review");
    expect(mapStatus(undefined)).toBe("in_review");
  });

  it("is case- and space-exact: only Approved approves", () => {
    expect(mapStatus("approved")).toBe("in_review");
    expect(mapStatus("APPROVED")).toBe("in_review");
    expect(mapStatus("  Approved  ")).toBe("approved");
  });

  it("unlocks the gated actions for approved identities only", () => {
    expect(unlocksActions("approved")).toBe(true);
    for (const status of ["unstarted", "in_progress", "in_review", "declined", "expired", "abandoned"] as const) {
      expect(unlocksActions(status)).toBe(false);
    }
  });
});

describe("canonical JSON", () => {
  it("sorts keys at every level", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ z: { y: 1, x: 2 } })).toBe('{"z":{"x":2,"y":1}}');
    expect(canonicalJson([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });

  it("shortens whole-number floats, and leaves real decimals alone", () => {
    expect(canonicalJson({ score: 2.0 })).toBe('{"score":2}');
    expect(canonicalJson({ score: 0.97 })).toBe('{"score":0.97}');
    expect(canonicalJson({ nested: [1.0, 1.5] })).toBe('{"nested":[1,1.5]}');
  });

  it("leaves non-ASCII characters unescaped", () => {
    expect(canonicalJson({ name: "José" })).toBe('{"name":"José"}');
  });

  it("keeps array order, which carries meaning", () => {
    expect(canonicalJson({ list: ["b", "a"] })).toBe('{"list":["b","a"]}');
  });
});

const SECRET = "shared-secret-from-didit";

async function sign(body: unknown, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonicalJson(body)));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("webhook signature", () => {
  const now = new Date("2026-09-17T12:00:00Z");
  const stamp = String(Math.floor(now.getTime() / 1000));
  const body = { session_id: "sess_1", status: "Approved", vendor_data: "user-123" };

  it("accepts a correctly signed, fresh delivery", async () => {
    const signature = await sign(body);
    expect(await verifySignature({ body, signature, timestamp: stamp, secret: SECRET, now }))
      .toEqual({ ok: true });
  });

  it("accepts a body whose keys arrive in a different order", async () => {
    const signature = await sign(body);
    const reordered = { vendor_data: "user-123", status: "Approved", session_id: "sess_1" };
    expect(await verifySignature({ body: reordered, signature, timestamp: stamp, secret: SECRET, now }))
      .toEqual({ ok: true });
  });

  it("rejects a signature made with the wrong secret", async () => {
    const signature = await sign(body, "not-the-secret");
    const result = await verifySignature({ body, signature, timestamp: stamp, secret: SECRET, now });
    expect(result).toEqual({ ok: false, reason: "Signature mismatch" });
  });

  it("rejects a body that was changed after signing", async () => {
    const signature = await sign(body);
    const tampered = { ...body, status: "Approved", vendor_data: "someone-else" };
    const result = await verifySignature({ body: tampered, signature, timestamp: stamp, secret: SECRET, now });
    expect(result).toEqual({ ok: false, reason: "Signature mismatch" });
  });

  it("rejects a replay from outside the five-minute window", async () => {
    const signature = await sign(body);
    const old = String(Math.floor(now.getTime() / 1000) - 301);
    const future = String(Math.floor(now.getTime() / 1000) + 301);
    expect(await verifySignature({ body, signature, timestamp: old, secret: SECRET, now }))
      .toEqual({ ok: false, reason: "Timestamp outside the allowed window" });
    expect(await verifySignature({ body, signature, timestamp: future, secret: SECRET, now }))
      .toEqual({ ok: false, reason: "Timestamp outside the allowed window" });
  });

  it("accepts the edges of the window", async () => {
    const signature = await sign(body);
    const edge = String(Math.floor(now.getTime() / 1000) - 300);
    expect(await verifySignature({ body, signature, timestamp: edge, secret: SECRET, now }))
      .toEqual({ ok: true });
  });

  it("refuses when a header or the secret is missing", async () => {
    const signature = await sign(body);
    expect(await verifySignature({ body, signature, timestamp: stamp, secret: "", now }))
      .toEqual({ ok: false, reason: "Webhook secret is not configured" });
    expect(await verifySignature({ body, signature: null, timestamp: stamp, secret: SECRET, now }))
      .toEqual({ ok: false, reason: "Missing signature" });
    expect(await verifySignature({ body, signature, timestamp: null, secret: SECRET, now }))
      .toEqual({ ok: false, reason: "Missing timestamp" });
    expect(await verifySignature({ body, signature, timestamp: "not-a-number", secret: SECRET, now }))
      .toEqual({ ok: false, reason: "Invalid timestamp" });
  });
});
