/**
 * 物流轨迹展示面板
 *
 * 根据承运商和运单号调用物流 API，展示时间线轨迹。
 *
 * @author RiverEdge Team
 * @date 2026-03-04
 */

import React, { useEffect, useState } from 'react';
import { Timeline, Empty, Spin, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { logisticsApi, type LogisticsTrace } from '../../apps/kuaizhizao/services/logistics';

interface LogisticsTrackingPanelProps {
  carrier: string;
  trackingNumber: string;
  /** 是否自动加载，默认 true */
  autoLoad?: boolean;
}

const LogisticsTrackingPanel: React.FC<LogisticsTrackingPanelProps> = ({
  carrier,
  trackingNumber,
  autoLoad = true,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    success: boolean;
    carrier: string;
    tracking_number: string;
    status: string;
    traces?: LogisticsTrace[];
    message?: string;
  } | null>(null);

  const fetchTrack = async () => {
    if (!carrier?.trim() || !trackingNumber?.trim()) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await logisticsApi.track(carrier, trackingNumber);
      setData(res);
    } catch (err) {
      setData({
        success: false,
        carrier,
        tracking_number: trackingNumber,
        status: '查询失败',
        message: (err as Error)?.message || '物流查询失败',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoLoad && carrier?.trim() && trackingNumber?.trim()) {
      fetchTrack();
    } else if (!carrier?.trim() || !trackingNumber?.trim()) {
      setData(null);
    }
  }, [carrier, trackingNumber, autoLoad]);

  if (!carrier?.trim() || !trackingNumber?.trim()) {
    return (
      <Empty
        description="请先填写承运商和运单号"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        style={{ padding: 24 }}
      />
    );
  }

  if (loading && !data) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin tip="正在查询物流..." />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (!data.success) {
    return (
      <div style={{ padding: 24 }}>
        <Empty
          description={data.message || '物流查询失败'}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" icon={<ReloadOutlined />} onClick={fetchTrack} loading={loading}>
            重试
          </Button>
        </Empty>
      </div>
    );
  }

  const traces = data.traces || [];
  if (traces.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="暂无物流轨迹信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--ant-color-text-secondary)' }}>
          {data.carrier} · {data.tracking_number} · {data.status}
        </span>
        <Button type="link" size="small" icon={<ReloadOutlined />} onClick={fetchTrack} loading={loading}>
          刷新
        </Button>
      </div>
      <Timeline
        items={traces.map((t, idx) => ({
          color: idx === 0 ? 'green' : 'blue',
          children: (
            <div>
              <div style={{ fontWeight: 500 }}>{t.status}</div>
              <div style={{ fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>{t.time}</div>
              {t.location && (
                <div style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', marginTop: 4 }}>
                  {t.location}
                </div>
              )}
            </div>
          ),
        }))}
      />
    </div>
  );
};

export default LogisticsTrackingPanel;
