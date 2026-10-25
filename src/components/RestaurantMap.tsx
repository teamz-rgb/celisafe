"use client";

import { useCallback, useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapRestaurant {
  id: string;
  name: string;
  review_rating: number | null;
  latitude: number;
  longitude: number;
  is_discovery?: boolean;
}

interface RestaurantMapProps {
  center: [number, number];
  places: MapRestaurant[];
  userLocation?: [number, number];
  selectedId: string | null;
  onSelect: (placeId: string) => void;
  onViewport: (bounds: { north: number; south: number; east: number; west: number }) => void;
}

function ViewportListener({ onViewport }: Pick<RestaurantMapProps, "onViewport">) {
  const map = useMap();
  const report = useCallback(() => {
    const bounds = map.getBounds();
    onViewport({ north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() });
  }, [map, onViewport]);
  useMapEvents({ moveend: report, zoomend: report });
  useEffect(() => {
    const timer = window.setTimeout(report, 100);
    return () => window.clearTimeout(timer);
  }, [report]);
  return null;
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  const [latitude, longitude] = center;
  useEffect(() => {
    map.flyTo([latitude, longitude], map.getZoom(), { duration: 0.8 });
  }, [latitude, longitude, map]);
  return null;
}

export default function RestaurantMap({ center, places, userLocation, selectedId, onSelect, onViewport }: RestaurantMapProps) {
  const bounds: LatLngBoundsExpression = useMemo(() => [[-85, -180], [85, 180]], []);
  return (
    <MapContainer center={center} zoom={12} minZoom={3} maxBounds={bounds} maxBoundsViscosity={0.65} scrollWheelZoom className="h-full min-h-[460px] w-full rounded-2xl">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <RecenterMap center={center} />
      <ViewportListener onViewport={onViewport} />
      {userLocation && <CircleMarker center={userLocation} radius={9} pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}><Tooltip>You are here</Tooltip></CircleMarker>}
      {places.map((place) => (
        <CircleMarker
          key={place.id}
          center={[place.latitude, place.longitude]}
          radius={selectedId === place.id ? 11 : 8}
          pathOptions={{ color: selectedId === place.id ? "#6d28d9" : "#fff", weight: 3, fillColor: selectedId === place.id ? "#8b5cf6" : place.is_discovery ? "#38bdf8" : "#ec4899", fillOpacity: 0.95 }}
          eventHandlers={{ click: () => onSelect(place.id) }}
        ><Tooltip>{place.name}</Tooltip></CircleMarker>
      ))}
    </MapContainer>
  );
}
