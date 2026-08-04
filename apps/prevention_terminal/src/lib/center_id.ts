const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

/** Slug for IDA center_id — mirrors `core/ida_centers.slugify_center_id`. */
export function slugifyCenterId(name: string, fallback = "center"): string {
  const text = String(name || "").trim().toLowerCase();
  let out = "";
  for (const ch of text) {
    if (CYRILLIC_TO_LATIN[ch]) out += CYRILLIC_TO_LATIN[ch];
    else if ((ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9")) out += ch;
    else out += "-";
  }
  const slug = out.replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return slug || fallback;
}
