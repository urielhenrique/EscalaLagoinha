import { describe, it, expect } from "vitest";
import {
  calculateOccurrences,
  toIsoDate,
  formatDateShort,
} from "./recurrence";

describe("recurrence utility", () => {
  describe("toIsoDate — calendar date semantics", () => {
    it('parses "2026-10-04" as 2026-10-04T12:00:00.000Z', () => {
      expect(toIsoDate("2026-10-04")).toBe("2026-10-04T12:00:00.000Z");
    });

    it('parses "2026-09-06" as 2026-09-06T12:00:00.000Z', () => {
      expect(toIsoDate("2026-09-06")).toBe("2026-09-06T12:00:00.000Z");
    });

    it("returns empty string for empty input", () => {
      expect(toIsoDate("")).toBe("");
    });
  });

  describe("calculateOccurrences — canonical 7 cases", () => {
    // Backend reference: generateWeeklyOccurrences uses UTC methods exclusively.
    // Frontend calculateOccurrences must produce identical calendar-date sets.

    it("06/09 a 27/09 — Sundays only", () => {
      const occurrences = calculateOccurrences(
        "2026-09-06",
        "2026-09-27",
        ["DOMINGO"],
      );
      const dates = occurrences.map((d) => formatDateShort(d));
      expect(dates).toEqual([
        "06/09/2026",
        "13/09/2026",
        "20/09/2026",
        "27/09/2026",
      ]);
    });

    it("01/10 a 31/10 — Thursdays only", () => {
      const occurrences = calculateOccurrences(
        "2026-10-01",
        "2026-10-31",
        ["QUINTA"],
      );
      const dates = occurrences.map((d) => formatDateShort(d));
      expect(dates).toEqual([
        "01/10/2026",
        "08/10/2026",
        "15/10/2026",
        "22/10/2026",
        "29/10/2026",
      ]);
    });

    it("01/10 a 31/10 — Mondays and Thursdays", () => {
      const occurrences = calculateOccurrences(
        "2026-10-01",
        "2026-10-31",
        ["SEGUNDA", "QUINTA"],
      );
      const dates = occurrences.map((d) => formatDateShort(d));
      expect(dates).toEqual([
        "01/10/2026",
        "05/10/2026",
        "08/10/2026",
        "12/10/2026",
        "15/10/2026",
        "19/10/2026",
        "22/10/2026",
        "26/10/2026",
        "29/10/2026",
      ]);
    });

    it("01/10 a 07/10 — single Thursday (same day start/end)", () => {
      const occurrences = calculateOccurrences(
        "2026-10-01",
        "2026-10-07",
        ["QUINTA"],
      );
      const dates = occurrences.map((d) => formatDateShort(d));
      expect(dates).toEqual(["01/10/2026"]);
    });

    it("01/10 a 31/10 — Saturdays in October 2026", () => {
      const occurrences = calculateOccurrences(
        "2026-10-01",
        "2026-10-31",
        ["SABADO"],
      );
      const dates = occurrences.map((d) => formatDateShort(d));
      expect(dates).toEqual([
        "03/10/2026",
        "10/10/2026",
        "17/10/2026",
        "24/10/2026",
        "31/10/2026",
      ]);
    });

    it("04/10 a 05/10 — no matching day (Sun-Mon only, checking SABADO)", () => {
      const occurrences = calculateOccurrences(
        "2026-10-04",
        "2026-10-05",
        ["SABADO"],
      );
      expect(occurrences).toHaveLength(0);
    });

    it("01/10 a 31/10 — all 7 days produces every day", () => {
      const occurrences = calculateOccurrences(
        "2026-10-01",
        "2026-10-31",
        ["DOMINGO", "SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO"],
      );
      expect(occurrences).toHaveLength(31);
      expect(formatDateShort(occurrences[0])).toBe("01/10/2026");
      expect(formatDateShort(occurrences[30])).toBe("31/10/2026");
    });

    it("28/02 a 06/03 — cross-month boundary (2028 leap year)", () => {
      const occurrences = calculateOccurrences(
        "2028-02-28",
        "2028-03-06",
        ["SEGUNDA"],
      );
      const dates = occurrences.map((d) => formatDateShort(d));
      expect(dates).toEqual(["28/02/2028", "06/03/2028"]);
    });
  });

  describe("calculateOccurrences — edge cases", () => {
    it("empty startDate returns empty", () => {
      expect(calculateOccurrences("", "2026-10-31", ["DOMINGO"])).toEqual([]);
    });

    it("empty endDate returns empty", () => {
      expect(calculateOccurrences("2026-10-01", "", ["DOMINGO"])).toEqual([]);
    });

    it("empty daysOfWeek returns empty", () => {
      expect(calculateOccurrences("2026-10-01", "2026-10-31", [])).toEqual([]);
    });

    it("start equals end on matching day returns one occurrence", () => {
      const occurrences = calculateOccurrences(
        "2026-10-04",
        "2026-10-04",
        ["DOMINGO"],
      );
      expect(occurrences).toHaveLength(1);
      expect(formatDateShort(occurrences[0])).toBe("04/10/2026");
    });

    it("start equals end on non-matching day returns empty", () => {
      const occurrences = calculateOccurrences(
        "2026-10-04",
        "2026-10-04",
        ["SEGUNDA"],
      );
      expect(occurrences).toHaveLength(0);
    });

    it("start after end returns empty", () => {
      const occurrences = calculateOccurrences(
        "2026-10-31",
        "2026-10-01",
        ["DOMINGO"],
      );
      expect(occurrences).toHaveLength(0);
    });

    it("occurrences are Date objects in UTC", () => {
      const occurrences = calculateOccurrences(
        "2026-10-01",
        "2026-10-07",
        ["QUINTA"],
      );
      expect(occurrences[0]).toBeInstanceOf(Date);
      expect(occurrences[0].getUTCHours()).toBe(12);
      expect(occurrences[0].getUTCMinutes()).toBe(0);
    });

    it("does not mutate input dates", () => {
      const start = "2026-10-01";
      const end = "2026-10-31";
      calculateOccurrences(start, end, ["DOMINGO"]);
      expect(start).toBe("2026-10-01");
      expect(end).toBe("2026-10-31");
    });

    it("returns fresh Date copies each call", () => {
      const a = calculateOccurrences("2026-10-01", "2026-10-07", ["QUINTA"]);
      const b = calculateOccurrences("2026-10-01", "2026-10-07", ["QUINTA"]);
      expect(a[0]).not.toBe(b[0]);
      expect(a[0].getTime()).toBe(b[0].getTime());
    });
  });

  describe("calculateOccurrences — non-recurring event", () => {
    it("returns empty when daysOfWeek is empty (single event scenario)", () => {
      const occurrences = calculateOccurrences(
        "2026-10-04",
        "2026-10-04",
        [],
      );
      expect(occurrences).toHaveLength(0);
    });
  });

  describe("formatDateShort", () => {
    it("formats Date in UTC to dd/mm/yyyy", () => {
      const d = new Date("2026-10-04T12:00:00.000Z");
      expect(formatDateShort(d)).toBe("04/10/2026");
    });

    it("pads single-digit day and month", () => {
      const d = new Date("2026-01-05T12:00:00.000Z");
      expect(formatDateShort(d)).toBe("05/01/2026");
    });
  });
});
