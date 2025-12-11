/**
 * RiverEdge SaaS 多组织框架 - 长按验证组件
 *
 * 用于防止频繁操作和自动化攻击
 * 要求用户长按按钮一定时间（默认2秒）才能通过验证
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';

/**
 * 长按验证组件属性
 */
export interface LongPressVerifyProps {
  /** 长按持续时间（毫秒），默认 2000ms */
  duration?: number;
  /** 验证通过回调 */
  onVerify: () => void;
  /** 按钮文本，默认 "长按验证" */
  text?: string;
  /** 按钮大小 */
  size?: 'small' | 'middle' | 'large';
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 长按验证组件
 *
 * 用户需要长按按钮一定时间才能通过验证
 * 支持鼠标和触摸事件
 */
export default function LongPressVerify({
  duration = 2000,
  onVerify,
  text = '长按验证',
  size = 'middle',
  disabled = false,
  className = '',
}: LongPressVerifyProps) {
  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  /**
   * 开始长按
   */
  const handlePressStart = () => {
    if (disabled || isVerified) return;

    setIsPressing(true);
    setProgress(0);
    startTimeRef.current = Date.now();

    // 进度更新定时器（每 50ms 更新一次）
    progressTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);

      // 达到持续时间，验证通过
      if (elapsed >= duration) {
        handleVerify();
      }
    }, 50);
  };

  /**
   * 结束长按
   */
  const handlePressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    setIsPressing(false);
    setProgress(0);
  };

  /**
   * 验证通过
   */
  const handleVerify = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    setIsVerified(true);
    setProgress(100);
    setIsPressing(false);

    // 调用验证通过回调
    onVerify();
  };

  /**
   * 清理定时器
   */
  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
      }
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={className} style={{ width: '100%' }}>
      <Button
        type="default"
        size={size}
        icon={<SafetyOutlined />}
        disabled={disabled || isVerified}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        style={{
          position: 'relative',
          overflow: 'hidden',
          width: '100%',
          transition: 'all 0.2s ease',
          userSelect: 'none',
          transform: isPressing ? 'scale(0.98)' : 'scale(1)',
          backgroundColor: isVerified ? '#52c41a' : '#faad14',
          borderColor: isVerified ? '#52c41a' : '#faad14',
          color: isVerified ? '#fff' : '#fff',
        }}
      >
        {isVerified ? '验证通过' : isPressing ? '请保持按住' : text}
        {isPressing && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'rgba(255, 255, 255, 0.3)',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: '#fff',
                transition: 'width 0.05s linear',
              }}
            />
          </div>
        )}
      </Button>
    </div>
  );
}

