import { describe, expect, it } from "vitest";
import { rolesWithPrimary, routeRedirect } from "./routing";

describe("rolesWithPrimary", () => {
  it("keeps a referee role when an older account only has its new assignor row", () => {
    expect(rolesWithPrimary("referee", ["assignor"])).toEqual(["referee", "assignor"]);
  });

  it("does not duplicate a primary role already stored", () => {
    expect(rolesWithPrimary("assignor", ["referee", "assignor"])).toEqual([
      "assignor",
      "referee",
    ]);
  });
});

describe("routeRedirect", () => {
  const dualRoleReferee = {
    signedIn: true,
    profileComplete: true,
    primaryRole: "referee",
    roles: ["referee", "assignor"] as const,
  };

  it("lets a referee who is also an assignor open the assignor profile", () => {
    expect(
      routeRedirect({
        ...dualRoleReferee,
        roles: [...dualRoleReferee.roles],
        pathname: "/assignor/profile",
      })
    ).toBeNull();
  });

  it("lets that same dual-role account return to referee screens", () => {
    expect(
      routeRedirect({
        ...dualRoleReferee,
        roles: [...dualRoleReferee.roles],
        pathname: "/app/profile",
      })
    ).toBeNull();
  });

  it("still keeps a referee-only account out of assignor screens", () => {
    expect(
      routeRedirect({
        signedIn: true,
        profileComplete: true,
        primaryRole: "referee",
        roles: ["referee"],
        pathname: "/assignor/profile",
      })
    ).toBe("/app/jobs");
  });

  it("uses the selected assignor role as the post-auth landing page", () => {
    expect(
      routeRedirect({
        signedIn: true,
        profileComplete: true,
        primaryRole: "assignor",
        roles: ["referee", "assignor"],
        pathname: "/auth/callback",
      })
    ).toBe("/assignor/tournaments");
  });

  it("does not let an assignor/referee account into director screens", () => {
    expect(
      routeRedirect({
        signedIn: true,
        profileComplete: true,
        primaryRole: "assignor",
        roles: ["referee", "assignor"],
        pathname: "/director/tournaments",
      })
    ).toBe("/assignor/tournaments");
  });

  it("lets any signed-in role open account settings", () => {
    expect(
      routeRedirect({
        signedIn: true,
        profileComplete: true,
        primaryRole: "referee",
        roles: ["referee"],
        pathname: "/account",
      })
    ).toBeNull();
  });

  it("requires sign-in for account settings", () => {
    expect(
      routeRedirect({
        signedIn: false,
        profileComplete: null,
        primaryRole: null,
        roles: [],
        pathname: "/account",
      })
    ).toBe("/auth/welcome");
  });
});
