/**
 * 快数采设备态实时：监听布局 Socket 转发的 CustomEvent，供列表页无感刷新。
 */

import { useEffect } from 'react';
import {
  KUAIIOT_DEVICE_REALTIME_EVENT,
  type KuaiiotDeviceRealtimePayload,
} from '../services/realtime';

type Options = {
  enabled?: boolean;
  onUpdate: (payload: KuaiiotDeviceRealtimePayload) => void;
};

export function useKuaiiotDeviceRealtime({ enabled = true, onUpdate }: Options) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const handler = (raw: Event) => {
      const detail = (raw as CustomEvent<KuaiiotDeviceRealtimePayload>).detail;
      if (!detail || typeof detail !== 'object') {
        return;
      }
      onUpdate(detail);
    };
    window.addEventListener(KUAIIOT_DEVICE_REALTIME_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(KUAIIOT_DEVICE_REALTIME_EVENT, handler as EventListener);
    };
  }, [enabled, onUpdate]);
}
