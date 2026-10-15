import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: { from: () => ({ upload: mocks.upload, getPublicUrl: mocks.getPublicUrl }) },
    functions: { invoke: mocks.invoke },
  },
}));

import { headshotFileError, uploadAvatarFile, uploadSignupHeadshot } from "./avatar";

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

describe("uploadAvatarFile — a changed photo goes through the face check", () => {
  beforeEach(() => {
    mocks.upload.mockReset().mockResolvedValue({ error: null });
    mocks.invoke.mockReset().mockResolvedValue({ data: { avatarUrl: "https://cdn/avatars/u1/avatar.jpg?v=1" }, error: null });
  });

  it("stages the photo as pending.jpg and lets set-headshot decide", async () => {
    const { avatarUrl, error } = await uploadAvatarFile("u1", file("image/png"));
    expect(error).toBeNull();
    expect(mocks.upload).toHaveBeenCalledWith("u1/pending.jpg", expect.any(ArrayBuffer), {
      contentType: "image/png",
      upsert: true,
    });
    expect(mocks.invoke).toHaveBeenCalledWith("set-headshot", { body: {} });
    expect(avatarUrl).toBe("https://cdn/avatars/u1/avatar.jpg?v=1");
  });

  it("shows the reason when the face doesn't match", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { message: "non-2xx", context: { json: async () => ({ error: "This photo doesn't look like the person on your verified ID." }) } },
    });
    const { avatarUrl, error } = await uploadAvatarFile("u1", file("image/jpeg"));
    expect(avatarUrl).toBeNull();
    expect(error?.message).toMatch(/doesn't look like/);
  });

  it("stops if the upload fails", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "storage down" } });
    const { error } = await uploadAvatarFile("u1", file("image/jpeg"));
    expect(error?.message).toBe("storage down");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
