import type { RecurrenceDay } from "../types/domain";

const DAY_MAP: Record<RecurrenceDay, number> = {
  DOMINGO: 0,
  SEGUNDA: 1,
  TERCA: 2,
  QUARTA: 3,
  QUINTA: 4,
  SEXTA: 5,
  SABADO: 6,
};

export function toIsoDate(value: string): string {
  if (!value) {
    return "";
  }

  const parts = value.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0)).toISOString();
}

export function calculateOccurrences(
  startDate: string,
  endDate: string,
  daysOfWeek: RecurrenceDay[],
): Date[] {
  if (!startDate || !endDate || daysOfWeek.length === 0) {
    return [];
  }

  const dayNumbers = daysOfWeek.map((d) => DAY_MAP[d]);
  const startParts = startDate.split("-");
  const endParts = endDate.split("-");
  const start = new Date(
    Date.UTC(
      Number(startParts[0]),
      Number(startParts[1]) - 1,
      Number(startParts[2]),
      12,
      0,
      0,
      0,
    ),
  );
  const end = new Date(
    Date.UTC(
      Number(endParts[0]),
      Number(endParts[1]) - 1,
      Number(endParts[2]),
      12,
      0,
      0,
      0,
    ),
  );
  const occurrences: Date[] = [];

  const current = new Date(start);

  while (current.getTime() <= end.getTime()) {
    if (dayNumbers.includes(current.getUTCDay())) {
      occurrences.push(new Date(current));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return occurrences;
}

export function formatDateShort(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function formatIsoDate(isoDateString: string): string {
  const date = new Date(isoDateString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DAY_LABELS: Record<RecurrenceDay, string> = {
  DOMINGO: "Domingo",
  SEGUNDA: "Segunda-feira",
  TERCA: "Terça-feira",
  QUARTA: "Quarta-feira",
  QUINTA: "Quinta-feira",
  SEXTA: "Sexta-feira",
  SABADO: "Sábado",
};

export function formatRecurrenceDays(days: RecurrenceDay[]): string {
  return days.map((d) => DAY_LABELS[d]).join(", ");
}
