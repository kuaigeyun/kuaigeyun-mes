import React, { useEffect, useRef } from 'react';
import type { FreightOrder } from '../../../services/logistics';
import type { AmapMapPublicConfig } from '../../../services/logistics';

type GeoPoint = {
  lng: number;
  lat: number;
  label: string;
  kind: 'origin' | 'destination' | 'waypoint';
};

function collectMapPoints(order: FreightOrder | null, orders: FreightOrder[]): GeoPoint[] {
  const source = order ? [order] : orders;
  const points: GeoPoint[] = [];
  for (const row of source) {
    if (row.origin_lng != null && row.origin_lat != null) {
      points.push({
        lng: row.origin_lng,
        lat: row.origin_lat,
        label: row.origin_address || row.order_code,
        kind: 'origin',
      });
    }
    if (row.destination_lng != null && row.destination_lat != null) {
      points.push({
        lng: row.destination_lng,
        lat: row.destination_lat,
        label: row.destination_address || row.order_code,
        kind: 'destination',
      });
    }
    for (const event of row.tracking_events ?? []) {
      if (event.lng != null && event.lat != null) {
        points.push({
          lng: event.lng,
          lat: event.lat,
          label: event.location || event.event_type,
          kind: 'waypoint',
        });
      }
    }
  }
  return points;
}

function collectRoutePoints(order: FreightOrder | null): GeoPoint[] {
  if (!order) return [];
  const route: GeoPoint[] = [];
  if (order.origin_lng != null && order.origin_lat != null) {
    route.push({
      lng: order.origin_lng,
      lat: order.origin_lat,
      label: order.origin_address || '',
      kind: 'origin',
    });
  }
  const events = [...(order.tracking_events ?? [])].sort((a, b) =>
    String(a.event_time).localeCompare(String(b.event_time)),
  );
  for (const event of events) {
    if (event.lng != null && event.lat != null) {
      route.push({
        lng: event.lng,
        lat: event.lat,
        label: event.location || event.event_type,
        kind: 'waypoint',
      });
    }
  }
  if (order.destination_lng != null && order.destination_lat != null) {
    route.push({
      lng: order.destination_lng,
      lat: order.destination_lat,
      label: order.destination_address || '',
      kind: 'destination',
    });
  }
  return route;
}

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode: string };
    AMap?: {
      Map: new (container: HTMLElement, opts: Record<string, unknown>) => {
        destroy: () => void;
        add: (overlay: unknown) => void;
        setFitView: (overlays?: unknown[], immediately?: boolean, avoid?: number[]) => void;
      };
      Marker: new (opts: Record<string, unknown>) => unknown;
      Polyline: new (opts: Record<string, unknown>) => unknown;
      Icon: new (opts: Record<string, unknown>) => unknown;
      Size: new (w: number, h: number) => unknown;
      Pixel: new (x: number, y: number) => unknown;
    };
  }
}

let amapLoader: Promise<typeof window.AMap> | null = null;

async function loadAmapJs(config: AmapMapPublicConfig): Promise<typeof window.AMap> {
  if (window.AMap) return window.AMap;
  if (!config.js_key) {
    throw new Error('AMAP_NOT_CONFIGURED');
  }
  if (!amapLoader) {
    amapLoader = new Promise((resolve, reject) => {
      if (config.security_code) {
        window._AMapSecurityConfig = { securityJsCode: config.security_code };
      }
      const script = document.createElement('script');
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.js_key!)}`;
      script.async = true;
      script.onload = () => {
        if (window.AMap) resolve(window.AMap);
        else reject(new Error('AMAP_LOAD_FAILED'));
      };
      script.onerror = () => reject(new Error('AMAP_LOAD_FAILED'));
      document.head.appendChild(script);
    });
  }
  return amapLoader;
}

export type LogisticsTrackingMapProps = {
  mapConfig: AmapMapPublicConfig | null;
  selectedOrder: FreightOrder | null;
  listOrders: FreightOrder[];
  emptyHint: string;
  notConfiguredHint: string;
};

export const LogisticsTrackingMap: React.FC<LogisticsTrackingMapProps> = ({
  mapConfig,
  selectedOrder,
  listOrders,
  emptyHint,
  notConfiguredHint,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{ destroy: () => void; setFitView: (overlays?: unknown[]) => void } | null>(null);
  const overlaysRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (!mapConfig?.configured || !containerRef.current) {
      return undefined;
    }
    let disposed = false;
    const container = containerRef.current;

    void (async () => {
      try {
        const AMap = await loadAmapJs(mapConfig);
        if (disposed || !container) return;
        mapRef.current?.destroy();
        const map = new AMap!.Map(container, {
          zoom: 5,
          viewMode: '2D',
        });
        mapRef.current = map;
        overlaysRef.current = [];

        const route = collectRoutePoints(selectedOrder);
        const points = route.length ? route : collectMapPoints(selectedOrder, listOrders);
        if (!points.length) {
          return;
        }

        const path: Array<[number, number]> = [];
        for (const point of points) {
          const marker = new AMap!.Marker({
            position: [point.lng, point.lat],
            title: point.label,
          });
          map.add(marker);
          overlaysRef.current.push(marker);
          path.push([point.lng, point.lat]);
        }

        if (route.length >= 2) {
          const line = new AMap!.Polyline({
            path,
            strokeColor: '#1677ff',
            strokeWeight: 4,
          });
          map.add(line);
          overlaysRef.current.push(line);
        }

        map.setFitView(overlaysRef.current, false, [48, 48, 48, 48]);
      } catch {
        // 上层展示未配置或加载失败提示
      }
    })();

    return () => {
      disposed = true;
      mapRef.current?.destroy();
      mapRef.current = null;
      overlaysRef.current = [];
    };
  }, [listOrders, mapConfig, selectedOrder]);

  if (!mapConfig?.configured) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          color: 'var(--ant-color-text-secondary)',
        }}
      >
        {notConfiguredHint}
      </div>
    );
  }

  const hasPoints =
    collectRoutePoints(selectedOrder).length > 0 ||
    collectMapPoints(selectedOrder, listOrders).length > 0;

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 320 }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      {!hasPoints ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            padding: 24,
            textAlign: 'center',
            color: 'var(--ant-color-text-secondary)',
            background: 'rgba(255,255,255,0.55)',
          }}
        >
          {emptyHint}
        </div>
      ) : null}
    </div>
  );
};

export default LogisticsTrackingMap;
