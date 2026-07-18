/**
 * 工位绑定组件
 *
 * 用于选择和绑定当前终端所属的工位。
 */

import React, { useState, useEffect } from 'react';
import { Select, message, Typography, Form, Button } from 'antd';
import { LoginOutlined, EnvironmentOutlined, LogoutOutlined } from '@ant-design/icons';
import {
  workshopApi,
  productionLineApi,
  workstationApi,
  factoryListItems,
} from '../../master-data/services/factory';
import { getTenantId } from '../../../utils/auth';

const { Title, Text } = Typography;

/** 工位绑定存储 key（按租户隔离） */
export function getStationStorageKey(): string {
  const tenantId = getTenantId();
  return tenantId != null ? `kuaizhizao_current_station_t${tenantId}` : 'kuaizhizao_current_station';
}

/** @deprecated 使用 getStationStorageKey() 以支持租户隔离 */
export const STATION_STORAGE_KEY = 'kuaizhizao_current_station';

export interface StationInfo {
  workshopId: number;
  workshopName: string;
  lineId?: number;
  lineName?: string;
  stationId: number;
  stationName: string;
  stationCode: string;
  workCenterId?: number;
  workCenterName?: string;
}

interface StationBinderProps {
  onBindSuccess: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
  /** 取消按钮文案，工位终端可用「返回登录」 */
  cancelText?: string;
  /** 是否写入 localStorage 永久绑定，默认 true；共享报工传 false */
  persist?: boolean;
  /** persist=false 时回传所选工位；persist=true 时仍可读 storage */
  onSelect?: (info: StationInfo) => void;
  /** 标题文案，共享模式可用「选择会话工位」 */
  title?: string;
  /** 副标题 */
  subtitle?: string;
  /** 确认按钮文案 */
  confirmText?: string;
}

