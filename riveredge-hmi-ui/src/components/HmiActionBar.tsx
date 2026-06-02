import type { ReactNode } from 'react';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  PauseCircleOutlined,
  AlertOutlined,
  ExperimentOutlined,
  StopOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import { HMI_STATION_LAYOUT } from '../tokens/layout';
import { HmiButton } from './HmiButton';

export type HmiActionBarProps = {
  disabled?: boolean;
  reportDisabled?: boolean;
  startDisabled?: boolean;
  isPaused?: boolean;
  batchDisabled?: boolean;
  loading?: boolean;
  onStart: () => void;
  onReport: () => void;
  onPause: () => void;
  onAndon: () => void;
  onInspect: () => void;
  onEnd: () => void;
  onBatch: () => void;
  /** 自定义主操作区（默认：开工/报工/暂停/安灯） */
  primaryExtra?: ReactNode;
  /** 自定义次要操作区（默认：检验/结束/批次绑定） */
  secondaryExtra?: ReactNode;
};

/** 底部固定主操作栏（主流工位机：大按钮 + 左右分区） */
export function HmiActionBar({
  disabled,
  reportDisabled,
  startDisabled,
  isPaused,
  batchDisabled,
  loading,
  onStart,
  onReport,
  onPause,
  onAndon,
  onInspect,
  onEnd,
  onBatch,
  primaryExtra,
  secondaryExtra,
}: HmiActionBarProps) {
  const reportMuted = disabled || reportDisabled;
  const startMuted = disabled || startDisabled;

  return (
    <div className="hmi-action-bar" style={{ height: HMI_STATION_LAYOUT.FOOTER_ACTION_HEIGHT }}>
      <div className="hmi-action-bar__primary">
        {primaryExtra ?? (
          <>
            <HmiButton
              hmiVariant={startMuted ? 'default' : 'primary'}
              hmiSize="primary"
              icon={<PlayCircleOutlined />}
              iconSize={28}
              disabled={startMuted}
              loading={loading}
              onClick={onStart}
            >
              开工
            </HmiButton>
            <HmiButton
              hmiVariant={reportMuted ? 'default' : 'success'}
              hmiSize="primary"
              icon={<CheckCircleOutlined />}
              iconSize={28}
              disabled={reportMuted}
              loading={loading}
              onClick={onReport}
              className={reportMuted ? undefined : 'hmi-btn--report-active'}
              style={{ minWidth: 200 }}
            >
              报工
            </HmiButton>
            <HmiButton
              hmiSize="action"
              icon={<PauseCircleOutlined />}
              disabled={disabled}
              onClick={onPause}
            >
              {isPaused ? '恢复' : '暂停'}
            </HmiButton>
            <HmiButton
              hmiVariant="danger"
              hmiSize="action"
              icon={<AlertOutlined />}
              disabled={disabled}
              onClick={onAndon}
              style={{ minWidth: 140 }}
            >
              安灯
            </HmiButton>
          </>
        )}
      </div>
      <div className="hmi-action-bar__secondary">
        {secondaryExtra ?? (
          <>
            <HmiButton hmiSize="action" icon={<ExperimentOutlined />} disabled={disabled} onClick={onInspect}>
              检验
            </HmiButton>
            <HmiButton hmiVariant="danger" hmiSize="action" icon={<StopOutlined />} disabled={disabled} onClick={onEnd}>
              结束
            </HmiButton>
            <HmiButton
              hmiSize="action"
              icon={<ScanOutlined />}
              disabled={disabled || batchDisabled}
              onClick={onBatch}
            >
              批次绑定
            </HmiButton>
          </>
        )}
      </div>
    </div>
  );
}
