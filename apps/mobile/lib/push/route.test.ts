import { describe, expect, it } from "vitest";
import { routeForNotification } from "./route";

const JOB = "98300000-0000-4000-8000-000000000031";
const CONVO = "11111111-2222-4333-8444-555555555555";

describe("where tapping a notification goes", () => {
  it("opens the game for a new-game alert", () => {
    expect(routeForNotification({ type: "new_game", jobId: JOB }, "referee")).toBe(`/job/${JOB}`);
  });

  it("opens the feed when several games were announced at once", () => {
    expect(routeForNotification({ type: "new_games" }, "referee")).toBe("/(app)/(tabs)/jobs");
  });

  it("opens the game for a confirmation or a change", () => {
    expect(routeForNotification({ type: "accepted", jobId: JOB }, "referee")).toBe(`/job/${JOB}`);
    expect(routeForNotification({ type: "reconfirm", jobId: JOB }, "referee")).toBe(`/job/${JOB}`);
  });

  it("opens the conversation in the right part of the app for each role", () => {
    expect(routeForNotification({ type: "message", conversationId: CONVO }, "referee")).toBe(`/(app)/conversation/${CONVO}`);
    expect(routeForNotification({ type: "message", conversationId: CONVO }, "director")).toBe(`/(director)/conversation/${CONVO}`);
    expect(routeForNotification({ type: "message", conversationId: CONVO }, "assignor")).toBe(`/(assignor)/conversation/${CONVO}`);
  });

  it("goes nowhere for a role a notification isn't meant for", () => {
    expect(routeForNotification({ type: "new_game", jobId: JOB }, "director")).toBeNull();
    expect(routeForNotification({ type: "new_games" }, "assignor")).toBeNull();
  });

  it("opens a game update on the screen each role runs the game from", () => {
    expect(routeForNotification({ type: "game_update", jobId: JOB }, "director")).toBe(`/(director)/game/${JOB}`);
    expect(routeForNotification({ type: "game_update", jobId: JOB }, "assignor")).toBe(`/(assignor)/game/${JOB}`);
    expect(routeForNotification({ type: "game_update", jobId: JOB }, "referee")).toBe(`/job/${JOB}`);
    expect(routeForNotification({ type: "game_update", jobId: "nope" }, "director")).toBeNull();
  });

  it("opens the earnings statement when a referee is paid", () => {
    expect(routeForNotification({ type: "payout", jobId: JOB }, "referee")).toBe("/earnings");
    expect(routeForNotification({ type: "payout", jobId: JOB }, "director")).toBeNull();
  });

  it("goes nowhere before we know who is signed in", () => {
    expect(routeForNotification({ type: "new_game", jobId: JOB }, null)).toBeNull();
  });

  it("never builds a path from something that isn't an id", () => {
    expect(routeForNotification({ type: "new_game", jobId: "../../account" }, "referee")).toBeNull();
    expect(routeForNotification({ type: "message", conversationId: "x/y" }, "referee")).toBeNull();
    expect(routeForNotification({ type: "new_game" }, "referee")).toBeNull();
  });

  it("ignores anything it doesn't recognise", () => {
    expect(routeForNotification({ type: "something_else", jobId: JOB }, "referee")).toBeNull();
    expect(routeForNotification(null, "referee")).toBeNull();
    expect(routeForNotification("text", "referee")).toBeNull();
    expect(routeForNotification(undefined, "referee")).toBeNull();
  });
});
