import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const COUNTRY_CENTER = { Portugal: [39.5, -8.0], Spain: [40.4, -3.7] };

function MapClick({ position, onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({ lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) });
    },
  });

  return position ? <CircleMarker center={[position.lat, position.lng]} radius={9} pathOptions={{ color: "#df302f", fillColor: "#df302f", fillOpacity: 0.9 }} /> : null;
}

function MapResizer({ country, position }) {
  const map = useMap();
  useEffect(() => {
    const nextCenter = position?.lat != null && position?.lng != null
      ? [position.lat, position.lng]
      : COUNTRY_CENTER[country] || COUNTRY_CENTER.Portugal;
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      map.setView(nextCenter, position?.lat != null ? 15 : 6);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [map, country, position?.lat, position?.lng]);
  return null;
}

export default function PickupPointMap({ value, country, onChange }) {
  const center = value?.lat != null && value?.lng != null ? [value.lat, value.lng] : COUNTRY_CENTER[country] || COUNTRY_CENTER.Portugal;

  return (
    <div>
      <div className="h-52 overflow-hidden rounded border-2 border-border">
        <MapContainer center={center} zoom={value?.lat != null ? 15 : 6} scrollWheelZoom className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
            url={import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"}
          />
          <MapClick position={value?.lat != null && value?.lng != null ? value : null} onSelect={onChange} />
          <MapResizer country={country} position={value} />
        </MapContainer>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Click the map to mark the collection point. Add its exact name and address below.
      </p>
      <a className="mt-1 inline-block text-[10px] text-muted-foreground underline" href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a map issue</a>
      {value?.lat != null && value?.lng != null && (
        <p className="mt-1 text-[10px] text-muted-foreground">Coordinates: {value.lat}, {value.lng}</p>
      )}
    </div>
  );
}
