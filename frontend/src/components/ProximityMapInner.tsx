'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { ProximityMall } from '@/lib/types';

const MIN_MARKER_RADIUS = 6;
const MAX_MARKER_RADIUS = 20;
const CENTER_MARKER_RADIUS = 12;
const RADIUS_CIRCLE_COLOR = '#3EA8FF';
const CENTER_COLOR = '#EF4444';
const NEARBY_COLOR = '#3EA8FF';

interface ProximityMapInnerProps {
  center: { lat: number; lng: number; name: string };
  nearby: ProximityMall[];
  radiusKm: number;
  height?: string;
}

function computeRadius(storeCount: number, minCount: number, maxCount: number): number {
  if (maxCount === minCount) return (MIN_MARKER_RADIUS + MAX_MARKER_RADIUS) / 2;
  const ratio = (storeCount - minCount) / (maxCount - minCount);
  return MIN_MARKER_RADIUS + ratio * (MAX_MARKER_RADIUS - MIN_MARKER_RADIUS);
}

export default function ProximityMapInner({ center, nearby, radiusKm, height = '500px' }: ProximityMapInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([center.lat, center.lng], 11);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers and circle when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear all non-tile layers
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) {
        map.removeLayer(layer);
      }
    });

    // Add radius circle
    const radiusCircle = L.circle([center.lat, center.lng], {
      radius: radiusKm * 1000,
      color: RADIUS_CIRCLE_COLOR,
      fillColor: RADIUS_CIRCLE_COLOR,
      fillOpacity: 0.08,
      weight: 2,
      dashArray: '6 4',
    }).addTo(map);

    // Add center marker
    L.circleMarker([center.lat, center.lng], {
      radius: CENTER_MARKER_RADIUS,
      color: CENTER_COLOR,
      fillColor: CENTER_COLOR,
      fillOpacity: 0.9,
      weight: 2,
    })
      .bindPopup(
        `<div style="min-width:140px">
          <strong style="font-size:14px;color:${CENTER_COLOR}">${center.name}</strong>
          <div style="margin-top:4px;font-size:12px;color:#64748B">Center mall</div>
        </div>`
      )
      .addTo(map);

    // Add nearby markers
    const storeCounts = nearby.map((m) => m.stores_count);
    const minCount = Math.min(...storeCounts, 0);
    const maxCount = Math.max(...storeCounts, 1);

    nearby.forEach((mall) => {
      const r = computeRadius(mall.stores_count, minCount, maxCount);
      L.circleMarker([mall.latitude, mall.longitude], {
        radius: r,
        color: NEARBY_COLOR,
        fillColor: NEARBY_COLOR,
        fillOpacity: 0.6,
        weight: 1,
      })
        .bindPopup(
          `<div style="min-width:160px">
            <strong style="font-size:14px">${mall.name}</strong>
            <div style="margin-top:4px;font-size:12px;color:#64748B">
              <div>Distance: ${mall.distance_km} km</div>
              <div>Type: ${mall.type || 'N/A'}</div>
              <div>City: ${mall.city}</div>
              <div>Stores: ${mall.stores_count}</div>
              <div>Brands: ${mall.brands_count}</div>
              ${mall.gla ? `<div>GLA: ${Number(mall.gla).toLocaleString()} m\u00B2</div>` : ''}
            </div>
          </div>`
        )
        .addTo(map);
    });

    // Fit map to radius circle bounds
    map.fitBounds(radiusCircle.getBounds(), { padding: [30, 30] });
  }, [center, nearby, radiusKm]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%', borderRadius: '12px' }}
    />
  );
}
