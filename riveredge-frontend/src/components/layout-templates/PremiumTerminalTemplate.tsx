/**
 * 高级生产终端布局模板 (Premium Production Terminal)
 * 
 * 特点：
 * 1. 深色科技感，支持玻璃拟态 (Glassmorphism)
 * 2. 响应式网格布局，适合一屏闭环显示
 * 3. 集成全屏切换、实时时钟及状态概览
 * 
 * Author: Antigravity
 * Date: 2026-02-05
 */

import React, { ReactNode, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Layout, Button, Divider, theme, ConfigProvider, Tag } from 'antd';
import { FullscreenOutlined, FullscreenExitOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { HMI_DESIGN_TOKENS, HMI_LAYOUT, HMI_ANTD_TOKEN_OVERRIDE } from './constants';

const { Header, Content } = Layout;

export interface PremiumTerminalTemplateProps {
  /** 标题 */
  title?: string;
  /** 员工别名 */
  operatorName?: string;
  /** 员工头像 URL（可选） */
  operatorAvatar?: string;
  /** 员工角色（可选） */
  operatorRole?: string;
  /** 员工邮箱（可选） */
  operatorEmail?: string;
  /** 工位名称 */
  stationName?: string;
  /** 厂区名称（可选） */
  stationArea?: string;
  /** 车间名称（可选） */
  stationWorkshop?: string;
  /** 产线名称（可选） */
  stationLine?: string;
  /** 设备名称 */
  deviceName?: string;
  /** 主要内容 (通常为 Grid 容器) */
  children: ReactNode;
  /** 顶栏右侧额外内容 */
  headerExtra?: ReactNode;
}

const PremiumTerminalTemplate: React.FC<PremiumTerminalTemplateProps> = ({
  operatorName = '未登录',
  operatorAvatar,
  operatorRole,
  operatorEmail,
  stationName = '未绑定',
  stationArea,
  stationWorkshop,
  stationLine,
  children,
  headerExtra,
}) => {
  const [time, setTime] = useState(dayjs().format('YYYY-MM-DD HH:mm:ss'));
  const [isTerminalFullscreen, setTerminalFullscreen] = useState(false);
  const fullscreenWrapRef = useRef<HTMLDivElement>(null);

  // 实时时钟
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 操作系统级全屏：进入时对 Portal 容器调用 requestFullscreen
  useEffect(() => {
    if (!isTerminalFullscreen || !fullscreenWrapRef.current) return;
    const el = fullscreenWrapRef.current;
    const req =
      el.requestFullscreen ??
      (el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen;
    if (req) {
      req.call(el).catch(() => setTerminalFullscreen(false));
    }
    return () => {
      if (document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement) {
        (document.exitFullscreen ?? (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen)?.call(document);
      }
    };
  }, [isTerminalFullscreen]);

  // 监听用户通过 Esc 或浏览器按钮退出全屏，同步状态
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && !(document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement) {
        setTerminalFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);

  const toggleTerminalFullscreen = () => {
    if (isTerminalFullscreen) {
      const exit =
        document.exitFullscreen ??
        (document as Document & { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen;
      if (exit) exit.call(document);
    } else {
      setTerminalFullscreen(true);
    }
  };

  const fullscreenWrapStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 9999,
    background: HMI_DESIGN_TOKENS.BG_GRADIENT_MAIN,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const terminalContent = (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          ...HMI_ANTD_TOKEN_OVERRIDE,
          colorBgBase: HMI_DESIGN_TOKENS.BG_PRIMARY,
        },
      }}
    >
      <Layout 
        id="premium-terminal-layout"
        style={{ 
          height: '100%',
          minHeight: 0,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          background: HMI_DESIGN_TOKENS.BG_GRADIENT_MAIN,
          position: 'relative',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: HMI_DESIGN_TOKENS.FONT_FAMILY,
        }}
      >
        <style>{`
          #premium-terminal-layout .ant-layout-header {
            background: linear-gradient(135deg, #0a1f3c 0%, #061428 50%, #000814 100%) !important;
            color: #ffffff !important;
          }
          #premium-terminal-layout .ant-layout-header .ant-typography,
          #premium-terminal-layout .ant-layout-header .ant-btn {
            color: #ffffff !important;
          }
          #premium-terminal-layout .ant-layout-header .ant-btn-primary {
            color: ${HMI_DESIGN_TOKENS.TEXT_PRIMARY} !important;
            background: ${HMI_DESIGN_TOKENS.BG_ELEVATED} !important;
            border-color: ${HMI_DESIGN_TOKENS.BORDER} !important;
          }
          #premium-terminal-layout .premium-header-extra-item {
            display: inline-flex;
            align-items: center;
            margin-left: 20px;
          }
        `}</style>
        {/* 背景装饰：与渐变协调的淡纹理（弱化以突出景深） */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          pointerEvents: 'none',
          background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%231677ff\' fill-opacity=\'0.02\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2v-4h4v-2H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          opacity: 0.6
        }} />

        {/* 顶部状态栏 */}
        <Header style={{ 
          backgroundColor: '#061428',
          background: 'linear-gradient(180deg, #0a1f3c 0%, #061428 50%, #000814 100%)',
          borderBottom: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
          padding: '0 24px',
          height: HMI_LAYOUT.HEADER_HEIGHT,
          minHeight: HMI_LAYOUT.HEADER_HEIGHT,
          display: 'flex',
          alignItems: 'center',
          zIndex: 100,
          color: HMI_DESIGN_TOKENS.TEXT_PRIMARY,
          overflowX: 'auto',
          overflowY: 'hidden',
          flexShrink: 0,
        }}>
          {/* 左侧区域：工位信息(一行) / 员工信息 */}
          <div className="header-left-block">
            <div className="header-station-breadcrumb">
              {[stationArea, stationWorkshop, stationLine, stationName].filter(Boolean).length > 0
                ? [stationArea, stationWorkshop, stationLine, stationName].filter(Boolean).map((item, i, arr) => (
                    <span
                      key={i}
                      className={`header-station-segment ${i === arr.length - 1 ? 'header-station-segment-current' : ''}`}
                    >
                      {item}
                    </span>
                  ))
                : <span className="header-station-segment header-station-segment-current">未绑定</span>}
            </div>
            <Divider type="vertical" className="header-divider-v" />
            <div className="header-operator-block">
              <span className="header-operator-avatar">
                {operatorAvatar ? (
                  <img src={operatorAvatar} alt="" />
                ) : (
                  <UserOutlined style={{ fontSize: 20, color: HMI_DESIGN_TOKENS.TEXT_TERTIARY }} />
                )}
              </span>
              <div className="header-operator-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="header-operator-name">{operatorName}</span>
                    {operatorRole && (
                        <Tag 
                            bordered={false} 
                            style={{ 
                                margin: 0, 
                                background: operatorRole === '管理员' ? 'linear-gradient(135deg, #FF9000 0%, #F56A00 100%)' : 'rgba(255,255,255,0.15)',
                                color: '#fff',
                                border: '1px solid rgba(255,255,255,0.2)',
                                fontSize: 10,
                                lineHeight: '18px',
                                padding: '0 6px',
                                borderRadius: 4,
                            }}
                        >
                            {operatorRole}
                        </Tag>
                    )}
                </div>
                {operatorEmail && <span className="header-operator-email">{operatorEmail}</span>}
              </div>
            </div>
          </div>

          {/* 中间自适应占位 */}
          <div style={{ flex: 1, minWidth: 20 }} />

          {/* 右侧区域：全屏、刷新、切换工位、时间 */}
          <div className="header-right-group">
            <div className="header-extra-container">
              <Button 
                type="default"
                icon={isTerminalFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} 
                onClick={toggleTerminalFullscreen}
              >
                {isTerminalFullscreen ? '退出全屏' : '全屏'}
              </Button>
              {headerExtra}
            </div>
            <div className="header-controls">
              <div className="time-display">
                <div className="time-display-text">
                  <span className="time-display-time">{time.split(' ')[1]}</span>
                  <span className="time-display-date">{time.split(' ')[0]}</span>
                </div>
              </div>
            </div>
          </div>

          <style>{`
            #premium-terminal-layout .header-tags-group {
              display: flex;
              gap: 8px;
            }
            #premium-terminal-layout .adaptive-tag {
              display: inline-flex !important;
              align-items: center !important;
              min-height: ${HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE}px !important;
              padding: 2px 12px !important;
              background: ${HMI_DESIGN_TOKENS.BG_ELEVATED} !important;
              color: ${HMI_DESIGN_TOKENS.TEXT_PRIMARY} !important;
              border-radius: 4px !important;
              white-space: nowrap !important;
              font-size: ${HMI_DESIGN_TOKENS.FONT_BODY_MIN}px !important;
            }
            
            #premium-terminal-layout .header-right-group {
              display: flex !important;
              align-items: center !important;
              gap: ${HMI_DESIGN_TOKENS.BUTTON_GAP}px !important;
              flex-shrink: 0 !important;
              min-width: 0 !important;
            }
            #premium-terminal-layout .header-extra-container {
              display: flex !important;
              align-items: center !important;
              gap: ${HMI_DESIGN_TOKENS.BUTTON_GAP}px !important;
              flex-shrink: 0 !important;
              min-width: 0 !important;
              overflow: visible !important;
            }
            #premium-terminal-layout .header-extra-container > * {
              display: flex !important;
              align-items: center !important;
              gap: ${HMI_DESIGN_TOKENS.BUTTON_GAP}px !important;
              flex-shrink: 0 !important;
            }
            /* 刷新 / 切换工位 / 全屏：与工位面包屑对齐，图标与文字间距统一 */
            #premium-terminal-layout .header-extra-container .ant-btn {
              flex-shrink: 0 !important;
              white-space: nowrap !important;
              width: auto !important;
              min-width: auto !important;
              margin: 0 !important;
              box-sizing: border-box !important;
              border-radius: ${HMI_DESIGN_TOKENS.PANEL_RADIUS}px !important;
              min-height: 36px !important;
              height: 36px !important;
              padding: 0 18px !important;
              font-size: 14px !important;
              font-weight: 600 !important;
              line-height: 1.4 !important;
              gap: 8px !important;
              background: ${HMI_DESIGN_TOKENS.HEADER_FLOATING_BG} !important;
              border: 1px solid rgba(255,255,255,0.15) !important;
              color: ${HMI_DESIGN_TOKENS.TEXT_PRIMARY} !important;
            }
            #premium-terminal-layout .header-extra-container .ant-btn:hover {
              background: linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.09) 100%) !important;
              border-color: ${HMI_DESIGN_TOKENS.BORDER} !important;
              color: ${HMI_DESIGN_TOKENS.TEXT_PRIMARY} !important;
            }
            /* 刷新、切换工位、全屏：统一使用 BG_ELEVATED 配色 */
            #premium-terminal-layout .header-extra-buttons {
              gap: ${HMI_DESIGN_TOKENS.BUTTON_GAP}px !important;
            }
            #premium-terminal-layout .header-extra-buttons .ant-btn {
              flex-shrink: 0 !important;
            }
            #premium-terminal-layout .header-extra-container .ant-btn .anticon {
              color: #fff !important;
            }
            #premium-terminal-layout .header-extra-container .ant-btn .anticon svg {
              fill: #fff !important;
              stroke: #fff !important;
              color: #fff !important;
            }

            #premium-terminal-layout .header-controls {
              display: flex !important;
              align-items: center !important;
              gap: ${HMI_DESIGN_TOKENS.BUTTON_GAP}px !important;
              flex-shrink: 0 !important;
            }

            
            #premium-terminal-layout .header-left-block {
              display: flex !important;
              align-items: center !important;
              flex-shrink: 0 !important;
              gap: 0 !important;
              min-width: 800px !important;
            }
            #premium-terminal-layout .header-divider-v {
              border-color: ${HMI_DESIGN_TOKENS.BORDER} !important;
              height: 28px !important;
              margin: 0 12px !important;
            }
            /* 工位信息：| A> >B > >C | 形，段间有 gap，箭头方向正确 */
            #premium-terminal-layout .header-station-breadcrumb {
              display: inline-flex !important;
              align-items: stretch !important;
              min-width: 0 !important;
              margin-left: 0 !important;
              border-radius: ${HMI_DESIGN_TOKENS.PANEL_RADIUS}px !important;
              overflow: hidden !important;
              box-shadow: 0 1px 2px rgba(0,0,0,0.25) !important;
              gap: 4px !important;
              isolation: isolate !important;
            }
            #premium-terminal-layout .header-station-segment {
              position: relative !important;
              padding: 8px 18px !important;
              font-size: 14px !important;
              font-weight: 600 !important;
              letter-spacing: 0.02em !important;
              line-height: 1.4 !important;
              white-space: nowrap !important;
              background: ${HMI_DESIGN_TOKENS.HEADER_FLOATING_BG} !important;
              color: ${HMI_DESIGN_TOKENS.TEXT_PRIMARY} !important;
              margin-left: 0 !important;
            }
            /* 首段：左直 | 右箭头 >（尖朝右），略亮于普通段 */
            #premium-terminal-layout .header-station-segment:first-child {
              padding-left: 18px !important;
              background: linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.08) 100%) !important;
              color: ${HMI_DESIGN_TOKENS.TEXT_PRIMARY} !important;
              clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%) !important;
            }
            /* 中间段：左 >（尖朝右） 右 > */
            #premium-terminal-layout .header-station-segment + .header-station-segment:not(.header-station-segment-current) {
              padding-left: 20px !important;
              clip-path: polygon(0 0, 10px 50%, 0 100%, calc(100% - 10px) 100%, 100% 50%, calc(100% - 10px) 0) !important;
            }
            /* 末段：左 >（尖朝右） 右直 | */
            #premium-terminal-layout .header-station-segment + .header-station-segment.header-station-segment-current {
              padding-left: 20px !important;
              background: ${HMI_DESIGN_TOKENS.HEADER_FLOATING_BG} !important;
              color: ${HMI_DESIGN_TOKENS.TEXT_PRIMARY} !important;
              clip-path: polygon(0 0, 10px 50%, 0 100%, 100% 100%, 100% 0) !important;
            }
            #premium-terminal-layout .header-station-segment:only-child {
              margin-left: 0 !important;
              clip-path: none !important;
              border-radius: ${HMI_DESIGN_TOKENS.PANEL_RADIUS}px !important;
            }
            #premium-terminal-layout .header-operator-block {
              display: flex !important;
              align-items: center !important;
              gap: 10px !important;
            }
            #premium-terminal-layout .header-operator-avatar {
              width: 36px !important;
              height: 36px !important;
              border-radius: 50% !important;
              overflow: hidden !important;
              background: ${HMI_DESIGN_TOKENS.BG_ELEVATED} !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              flex-shrink: 0 !important;
            }
            #premium-terminal-layout .header-operator-avatar img {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
            }
            #premium-terminal-layout .header-operator-info {
              display: flex !important;
              flex-direction: column !important;
              align-items: flex-start !important;
              justify-content: center !important;
              gap: 2px !important;
            }
            #premium-terminal-layout .header-operator-name {
              font-size: 14px !important;
              font-weight: 500 !important;
              color: ${HMI_DESIGN_TOKENS.TEXT_PRIMARY} !important;
              line-height: 1.3 !important;
            }
            #premium-terminal-layout .header-operator-role {
              font-size: 11px !important;
              color: ${HMI_DESIGN_TOKENS.TEXT_TERTIARY} !important;
              margin-top: 1px !important;
            }
            
            #premium-terminal-layout .time-display {
              background: transparent !important;
              border: none !important;
              padding: 8px 0 !important;
              min-height: auto !important;
              min-width: 96px !important;
              display: flex !important;
              align-items: center !important;
              justify-content: flex-end !important;
              color: ${HMI_DESIGN_TOKENS.TEXT_PRIMARY} !important;
              flex-shrink: 0 !important;
              box-shadow: none !important;
            }
            #premium-terminal-layout .time-display-text {
              display: flex !important;
              flex-direction: column !important;
              align-items: flex-end !important;
              line-height: 1.3 !important;
            }
            #premium-terminal-layout .time-display-text {
              min-width: 96px !important;
              text-align: right !important;
            }
            #premium-terminal-layout .time-display-time {
              font-family: ${HMI_DESIGN_TOKENS.FONT_FAMILY} !important;
              font-size: 22px !important;
              font-weight: 600 !important;
              font-variant-numeric: tabular-nums !important;
              letter-spacing: 0.08em !important;
              color: ${HMI_DESIGN_TOKENS.TEXT_PRIMARY} !important;
            }
            #premium-terminal-layout .time-display-date {
              font-size: 12px !important;
              font-variant-numeric: tabular-nums !important;
              color: ${HMI_DESIGN_TOKENS.TEXT_TERTIARY} !important;
              margin-top: 2px !important;
            }
            
            @media (max-width: 1200px) {
              #premium-terminal-layout .adaptive-tag span { display: none; }
              #premium-terminal-layout .hidden-mobile { display: none; }
            }

            @media (max-width: 1400px) {
              #premium-terminal-layout .hidden-tablet { display: none; }
            }
            
          `}</style>
        </Header>

        {/* 内容区域：适配父容器剩余高度，flex 子项填满 */}
        <Content style={{ 
          padding: '24px 24px 24px 24px', 
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}>
          {children}
        </Content>
      </Layout>
    </ConfigProvider>
  );

  if (isTerminalFullscreen) {
    return createPortal(
      <div ref={fullscreenWrapRef} className="premium-terminal-fullscreen-wrap" style={fullscreenWrapStyle}>
        {terminalContent}
      </div>,
      document.body
    );
  }

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {terminalContent}
    </div>
  );
};

export default PremiumTerminalTemplate;
