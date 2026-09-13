import { describe, it, expect } from "vitest";
import { canMessage, canSendToParticipants, type MessagingRole } from "./permissions";

const ROLES: MessagingRole[] = ["referee", "director", "assignor"];

describe("canMessage — directional role rules", () => {
  it("referees can message other referees (both ways)", () => {
    expect(canMessage("referee", "referee")).toBe(true);
  });

  it("referees and assignors can message each other (both ways)", () => {
    expect(canMessage("referee", "assignor")).toBe(true);
    expect(canMessage("assignor", "referee")).toBe(true);
  });

  it("directors can message referees", () => {
    expect(canMessage("director", "referee")).toBe(true);
  });

  it("referees CANNOT message directors (reduces director inbox load)", () => {
    expect(canMessage("referee", "director")).toBe(false);
  });

  it("blocks the unspecified pairings by default", () => {
    // director/assignor have no relationship; nobody messages a director but a director isn't messaged back
    expect(canMessage("assignor", "director")).toBe(false);
    expect(canMessage("director", "assignor")).toBe(false);
    expect(canMessage("director", "director")).toBe(false);
    expect(canMessage("assignor", "assignor")).toBe(false);
  });

  it("never lets anyone message a director", () => {
    for (const from of ROLES) expect(canMessage(from, "director")).toBe(from === "director" ? false : false);
  });
});

describe("canSendToParticipants — send only if allowed to message every other participant", () => {
  it("a director can send into a director↔referee thread (one-way channel)", () => {
    expect(canSendToParticipants("director", ["referee"])).toBe(true);
  });

  it("a referee CANNOT send into that same thread (can't message the director)", () => {
    expect(canSendToParticipants("referee", ["director"])).toBe(false);
  });

  it("a referee can send into an all-referee crew thread", () => {
    expect(canSendToParticipants("referee", ["referee", "referee"])).toBe(true);
  });

  it("a referee is blocked if even one other participant is a director", () => {
    expect(canSendToParticipants("referee", ["referee", "director"])).toBe(false);
  });

  it("empty participants is trivially allowed", () => {
    expect(canSendToParticipants("referee", [])).toBe(true);
  });
});
