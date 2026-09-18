export interface GeoLocationFields {
  settlement: string;
  region: string;
  municipality: string;
  country?: string;
  lat?: number;
  lng?: number;
}

const COUNTRY_FROM_CODE: Record<string, string> = {
  ru: "RU",
  ge: "GE",
  kz: "KZ",
};

const CODE_FROM_COUNTRY: Record<string, string> = {
  RU: "ru",
  GE: "ge",
  KZ: "kz",
};

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  county?: string;
  state?: string;
  region?: string;
  state_district?: string;
  country_code?: string;
};

function pickSettlement(address: NominatimAddress, fallback?: string): string {
  return (
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.municipality ||
    fallback?.split(",")[0]?.trim() ||
    ""
  );
}

function pickRegion(address: NominatimAddress, fallback?: string): string {
  return address.state || address.region || fallback || "";
}

function pickMunicipality(address: NominatimAddress, region: string): string {
  return address.county || address.state_district || address.municipality || region || "";
}

export function parseNominatimReverse(payload: {
  address?: NominatimAddress;
  display_name?: string;
  lat?: string;
  lon?: string;
}): GeoLocationFields {
  const address = payload.address || {};
  const settlement = pickSettlement(address, payload.display_name);
  const region = pickRegion(address, settlement);
  const municipality = pickMunicipality(address, region);
  const cc = address.country_code?.toLowerCase();
  return {
    settlement,
    region: region || settlement,
    municipality: municipality || region || settlement,
    country: cc ? COUNTRY_FROM_CODE[cc] || "OTHER" : undefined,
    lat: payload.lat ? Number(payload.lat) : undefined,
    lng: payload.lon ? Number(payload.lon) : undefined,
  };
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoLocationFields> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "10");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "ru");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Геокодер: HTTP ${res.status}`);
  const data = (await res.json()) as {
    address?: NominatimAddress;
    display_name?: string;
    lat?: string;
    lon?: string;
  };
  const parsed = parseNominatimReverse(data);
  if (!parsed.settlement.trim()) {
    throw new Error("Не удалось определить населённый пункт. Приблизьте карту и попробуйте снова.");
  }
  return parsed;
}

export interface GeoSearchHit {
  label: string;
  lat: number;
  lng: number;
  location: GeoLocationFields;
}

export async function searchSettlements(
  query: string,
  country?: string,
): Promise<GeoSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const photonUrl = new URL("https://photon.komoot.io/api/");
  photonUrl.searchParams.set("q", q);
  photonUrl.searchParams.set("limit", "6");
  photonUrl.searchParams.set("lang", "ru");
  const cc = country ? CODE_FROM_COUNTRY[country] : "";
  if (cc) photonUrl.searchParams.set("osm_tag", "place:city,place:town,place:village");

  const res = await fetch(photonUrl.toString());
  if (!res.ok) return [];

  const data = (await res.json()) as {
    features?: Array<{
      geometry: { coordinates: [number, number] };
      properties: {
        name?: string;
        city?: string;
        state?: string;
        county?: string;
        countrycode?: string;
      };
    }>;
  };

  return (data.features || [])
    .map((feature) => {
      const props = feature.properties || {};
      const settlement = props.name || props.city || "";
      if (!settlement) return null;
      const region = props.state || settlement;
      const municipality = props.county || region;
      const [lng, lat] = feature.geometry.coordinates;
      const ccLower = props.countrycode?.toLowerCase();
      const label = [settlement, region].filter(Boolean).join(", ");
      return {
        label,
        lat,
        lng,
        location: {
          settlement,
          region,
          municipality,
          country: ccLower ? COUNTRY_FROM_CODE[ccLower] || "OTHER" : undefined,
          lat,
          lng,
        },
      } as GeoSearchHit;
    })
    .filter((row): row is GeoSearchHit => Boolean(row));
}

export function defaultMapCenter(country?: string): [number, number] {
  if (country === "GE") return [41.7151, 44.8271];
  if (country === "KZ") return [51.1694, 71.4491];
  return [55.7558, 37.6173];
}
