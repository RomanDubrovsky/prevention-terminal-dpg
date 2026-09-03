export function downloadIcsFile(title: string, description: string, dateIsoString: string, durationMinutes: number) {
  // Parsing YYYY-MM-DD
  const [year, month, day] = dateIsoString.split("-").map(Number);
  
  // We don't have a specific time in the UI, let's assume a default or just an all-day event if time is unknown, 
  // but to be useful let's pick 12:00 PM local time for the event to show up.
  // Actually it's better if we just create it as an event on that day.
  const startDate = new Date(year, month - 1, day, 12, 0);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

  const formatIcsDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IDA Pro//Center Terminal//RU",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}@ida.prevention.school`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(startDate)}`,
    `DTEND:${formatIcsDate(endDate)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = `session_${dateIsoString}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
