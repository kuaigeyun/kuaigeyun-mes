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
import { Layout, Button, Typography, Divider, theme, ConfigProvider } from 'antd';
import { FullscreenOutlined, FullscreenExitOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import Lottie from 'lottie-react';
import circleAnimation from '../../../static/lottie/circle.json';
import { HMI_DESIGN_TOKENS } from './constants';

const { Header, Content } = Layout;
const { Title } = Typography; // 移除 Text，因为它未被使用

export interface PremiumTerminalTemplateProps {
  /** 标题 */
  title?: string;
  /** 员工别名 */
  operatorName?: string;
  /** 员工头像 URL（可选） */
  operatorAvatar?: string;
  /** 员工角色（可选） */
  operatorRole?: string;
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
  title,
  operatorName = '未登录',
  operatorAvatar,
  operatorRole,
  stationName = '未绑定',
  stationArea,
  stationWorkshop,
  stationLine,
  deviceName = '未连接',
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
          colorPrimary: HMI_DESIGN_TOKENS.STATUS_INFO,
          borderRadius: 8,
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
            background: linear-gradient(135deg, #001a33 0%, #001529 50%, #000d1a 100%) !important;
            color: #ffffff !important;
          }
          #premium-terminal-layout .ant-layout-header .ant-typography,
          #premium-terminal-layout .ant-layout-header .ant-btn {
            color: #ffffff !important;
          }
          #premium-terminal-layout .ant-layout-header .ant-btn-primary {
            color: #ffffff !important;
            background-color: ${HMI_DESIGN_TOKENS.STATUS_INFO} !important;
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
          backgroundColor: '#001529',
          background: 'linear-gradient(180deg, #001529 0%, #000c17 100%)',
          borderBottom: `1px solid ${HMI_DESIGN_TOKENS.BORDER}`,
          boxShadow: HMI_DESIGN_TOKENS.CARD_SHADOW,
          padding: '0 16px',
          height: 64,
          minHeight: 64,
          display: 'flex',
          alignItems: 'center',
          zIndex: 100,
          color: HMI_DESIGN_TOKENS.TEXT_PRIMARY,
          overflowX: 'auto',
          overflowY: 'hidden',
          flexShrink: 0,
        }}>
          {/* 左侧区域：标题(液态玻璃，左贴边) / 工位信息(一行) / 员工信息 */}
          <div className="header-left-block">
            <div className="header-title-row">
              <div className="header-title-bordered">
                <span className="header-title-left-accent" aria-hidden />
                <span className="header-title-lottie" aria-hidden>
                  <Lottie animationData={circleAnimation as object} loop style={{ width: 48, height: 48 }} />
                </span>
                <Title level={4} className="header-title-text">{title || '生产终端'}</Title>
              </div>
            </div>
            <div className="header-station-block">
              <span className="header-station-label">工位信息</span>
              <span className="header-station-content">
                {[stationArea, stationWorkshop, stationLine, stationName].filter(Boolean).length > 0
                  ? [stationArea, stationWorkshop, stationLine, stationName].filter(Boolean).map((item, i) => (
                      <span key={i} className="header-station-item">{item}</span>
                    ))
                  : <span className="header-station-item">未绑定</span>}
              </span>
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
                <span className="header-operator-name">{operatorName}</span>
                {operatorRole && <span className="header-operator-role">{operatorRole}</span>}
              </div>
            </div>
          </div>

          {/* 中间自适应占位 */}
          <div style={{ flex: 1, minWidth: 20 }} />

          {/* 右侧区域：先 extra 再分隔再全屏+时间，避免堆叠 */}
          <div className="header-right-group">
            <div className="header-extra-container">
              {headerExtra}
            </div>
            <div className="header-controls">
              <div className="time-display">
                <div className="time-display-text">
                  <span className="time-display-time">{time.split(' ')[1]}</span>
                  <span className="time-display-date">{time.split(' ')[0]}</span>
                </div>
              </div>
              <Button 
                type="primary"
                shape="circle"
                icon={isTerminalFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} 
                onClick={toggleTerminalFullscreen}
                className="fullscreen-btn"
              />
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
              gap: 20px !important;
              flex-shrink: 0 !important;
              min-width: 0 !important;
            }
            #premium-terminal-layout .header-extra-container {
              display: flex !important;
              align-items: center !important;
              gap: 20px !important;
              flex-shrink: 0 !important;
              min-width: 0 !important;
              overflow: visible !important;
            }
            #premium-terminal-layout .header-extra-container > * {
              display: flex !important;
              align-items: center !important;
              gap: 12px !important;
              flex-shrink: 0 !important;
            }
            /* 液态玻璃：刷新 / 切换工位 */
            #premium-terminal-layout .header-extra-container .ant-btn {
              flex-shrink: 0 !important;
              white-space: nowrap !important;
              width: auto !important;
              min-width: auto !important;
              margin: 0 !important;
              position: relative !important;
              box-sizing: border-box !important;
              border-radius: 14px !important;
              min-height: ${HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE}px !important;
              padding: 0 22px !important;
              backdrop-filter: blur(16px) saturate(1.2) !important;
              -webkit-backdrop-filter: blur(16px) saturate(1.2) !important;
              border: 1px solid rgba(255,255,255,0.2) !important;
              box-shadow: 
                0 1px 0 rgba(255,255,255,0.35) inset,
                0 1px 2px rgba(0,0,0,0.08),
                0 8px 24px rgba(0,0,0,0.18) !important;
              transition: box-shadow 0.25s ease, border-color 0.2s ease, transform 0.15s ease !important;
            }
            #premium-terminal-layout .header-extra-container .ant-btn:hover {
              border-color: rgba(255,255,255,0.28) !important;
              box-shadow: 
                0 1px 0 rgba(255,255,255,0.4) inset,
                0 2px 4px rgba(0,0,0,0.1),
                0 12px 32px rgba(0,0,0,0.22) !important;
            }
            #premium-terminal-layout .header-extra-container .ant-btn:active {
              transform: translateY(1px) !important;
              box-shadow: 
                0 0 0 1px rgba(0,0,0,0.1) inset,
                0 1px 0 rgba(255,255,255,0.2) inset,
                0 4px 12px rgba(0,0,0,0.2) !important;
            }
            #premium-terminal-layout .header-extra-container .ant-btn + .ant-btn {
              margin-left: 12px !important;
            }
            #premium-terminal-layout .header-extra-buttons {
              gap: 12px !important;
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
              gap: 20px !important;
              flex-shrink: 0 !important;
            }

            #premium-terminal-layout .fullscreen-btn {
              border-radius: 50% !important;
              background: linear-gradient(135deg, #ff6b35 0%, #f7931e 50%, #e65100 100%) !important;
              border: 1px solid rgba(0,0,0,0.2) !important;
              width: ${HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE}px !important;
              height: ${HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE}px !important;
              min-width: ${HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE}px !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              cursor: pointer !important;
              transition: box-shadow 0.2s, transform 0.1s !important;
              box-shadow: 0 1px 0 rgba(255,255,255,0.25) inset, 0 3px 8px rgba(230,81,0,0.35) !important;
              flex-shrink: 0 !important;
            }
            #premium-terminal-layout .fullscreen-btn:hover {
              box-shadow: 0 1px 0 rgba(255,255,255,0.35) inset, 0 4px 12px rgba(230,81,0,0.4) !important;
            }
            #premium-terminal-layout .fullscreen-btn:active {
              box-shadow: 0 2px 4px rgba(0,0,0,0.3) inset !important;
              transform: translateY(1px);
            }
            
            #premium-terminal-layout .header-left-block {
              display: flex !important;
              align-items: center !important;
              flex-shrink: 0 !important;
              gap: 0 !important;
              min-width: 640px !important;
            }
            #premium-terminal-layout .header-title-row {
              display: inline-flex !important;
              align-items: stretch !important;
              margin-left: -16px !important;
            }
            #premium-terminal-layout .header-title-bordered {
              position: relative !important;
              display: inline-flex !important;
              align-items: center !important;
              gap: 0 !important;
              justify-content: center !important;
              padding: 0 32px 0 28px !important;
              min-height: 62px !important;
              margin-top:-4px !important;
              box-sizing: border-box !important;
              border-radius: 0 0 24px 0 !important;
              backdrop-filter: blur(16px) saturate(1.2) !important;
              -webkit-backdrop-filter: blur(16px) saturate(1.2) !important;
              background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.02) 100%) !important;
              border: 1px solid rgba(255,255,255,0.2) !important;
              border-left: none !important;
              box-shadow: 
                0 1px 0 rgba(255,255,255,0.35) inset,
                2px 2px 0 rgba(255,255,255,0.08),
                4px 4px 12px rgba(0,0,0,0.12),
                4px 0 20px rgba(0,0,0,0.08) !important;
            }
            #premium-terminal-layout .header-title-left-accent {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              bottom: 0 !important;
              width: 5px !important;
              background: linear-gradient(180deg, ${HMI_DESIGN_TOKENS.STATUS_INFO} 0%, rgba(22,119,255,0.75) 100%) !important;
              border-radius: 0 0 0 0 !important;
              flex-shrink: 0 !important;
            }
            #premium-terminal-layout .header-title-lottie {
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              margin-right: 12px !important;
              flex-shrink: 0 !important;
              line-height: 1 !important;
            }
            #premium-terminal-layout .header-title-lottie svg {
              vertical-align: middle !important;
            }
            #premium-terminal-layout .header-title-text {
              margin: 0 !important;
              color: ${HMI_DESIGN_TOKENS.TEXT_PRIMARY} !important;
              font-size: clamp(${HMI_DESIGN_TOKENS.FONT_TITLE_MIN}px, 1.5vw, 22px) !important;
              font-weight: 600 !important;
              white-space: nowrap !important;
              line-height: 1.2 !important;
            }
            #premium-terminal-layout .header-divider-v {
              border-color: ${HMI_DESIGN_TOKENS.BORDER} !important;
              height: 28px !important;
              margin: 0 12px !important;
            }
            #premium-terminal-layout .header-station-block {
              display: flex !important;
              flex-direction: row !important;
              align-items: center !important;
              justify-content: flex-start !important;
              gap: 10px !important;
              min-width: 0 !important;
              margin-left: 14px !important;
            }
            #premium-terminal-layout .header-station-label {
              font-size: 14px !important;
              font-weight: 600 !important;
              color: ${HMI_DESIGN_TOKENS.TEXT_TERTIARY} !important;
              flex-shrink: 0 !important;
            }
            #premium-terminal-layout .header-station-content {
              display: inline-flex !important;
              align-items: center !important;
              flex-wrap: nowrap !important;
              gap: 0 !important;
              min-width: 0 !important;
              font-size: 17px !important;
              font-weight: 500 !important;
              color: ${HMI_DESIGN_TOKENS.TEXT_PRIMARY} !important;
              line-height: 1.35 !important;
            }
            #premium-terminal-layout .header-station-content .header-station-item {
              white-space: nowrap !important;
            }
            #premium-terminal-layout .header-station-content .header-station-item + .header-station-item::before {
              content: ' · ' !important;
              margin: 0 4px !important;
              color: ${HMI_DESIGN_TOKENS.TEXT_TERTIARY} !important;
              font-weight: 400 !important;
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
              gap: 0 !important;
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
            
            #premium-terminal-layout .ant-layout-header .ant-btn:not(.fullscreen-btn) {
              min-height: ${HMI_DESIGN_TOKENS.TOUCH_MIN_SIZE}px !important;
              padding: 0 20px !important;
              color: #fff !important;
              font-size: ${HMI_DESIGN_TOKENS.FONT_BODY_MIN}px !important;
            }
            /* 液态玻璃 - 主按钮（刷新）：蓝调玻璃 */
            #premium-terminal-layout .header-extra-container .ant-btn-primary {
              background: linear-gradient(135deg, rgba(64,140,255,0.35) 0%, rgba(30,100,230,0.28) 50%, rgba(22,119,255,0.22) 100%) !important;
              border-color: rgba(255,255,255,0.25) !important;
              box-shadow: 
                0 1px 0 rgba(255,255,255,0.4) inset,
                0 0 0 1px rgba(22,119,255,0.2),
                0 1px 2px rgba(0,0,0,0.08),
                0 8px 24px rgba(22,119,255,0.15) !important;
            }
            #premium-terminal-layout .header-extra-container .ant-btn-primary:hover {
              background: linear-gradient(135deg, rgba(80,155,255,0.42) 0%, rgba(45,115,240,0.35) 50%, rgba(22,119,255,0.28) 100%) !important;
              box-shadow: 
                0 1px 0 rgba(255,255,255,0.45) inset,
                0 0 0 1px rgba(22,119,255,0.25),
                0 12px 32px rgba(22,119,255,0.2) !important;
            }
            /* 液态玻璃 - 次要按钮（切换工位）：中性玻璃 */
            #premium-terminal-layout .ant-layout-header .ant-btn-default:not(.fullscreen-btn) {
              background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.04) 100%) !important;
              border-color: rgba(255,255,255,0.2) !important;
            }
          `}</style>
        </Header>

        {/* 内容区域：适配父容器剩余高度，溢出可滚动 */}
        <Content style={{ 
          padding: '24px 24px 24px 24px', 
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
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
