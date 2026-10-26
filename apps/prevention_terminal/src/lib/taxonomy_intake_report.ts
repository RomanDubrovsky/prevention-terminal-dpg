import { platformApiBase } from "./platform_api.ts";

export async function reportIntakeCustomThemes(args: {
  customThemes: string[];
  catalogKeys?: string[];
  intakeThemeIds?: string[];
  commercial?: boolean;
  source?: "primary_intake" | "visit_tags";
}): Promise<void> {
  const custom = [...new Set(args.customThemes.map((s) => String(s || "").trim()).filter(Boolean))];
  if (!custom.length) return;

  try {
    const res = await fetch(`${platformApiBase()}/api/terminal/taxonomy/intake-custom`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        custom_themes: custom.slice(0, 12),
        catalog_keys: (args.catalogKeys || []).slice(0, 12),
        intake_theme_ids: (args.intakeThemeIds || []).slice(0, 12),
        consumer_app: args.commercial ? "ida" : "teenology",
        source: args.source || "primary_intake",
        lang: "ru",
      }),
    });
    if (!res.ok) return;
    await res.json();
  } catch {
    // best-effort — не блокируем сохранение дела
  }
}
