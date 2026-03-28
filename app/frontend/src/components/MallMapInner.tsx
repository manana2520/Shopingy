'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Mall } from '@/lib/types';

const DEFAULT_CENTER: [number, number] = [49.8, 15.5];
const DEFAULT_ZOOM = 7;
const MIN_RADIUS = 5;
const MAX_RADIUS = 25;

const MALL_TYPE_COLORS: Record<string, string> = {
  'Shopping Mall': '#3EA8FF',
  'Retail Park': '#F4845F',
  'Outlet Center - Europe': '#97D8C4',
  'Airport': '#F9C74F',
  'Train Station': '#90BE6D',
};
const DEFAULT_MALL_COLOR = '#577590';

function getMallColor(type: string): string {
  return MALL_TYPE_COLORS[type] ?? DEFAULT_MALL_COLOR;
}

function computeRadius(storeCount: number, minCount: number, maxCount: number): number {
  if (maxCount === minCount) return (MIN_RADIUS + MAX_RADIUS) / 2;
  const ratio = (storeCount - minCount) / (maxCount - minCount);
  return MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS);
}

interface MallMapInnerProps {
  malls: Mall[];
  height?: string;
}

export default function MallMapInner({ malls, height = '400px' }: MallMapInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || malls.length === 0) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    const storeCounts = malls.map((m) => Number(m.stores_count) || 0);
    const minCount = Math.min(...storeCounts, 0);
    const maxCount = Math.max(...storeCounts, 1);

    malls.forEach((mall) => {
      const lat = typeof mall.latitude === 'string' ? parseFloat(mall.latitude) : Number(mall.latitude);
      const lng = typeof mall.longitude === 'string' ? parseFloat(mall.longitude) : Number(mall.longitude);

      if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

      const color = getMallColor(mall.type);
      const radius = computeRadius(Number(mall.stores_count) || 0, minCount, maxCount);

      L.circleMarker([lat, lng], {
        radius,
        color,
        fillColor: color,
        fillOpacity: 0.6,
        weight: 1,
      })
        .bindPopup(
          `<div style="min-width:160px">
            <strong style="font-size:14px">${mall.name}</strong>
            <div style="margin-top:4px;font-size:12px;color:#64748B">
              <div>Type: ${mall.type || 'N/A'}</div>
              <div>City: ${mall.city}</div>
              <div>Stores: ${mall.stores_count ?? 'N/A'}</div>
              <div>Brands: ${mall.brands_count ?? 'N/A'}</div>
              <div>GLA: ${mall.gla ? `${Number(mall.gla).toLocaleString()} m\u00B2` : 'N/A'}</div>
            </div>
          </div>`
        )
        .addTo(map);
    });
  }, [malls]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%', borderRadius: '12px' }}
    />
  );
}
