import { defaultMapCenter, reverseGeocode, type GeoLocationFields } from "./geo_location.ts";
import { getEditionConfig } from "./terminal_edition.ts";

function editionDefaultCountry(): string {
  const edition = getEditionConfig();
  if (edition.locale_default.startsWith("ka")) return "GE";
  return "RU";
}

/** Best-effort approximate location for educator lite (no map step). */
export async function detectApproximateLocation(): Promise<GeoLocationFields> {

  const country = editionDefaultCountry();
  const [lat, lng] = defaultMapCenter(country);
  try {
    return await reverseGeocode(lat, lng);
  } catch {
    return {
      settlement: country === "GE" ? "Тбилиси" : "Москва",
      region: country === "GE" ? "Тбилиси" : "Москва",
      municipality: country === "GE" ? "Тбилиси" : "Москва",
      country,
      lat,
      lng,
    };
  }
}
