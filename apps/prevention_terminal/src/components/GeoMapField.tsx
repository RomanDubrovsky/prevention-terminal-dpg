import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  defaultMapCenter,
  reverseGeocode,
  searchSettlements,
  type GeoLocationFields,
} from "../lib/geo_location.ts";
import { getEditionConfig } from "../lib/terminal_edition.ts";

interface GeoMapFieldProps {
  country: string;
  settlement: string;
  region: string;
  municipality: string;
  onChange: (value: GeoLocationFields) => void;
  disabled?: boolean;
  purposeNote?: string;
}

const DEFAULT_ZOOM = 11;

export default function GeoMapField(props: GeoMapFieldProps) {
  const { country, settlement, region, municipality, onChange, disabled, purposeNote } = props;
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<Array<{ label: string; lat: number; lng: number; location: GeoLocationFields }>>(
    [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provider = getEditionConfig().map_provider;

  useEffect(() => {
    if (!mapHostRef.current || mapRef.current) return;
    const [lat, lng] = defaultMapCenter(country);
    const map = L.map(mapHostRef.current, {
      center: [lat, lng],
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    // Leaflet 1.9+ embeds a UA flag in the default prefix; keep only OSM credit (RU compliance).
    map.attributionControl.setPrefix("");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [country]);

  const applyLocation = useCallback(
    (loc: GeoLocationFields, fly = true) => {
      onChange(loc);
      setError(null);
      const map = mapRef.current;
      if (map && loc.lat != null && loc.lng != null) {
        if (fly) map.flyTo([loc.lat, loc.lng], Math.max(map.getZoom(), 11), { duration: 0.6 });
        else map.setView([loc.lat, loc.lng], Math.max(map.getZoom(), 11));
      }
    },
    [onChange],
  );

  const confirmMapCenter = useCallback(async () => {
    const map = mapRef.current;
    if (!map || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const center = map.getCenter();
      const loc = await reverseGeocode(center.lat, center.lng);
      applyLocation(loc, false);
      setHits([]);
      setSearch("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [applyLocation, disabled]);

  const runSearch = useCallback(async () => {
    if (disabled || search.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const rows = await searchSettlements(search, country);
      setHits(rows);
      if (rows.length === 0) {
        setError("Населённый пункт не найден. Попробуйте другое название или укажите точку на карте.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [country, disabled, search]);

  const selectedLabel =
    settlement.trim().length > 0
      ? [settlement, region !== settlement ? region : "", municipality !== region ? municipality : ""]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <div className="geo-map-field">
      {purposeNote && <p className="geo-map-purpose muted">{purposeNote}</p>}
      <div className="geo-map-header">
        <span className="geo-map-title">Местоположение на карте</span>
        <span className="geo-map-hint muted">
          Переместите карту так, чтобы перекрестие было над вашим населённым пунктом, и нажмите
          «Указать здесь». Достаточно уровня города / посёлка.
        </span>
      </div>

      <div className="geo-map-search">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runSearch();
            }
          }}
          placeholder="Быстрый поиск: Одинцово, Казань…"
          disabled={disabled || busy}
          aria-label="Поиск населённого пункта"
        />
        <button type="button" disabled={disabled || busy || search.trim().length < 2} onClick={() => void runSearch()}>
          Найти
        </button>
      </div>

      {hits.length > 0 && (
        <ul className="geo-map-hits" role="listbox" aria-label="Результаты поиска">
          {hits.map((hit) => (
            <li key={`${hit.lat}-${hit.lng}-${hit.label}`}>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => {
                  applyLocation(hit.location);
                  setHits([]);
                  setSearch(hit.label);
                }}
              >
                {hit.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedLabel ? (
        <p className="geo-map-selected">
          Выбрано: <strong>{selectedLabel}</strong>
        </p>
      ) : (
        <p className="muted tiny">Населённый пункт ещё не выбран.</p>
      )}

      {error && <p className="error tiny">{error}</p>}

      <div className="geo-map-shell">
        <div ref={mapHostRef} className="geo-map-canvas" aria-label="Интерактивная карта" />
        <div className="geo-map-crosshair" aria-hidden="true" />
      </div>

      <div className="geo-map-actions">
        <button type="button" className="primary" disabled={disabled || busy} onClick={() => void confirmMapCenter()}>
          {busy ? "Определяем…" : "Указать здесь"}
        </button>
        {provider === "yandex" && settlement && (
          <a
            className="geo-map-link"
            href={`https://yandex.ru/maps/?text=${encodeURIComponent(settlement)}`}
            target="_blank"
            rel="noreferrer"
          >
            Сверить в Яндекс.Картах
          </a>
        )}
      </div>
    </div>
  );
}
