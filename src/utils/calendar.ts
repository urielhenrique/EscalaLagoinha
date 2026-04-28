type CalendarEventPayload = {
  title: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
};

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function toGoogleDate(dateIso: string) {
  return new Date(dateIso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function toIcsDate(dateIso: string) {
  return toGoogleDate(dateIso);
}

export function buildGoogleCalendarUrl(payload: CalendarEventPayload) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: payload.title,
    dates: `${toGoogleDate(payload.start)}/${toGoogleDate(payload.end)}`,
    details: payload.description ?? "",
    location: payload.location ?? "",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsContent(payload: CalendarEventPayload) {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@escala-lagoinha`;
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Escala Lagoinha//Church Volunteer Manager//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsDate(payload.start)}`,
    `DTEND:${toIcsDate(payload.end)}`,
    `SUMMARY:${escapeIcsText(payload.title)}`,
    `DESCRIPTION:${escapeIcsText(payload.description ?? "")}`,
    `LOCATION:${escapeIcsText(payload.location ?? "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcsFile(
  payload: CalendarEventPayload,
  filename: string,
) {
  const content = buildIcsContent(payload);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
