function partsAt(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

function offsetAt(date: Date, timeZone: string) {
  const p = partsAt(date, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

export function localDayBounds(date: string, timeZone: string) {
  const [year, month, day] = date.split("-").map(Number);
  const nominal = new Date(Date.UTC(year, month - 1, day));
  const start = new Date(nominal.getTime() - offsetAt(nominal, timeZone));
  const nextNominal = new Date(Date.UTC(year, month - 1, day + 1));
  const next = new Date(nextNominal.getTime() - offsetAt(nextNominal, timeZone));
  return { start, end: new Date(next.getTime() - 1) };
}

export function localDate(date: Date, timeZone: string) {
  const p = partsAt(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
