import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mocks.from, storage: { from: mocks.storageFrom } },
}));

import {
  BACKGROUND_CHECK_MAX_BYTES,
  BACKGROUND_CHECK_WARNING_DAYS,
  backgroundCheckFileError,
  backgroundCheckLabel,
  backgroundCheckState,
  daysUntilExpiry,
  fetchBackgroundCheckStatuses,
  removeBackgroundCheck,
  uploadBackgroundCheck,
} from "./backgroundCheck";

const NOW = new Date("2026-09-28T12:00:00Z");
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

describe("background check expiry (valid for one year)", () => {
  it("is 'none' when nothing has been uploaded", () => {
    expect(backgroundCheckState(null, NOW)).toBe("none");
    expect(backgroundCheckState(undefined, NOW)).toBe("none");
  });

  it("is valid well before the expiry", () => {
    expect(backgroundCheckState(daysFromNow(365), NOW)).toBe("valid");
    expect(backgroundCheckState(daysFromNow(BACKGROUND_CHECK_WARNING_DAYS + 1), NOW)).toBe("valid");
  });

  it("warns inside the last 30 days", () => {
    expect(backgroundCheckState(daysFromNow(BACKGROUND_CHECK_WARNING_DAYS), NOW)).toBe("expiring");
    expect(backgroundCheckState(daysFromNow(1), NOW)).toBe("expiring");
  });

  it("is expired at and after the expiry moment", () => {
    expect(backgroundCheckState(NOW.toISOString(), NOW)).toBe("expired");
    expect(backgroundCheckState(daysFromNow(-1), NOW)).toBe("expired");
    expect(backgroundCheckState(daysFromNow(-400), NOW)).toBe("expired");
  });

  it("counts whole days remaining, rounding up", () => {
    expect(daysUntilExpiry(daysFromNow(10), NOW)).toBe(10);
    expect(daysUntilExpiry(new Date(NOW.getTime() + 36 * 60 * 60 * 1000).toISOString(), NOW)).toBe(2);
    expect(daysUntilExpiry(daysFromNow(-3), NOW)).toBe(-3);
  });

  it("describes each state in plain words", () => {
    expect(backgroundCheckLabel(null, NOW)).toBe("Not uploaded");
    expect(backgroundCheckLabel(daysFromNow(365), NOW)).toMatch(/^Valid until /);
    expect(backgroundCheckLabel(daysFromNow(12), NOW)).toBe("Expires in 12 days");
    expect(backgroundCheckLabel(daysFromNow(1), NOW)).toBe("Expires in 1 day");
    expect(backgroundCheckLabel(daysFromNow(-5), NOW)).toMatch(/^Expired /);
  });
});

describe("background check file rules", () => {
  it("accepts a PDF or a photo under 10 MB", () => {
    expect(backgroundCheckFileError({ mimeType: "application/pdf", size: 1000 })).toBeNull();
    expect(backgroundCheckFileError({ mimeType: "image/jpeg", size: BACKGROUND_CHECK_MAX_BYTES })).toBeNull();
    expect(backgroundCheckFileError({ mimeType: "IMAGE/PNG", size: 5 })).toBeNull();
  });

  it("rejects other types and oversized files", () => {
    expect(backgroundCheckFileError({ mimeType: "application/zip", size: 10 })).toMatch(/PDF or a photo/);
    expect(backgroundCheckFileError({ mimeType: "", size: 10 })).toMatch(/PDF or a photo/);
    expect(backgroundCheckFileError({ mimeType: "application/pdf", size: BACKGROUND_CHECK_MAX_BYTES + 1 })).toMatch(/10 MB/);
  });
});

describe("background check upload", () => {
  const upload = vi.fn();
  const remove = vi.fn();

  beforeEach(() => {
    upload.mockReset().mockResolvedValue({ error: null });
    remove.mockReset().mockResolvedValue({ error: null });
    mocks.storageFrom.mockReset().mockReturnValue({ upload, remove });
    mocks.from.mockReset();
  });

  it("stores the file under the uploader's own folder, then records it (the database sets the expiry)", async () => {
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: { id: "d1", file_path: "u1/x.pdf", file_name: "check.pdf", uploaded_at: "t", expires_at: "t2" },
          error: null,
        }),
      }),
    });
    mocks.from.mockReturnValue({ insert });

    const out = await uploadBackgroundCheck("u1", {
      body: new ArrayBuffer(4),
      fileName: "check.pdf",
      mimeType: "application/pdf",
      size: 4,
    });

    expect(mocks.storageFrom).toHaveBeenCalledWith("background-checks");
    const [path, , options] = upload.mock.calls[0];
    expect(path).toMatch(/^u1\/\d+\.pdf$/);
    expect(options).toMatchObject({ contentType: "application/pdf", upsert: false });
    const row = insert.mock.calls[0][0];
    expect(row).toEqual({ user_id: "u1", file_path: path, file_name: "check.pdf" });
    expect(row).not.toHaveProperty("expires_at");
    expect(out.check?.id).toBe("d1");
    expect(out.error).toBeNull();
  });

  it("refuses an unsupported file without touching storage", async () => {
    const out = await uploadBackgroundCheck("u1", {
      body: new ArrayBuffer(4),
      fileName: "notes.txt",
      mimeType: "text/plain",
      size: 4,
    });
    expect(out.error?.message).toMatch(/PDF or a photo/);
    expect(upload).not.toHaveBeenCalled();
  });

  it("cleans up the stored file if the record can't be saved", async () => {
    mocks.from.mockReturnValue({
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: "denied" } }) }) }),
    });
    const out = await uploadBackgroundCheck("u1", { body: new ArrayBuffer(1), mimeType: "image/png", size: 1 });
    expect(out.error?.message).toBe("denied");
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("removes the record and its file", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ delete: () => ({ eq }) });
    const out = await removeBackgroundCheck({ id: "d1", file_path: "u1/x.pdf" });
    expect(eq).toHaveBeenCalledWith("id", "d1");
    expect(remove).toHaveBeenCalledWith(["u1/x.pdf"]);
    expect(out.error).toBeNull();
  });
});

describe("background check badges", () => {
  it("maps people to their expiry, leaving out anyone who never uploaded", async () => {
    mocks.from.mockReturnValue({
      select: () => ({
        in: async () => ({
          data: [{ user_id: "a", expires_at: "2027-01-01T00:00:00Z" }],
          error: null,
        }),
      }),
    });
    const out = await fetchBackgroundCheckStatuses(["a", "b"]);
    expect(out.statuses).toEqual({ a: "2027-01-01T00:00:00Z" });
  });

  it("skips the query for an empty list", async () => {
    mocks.from.mockClear();
    expect(await fetchBackgroundCheckStatuses([])).toEqual({ statuses: {}, error: null });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
