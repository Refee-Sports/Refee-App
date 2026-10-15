import { describe, expect, it, vi } from "vitest";
import { configureSupabase } from "@refee/core/client";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
configureSupabase({ rpc: mocks.rpc } as never);

import { fetchMyRatings } from "@refee/core/referee/queries";

describe("fetchMyRatings", () => {
  it("lists the ratings a ref received, newest first, without comments", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        { job_id: "j1", job_title: "Sat Game", game_date: "2026-10-01T18:00:00Z", rating: 4,
          on_time: 5, professionalism: 4, game_management: 3, rated_at: "2026-10-02T10:00:00Z" },
      ],
      error: null,
    });
    const { ratings, error } = await fetchMyRatings();
    expect(error).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith("my_ratings");
    expect(ratings).toEqual([
      { jobId: "j1", jobTitle: "Sat Game", gameDate: "2026-10-01T18:00:00Z", overall: 4,
        onTime: 5, professionalism: 4, gameManagement: 3, ratedAt: "2026-10-02T10:00:00Z" },
    ]);
  });

  it("returns the error when the lookup fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { ratings, error } = await fetchMyRatings();
    expect(ratings).toEqual([]);
    expect(error?.message).toBe("boom");
  });
});
