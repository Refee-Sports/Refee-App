import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: { from: () => ({ upload: mocks.upload, getPublicUrl: mocks.getPublicUrl }) },
  },
}));

import { headshotFileError, uploadSignupHeadshot } from "./avatar";

const file = (type: string, size = 100) =>
  ({ type, size, arrayBuffer: async () => new ArrayBuffer(size) }) as unknown as File;

describe("headshotFileError — sign-up is blocked until this is null", () => {
  it("requires a file", () => {
    expect(headshotFileError(null)).toMatch(/Add a headshot/);
  });

  it("accepts an image under 5 MB", () => {
    expect(headshotFileError(file("image/jpeg"))).toBeNull();
    expect(headshotFileError(file("image/png", 5 * 1024 * 1024))).toBeNull();
  });

  it("rejects non-images and oversized images", () => {
    expect(headshotFileError(file("application/pdf"))).toMatch(/image file/);
    expect(headshotFileError(file("image/jpeg", 5 * 1024 * 1024 + 1))).toMatch(/5 MB/);
  });
});

describe("uploadSignupHeadshot", () => {
  beforeEach(() => {
    mocks.upload.mockReset().mockResolvedValue({ error: null });
    mocks.getPublicUrl.mockReset().mockReturnValue({ data: { publicUrl: "https://cdn/avatars/u1/avatar.jpg" } });
  });

  it("stores the photo at the person's own path and returns a cache-busted URL", async () => {
    const out = await uploadSignupHeadshot("u1", file("image/jpeg"));
    expect(mocks.upload.mock.calls[0][0]).toBe("u1/avatar.jpg");
    expect(mocks.upload.mock.calls[0][2]).toMatchObject({ upsert: true, contentType: "image/jpeg" });
    expect(out.avatarUrl).toMatch(/^https:\/\/cdn\/avatars\/u1\/avatar\.jpg\?v=\d+$/);
    expect(out.error).toBeNull();
  });

  it("does not upload an invalid file", async () => {
    const out = await uploadSignupHeadshot("u1", file("application/pdf"));
    expect(out.avatarUrl).toBeNull();
    expect(out.error?.message).toMatch(/image file/);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("reports a storage failure instead of returning a URL", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "bucket missing" } });
    const out = await uploadSignupHeadshot("u1", file("image/png"));
    expect(out.avatarUrl).toBeNull();
    expect(out.error?.message).toBe("bucket missing");
  });
});
