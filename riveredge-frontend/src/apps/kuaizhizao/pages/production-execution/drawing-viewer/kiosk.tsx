/**
 * 图纸查看 - 工位机触屏模式页面
 *
 * 专门为工控机设计的全屏触屏图纸查看界面，适合车间固定工位使用。
 * 特点：大按钮、大字体、全屏模式、触屏优化布局、缩放、拖拽、旋转。
 *
 * Author: Luigi Lu
 * Date: 2026-01-27
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Space, message, Spin, Empty, Tag } from 'antd';
import { ZoomInOutlined, ZoomOutOutlined, ReloadOutlined, RotateLeftOutlined, RotateRightOutlined, DownloadOutlined, FullscreenOutlined } from '@ant-design/icons';
import { TouchScreenTemplate, TOUCH_SCREEN_CONFIG } from '../../../../../components/layout-templates';
import { useTouchScreen } from '../../../../../hooks/useTouchScreen';
import { App } from 'antd';

/**
 * 图纸查看 - 工位机触屏模式页面
 */
const DrawingViewerKioskPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const touchScreen = useTouchScreen();
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageScale, setImageScale] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 从URL参数获取图纸URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url');
    const drawingUrl = params.get('drawingUrl');
    const attachmentUrl = params.get('attachmentUrl');

    if (url) {
      setImageUrl(url);
    } else if (drawingUrl) {
      setImageUrl(drawingUrl);
    } else if (attachmentUrl) {
      setImageUrl(attachmentUrl);
    } else {
      messageApi.warning('请提供图纸URL');
    }
  }, []);

  /**
   * 处理图片缩放
   */
  const handleImageZoom = useCallback((delta: number) => {
    setImageScale((prevScale) => {
      const newScale = Math.max(0.5, Math.min(5, prevScale + delta));
      return newScale;
    });
  }, []);

  /**
   * 处理图片旋转
   */
  const handleImageRotate = useCallback((delta: number) => {
    setImageRotation((prevRotation) => (prevRotation + delta) % 360);
  }, []);

  /**
   * 重置图片状态
   */
  const handleReset = useCallback(() => {
    setImageScale(1);
    setImageRotation(0);
    setImagePosition({ x: 0, y: 0 });
  }, []);

  /**
   * 处理鼠标/触摸开始
   */
  const handleStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({
      x: clientX - imagePosition.x,
      y: clientY - imagePosition.y,
    });
  }, [imagePosition]);

  /**
   * 处理鼠标/触摸移动
   */
  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (isDragging) {
      setImagePosition({
        x: clientX - dragStart.x,
        y: clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  /**
   * 处理鼠标/触摸结束
   */
  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * 处理鼠标事件
   */
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (imageRef.current && imageRef.current.contains(e.target as Node)) {
        handleStart(e.clientX, e.clientY);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleMove(e.clientX, e.clientY);
      }
    };

    const handleMouseUp = () => {
      handleEnd();
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleStart, handleMove, handleEnd]);

  /**
   * 处理触摸事件
   */
  useEffect(() => {
    let touchStartDistance = 0;
    let touchStartScale = 1;
    let touchStartRotation = 0;
    let touchStartPosition = { x: 0, y: 0 };
    let isPinching = false;
    let isRotating = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        // 单指触摸：开始拖拽
        const touch = e.touches[0];
        handleStart(touch.clientX, touch.clientY);
      } else if (e.touches.length === 2) {
        // 双指触摸：开始缩放或旋转
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        touchStartDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );
        touchStartScale = imageScale;
        touchStartRotation = imageRotation;
        touchStartPosition = { ...imagePosition };
        isPinching = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && !isPinching) {
        // 单指移动：拖拽
        const touch = e.touches[0];
        handleMove(touch.clientX, touch.clientY);
      } else if (e.touches.length === 2 && isPinching) {
        // 双指移动：缩放或旋转
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY
        );

        // 计算缩放
        const scaleDelta = currentDistance / touchStartDistance;
        const newScale = Math.max(0.5, Math.min(5, touchStartScale * scaleDelta));
        setImageScale(newScale);

        // 计算旋转角度（可选，如果需要旋转功能）
        // const angle = Math.atan2(
        //   touch2.clientY - touch1.clientY,
        //   touch2.clientX - touch1.clientX
        // ) * (180 / Math.PI);
        // const startAngle = Math.atan2(
        //   e.touches[1].clientY - e.touches[0].clientY,
        //   e.touches[1].clientX - e.touches[0].clientX
        // ) * (180 / Math.PI);
        // setImageRotation((touchStartRotation + (angle - startAngle)) % 360);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        handleEnd();
        isPinching = false;
        isRotating = false;
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchstart', handleTouchStart, { passive: false });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      container.addEventListener('touchend', handleTouchEnd);
      container.addEventListener('touchcancel', handleTouchEnd);
    }

    return () => {
      if (container) {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
        container.removeEventListener('touchcancel', handleTouchEnd);
      }
    };
  }, [imageScale, imageRotation, imagePosition, handleStart, handleMove, handleEnd]);

  /**
   * 处理图片双击缩放
   */
  const handleImageDoubleClick = useCallback(() => {
    if (imageScale === 1) {
      setImageScale(2);
    } else {
      setImageScale(1);
      setImagePosition({ x: 0, y: 0 });
    }
  }, [imageScale]);

  /**
   * 处理下载图纸
   */
  const handleDownload = useCallback(() => {
    if (!imageUrl) {
      messageApi.warning('没有图纸可下载');
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `drawing-${Date.now()}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      messageApi.success('图纸下载成功');
    } catch (error: any) {
      messageApi.error(`下载图纸失败: ${error.message || '未知错误'}`);
    }
  }, [imageUrl, messageApi]);

  /**
   * 处理进入全屏
   */
  const handleEnterFullscreen = useCallback(async () => {
    try {
      await touchScreen.enterFullscreen();
      messageApi.success('已进入全屏模式');
    } catch (error: any) {
      messageApi.error(`进入全屏失败: ${error.message || '未知错误'}`);
    }
  }, [touchScreen, messageApi]);

  return (
    <TouchScreenTemplate
      title="图纸查看"
      fullscreen={true}
      footerButtons={[
        {
          title: '缩小',
          type: 'default',
          icon: <ZoomOutOutlined />,
          onClick: () => handleImageZoom(-0.2),
          disabled: imageScale <= 0.5,
          block: false,
        },
        {
          title: `重置 (${Math.round(imageScale * 100)}%)`,
          type: 'default',
          icon: <ReloadOutlined />,
          onClick: handleReset,
          block: false,
        },
        {
          title: '放大',
          type: 'default',
          icon: <ZoomInOutlined />,
          onClick: () => handleImageZoom(0.2),
          disabled: imageScale >= 5,
          block: false,
        },
        {
          title: '左旋转',
          type: 'default',
          icon: <RotateLeftOutlined />,
          onClick: () => handleImageRotate(-90),
          block: false,
        },
        {
          title: '右旋转',
          type: 'default',
          icon: <RotateRightOutlined />,
          onClick: () => handleImageRotate(90),
          block: false,
        },
        {
          title: '下载',
          type: 'default',
          icon: <DownloadOutlined />,
          onClick: handleDownload,
          block: false,
        },
        {
          title: '全屏',
          type: 'primary',
          icon: <FullscreenOutlined />,
          onClick: handleEnterFullscreen,
          block: false,
        },
      ]}
    >
      <Spin spinning={loading}>
        {!imageUrl ? (
          <Empty description="未找到图纸数据" />
        ) : (
          <div
            ref={containerRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* 图纸信息 */}
            <Card size="small" style={{ marginBottom: 24, backgroundColor: '#f5f5f5' }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <strong>图纸URL：</strong>
                  <span style={{ wordBreak: 'break-all' }}>{imageUrl}</span>
                </div>
                <div>
                  <strong>缩放比例：</strong>
                  <Tag color="blue">{Math.round(imageScale * 100)}%</Tag>
                </div>
                <div>
                  <strong>旋转角度：</strong>
                  <Tag color="green">{imageRotation}°</Tag>
                </div>
              </Space>
            </Card>

            {/* 图纸显示区域 */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f0f0f0',
                position: 'relative',
                touchAction: 'none', // 禁用默认触摸行为
              }}
            >
              <img
                ref={imageRef}
                src={imageUrl}
                alt="图纸"
                onError={() => {
                  messageApi.error('图纸加载失败');
                  setLoading(false);
                }}
                onLoad={() => {
                  setLoading(false);
                }}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  transform: `translate(${imagePosition.x}px, ${imagePosition.y}px) scale(${imageScale}) rotate(${imageRotation}deg)`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.1s ease',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'none',
                }}
                onDoubleClick={handleImageDoubleClick}
                draggable={false}
              />
            </div>

            {/* 操作提示 */}
            <Card size="small" style={{ marginTop: 24, backgroundColor: '#f5f5f5' }}>
              <Space direction="vertical" size="small" style={{ width: '100%', fontSize: 20 }}>
                <div>
                  <strong>操作提示：</strong>
                </div>
                <div>• 单指拖拽：移动图纸</div>
                <div>• 双指捏合：缩放图纸</div>
                <div>• 双击：放大/缩小</div>
                <div>• 使用底部按钮：缩放、旋转、重置、下载</div>
              </Space>
            </Card>
          </div>
        )}
      </Spin>
    </TouchScreenTemplate>
  );
};

export default DrawingViewerKioskPage;