const StationBinder: React.FC<StationBinderProps> = ({
  onBindSuccess,
  onCancel,
  showCancel = false,
  cancelText = '取消',
  persist = true,
  onSelect,
  title,
  subtitle,
  confirmText,
}) => {
  const [loading, setLoading] = useState(false);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [lines, setLines] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);

  const [selectedWorkshop, setSelectedWorkshop] = useState<number | undefined>(undefined);
  const [selectedLine, setSelectedLine] = useState<number | undefined>(undefined);
  const [selectedStation, setSelectedStation] = useState<number | undefined>(undefined);

  useEffect(() => {
    void loadWorkshops();
  }, []);

  const loadWorkshops = async () => {
    setLoading(true);
    try {
      const res = await workshopApi.list({ is_active: true });
      const items = factoryListItems(res as any);
      setWorkshops(items);
      if (!items.length) {
        message.warning('暂无可用车间，请先在主数据中维护车间');
      }
    } catch (error) {
      console.error('加载车间失败', error);
      message.error(error instanceof Error ? error.message : '加载车间失败');
      setWorkshops([]);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkshopChange = async (val: number) => {
    setSelectedWorkshop(val);
    setSelectedLine(undefined);
    setSelectedStation(undefined);
    setLines([]);
    setStations([]);

    if (val) {
      try {
        const res = await productionLineApi.list({ workshop_id: val, is_active: true });
        const items = factoryListItems(res as any);
        setLines(items);
        if (!items.length) {
          message.warning('该车间下暂无产线');
        }
      } catch (error) {
        console.error('加载产线失败', error);
        message.error(error instanceof Error ? error.message : '加载产线失败');
      }
    }
  };

  const handleLineChange = async (val: number) => {
    setSelectedLine(val);
    setSelectedStation(undefined);
    setStations([]);
    if (!val) return;
    try {
      const res = await workstationApi.list({ production_line_id: val, is_active: true });
      const items = factoryListItems(res as any);
      setStations(items);
      if (!items.length) {
        message.warning('该产线下暂无工位');
      }
    } catch (error) {
      console.error('加载工位失败', error);
      message.error(error instanceof Error ? error.message : '加载工位失败');
    }
  };

  const handleConfirm = () => {
    if (!selectedWorkshop) {
      message.warning('请选择车间');
      return;
    }
    if (!selectedLine) {
      message.warning('请选择产线');
      return;
    }
    if (!selectedStation) {
      message.warning('请选择要绑定的工位');
      return;
    }

    const station = stations.find((s) => s.id === selectedStation);
    const workshop = workshops.find((w) => w.id === selectedWorkshop);
    const line = lines.find((l) => l.id === selectedLine);

    if (!station) {
      message.error('工位数据无效，请重新选择');
      return;
    }

    const info: StationInfo = {
      workshopId: workshop?.id || 0,
      workshopName: workshop?.name || '',
      lineId: line?.id,
      lineName: line?.name,
      stationId: station.id,
      stationName: station.name,
      stationCode: station.code,
      workCenterId: (station as any).workCenterId ?? (station as any).work_center_id,
      workCenterName: (station as any).workCenterName ?? (station as any).work_center_name,
    };

    if (persist) {
      localStorage.setItem(getStationStorageKey(), JSON.stringify(info));
      message.success(`工位绑定成功：${station.name}`);
    } else {
      message.success(`已选择工位：${station.name}`);
    }
    onSelect?.(info);
    onBindSuccess();
  };

  const selectCommon = {
    size: 'large' as const,
    style: { width: '100%', minHeight: 56 },
    popupClassName: 'station-select-dropdown',
    // 挂到 body，避免工位终端 html/body overflow:hidden 裁切下拉
    getPopupContainer: () => document.body,
    showSearch: true,
    optionFilterProp: 'label' as const,
  };

  return (
    <div style={{ maxWidth: 600, width: '100%', margin: '0 auto', padding: '20px 24px', color: 'rgba(255,255,255,0.88)' }}>
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <EnvironmentOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
        <Title level={3} style={{ color: '#fff' }}>
          {title || (persist ? '请绑定当前终端所属工位' : '请选择会话工位')}
        </Title>
        <Text type="secondary" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {subtitle ||
            (persist
              ? '绑定后，终端将自动显示该工位的生产任务'
              : '本次会话有效，报工后可更换工位，不会永久绑定本机')}
        </Text>
      </div>

      <Form layout="vertical" size="large">
        <Form.Item label={<span style={{ color: 'rgba(255,255,255,0.85)' }}>所属车间</span>} required>
          <Select
            {...selectCommon}
            placeholder="请选择车间"
            loading={loading}
            value={selectedWorkshop}
            onChange={(v) => void handleWorkshopChange(v)}
            options={workshops.map((w) => ({ value: w.id, label: w.name }))}
            notFoundContent={loading ? '加载中…' : '暂无车间'}
          />
        </Form.Item>

        <Form.Item label={<span style={{ color: 'rgba(255,255,255,0.85)' }}>所属产线</span>} required>
          <Select
            {...selectCommon}
            placeholder="请选择产线"
            value={selectedLine}
            disabled={!selectedWorkshop}
            onChange={(v) => void handleLineChange(v)}
            options={lines.map((l) => ({ value: l.id, label: l.name }))}
            notFoundContent="暂无产线"
          />
        </Form.Item>

        <Form.Item label={<span style={{ color: 'rgba(255,255,255,0.85)' }}>作业工位</span>} required>
          <Select
            {...selectCommon}
            placeholder="请选择工位"
            value={selectedStation}
            disabled={!selectedLine}
            onChange={(val) => setSelectedStation(val)}
            options={stations.map((s) => ({
              value: s.id,
              label: `${s.name} (${s.code})`,
            }))}
            notFoundContent="暂无工位"
          />
        </Form.Item>

        <div style={{ marginTop: 40, display: 'flex', gap: 16 }}>
          {showCancel && (
            <Button
              size="large"
              icon={<LogoutOutlined />}
              onClick={onCancel}
              style={{
                flex: 1,
                height: 56,
                fontSize: 18,
                color: '#fff',
                background: 'rgba(255,255,255,0.08)',
                borderColor: 'rgba(255,255,255,0.35)',
              }}
            >
              {cancelText}
            </Button>
          )}
          <Button
            type="primary"
            size="large"
            icon={<LoginOutlined />}
            onClick={handleConfirm}
            disabled={!selectedStation}
            loading={loading}
            style={{
              flex: 1,
              height: 56,
              fontSize: 18,
              fontWeight: 600,
              opacity: selectedStation ? 1 : 0.55,
            }}
          >
            {confirmText || (persist ? '确认绑定' : '确认选择')}
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default StationBinder;
