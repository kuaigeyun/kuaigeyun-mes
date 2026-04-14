import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Typography, Button, Modal, Input, Tooltip, Progress, theme, message } from 'antd';
import {
  FullscreenOutlined,
  FullscreenExitOutlined,
  LineChartOutlined,
  PieChartOutlined,
  BarChartOutlined,
  SettingOutlined,
  ToolOutlined,
  ShoppingOutlined,
  InboxOutlined,
  ContainerOutlined,
} from '@ant-design/icons';
import { Area, DualAxes, Line, Pie, Radar } from '@ant-design/charts';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { businessBoardChartTheme, accent } from './chartTheme';
import {
  kpiItems,
  unitOutputData,
  planExecutionLineData,
  deviceStatusMixData,
  equipmentUtilTrendData,
  operationsFeed,
  salesShipTrendData,
  procurementInboundData,
  warehouseQcBarData,
} from './mockData';
import { EventFeed } from './components/EventFeed';
import { SciFiPanelFrame } from './components/SciFiPanelFrame';
import { OrbitalKpiField } from './components/OrbitalKpiField';
import { SciFiTitleBackground } from '../../../../components/SciFiTitleBackground/SciFiTitleBackground';
import { useSiteLogoUrl } from '../../../../hooks/useSiteLogoUrl';
import { getBusinessBoardTitle, putBusinessBoardTitle } from '../../../../services/businessBoardTitle';
import { useConfigStore } from '../../../../stores/configStore';

const { Text, Title } = Typography;

const BUSINESS_BOARD_TITLE_STORAGE_KEY = 'riveredge.businessBoard.customTitle';

const clockFont =
  '"JetBrains Mono", "SF Mono", "Cascadia Code", Consolas, "Liberation Mono", ui-monospace, monospace';

/** 区块标题：字号略大，与圆形图标按钮搭配 */
const titleSm: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#bae6fd',
  letterSpacing: 0.35,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 4,
  flexShrink: 0,
  lineHeight: 1.35,
};

const sectionTitleIconBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: '#e0f2fe',
  fontSize: 16,
  background: 'linear-gradient(155deg, rgba(56, 189, 248, 0.32) 0%, rgba(15, 23, 42, 0.78) 100%)',
  border: '1px solid rgba(148, 163, 184, 0.45)',
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.16)',
};

const SectionTitleIconBtn: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={sectionTitleIconBtn}>{children}</span>
);

/** 勿用 height:100%：flex 父级未给明确定义高度时百分比常为 0，G2 autoFit 会得到空画布 */
const chartHost: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  width: '100%',
  position: 'relative',
  overflow: 'hidden',
  boxSizing: 'border-box',
};

const CHART_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const boardPlot = {
  autoFit: true as const,
  appendPadding: 4,
};

const boardPlotRose = {
  autoFit: true as const,
  appendPadding: 4,
};

const BusinessBoardPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const siteLogoUrl = useSiteLogoUrl();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(dayjs().format('YYYY-MM-DD HH:mm:ss'));
  const containerRef = useRef<HTMLDivElement>(null);
  const [customBoardTitle, setCustomBoardTitle] = useState('');
  const [titleModalOpen, setTitleModalOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const defaultBoardTitle = t('dashboard.businessBoard.title');
  const displayBoardTitle = customBoardTitle || defaultBoardTitle;

  /** 浏览器标签与顶栏主标题一致（含租户保存的标题），避免菜单文案与顶栏不一致 */
  useEffect(() => {
    const site = useConfigStore.getState().getConfig('site_name', 'RiverEdge SaaS') as string;
    document.title = `${displayBoardTitle} - ${site}`;
  }, [displayBoardTitle]);

  /** 从后端加载租户级标题；无记录时尝试迁移浏览器旧版 localStorage 并写回数据库 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getBusinessBoardTitle();
        if (cancelled) return;
        const fromApi = (res?.title || '').trim();
        if (fromApi) {
          setCustomBoardTitle(fromApi);
          return;
        }
        let legacy = '';
        try {
          legacy = (localStorage.getItem(BUSINESS_BOARD_TITLE_STORAGE_KEY) || '').trim();
        } catch {
          legacy = '';
        }
        if (legacy) {
          setCustomBoardTitle(legacy);
          try {
            await putBusinessBoardTitle(legacy);
            localStorage.removeItem(BUSINESS_BOARD_TITLE_STORAGE_KEY);
          } catch {
            /* 迁移失败时仍保留本地展示 */
          }
        }
      } catch {
        try {
          const legacy = (localStorage.getItem(BUSINESS_BOARD_TITLE_STORAGE_KEY) || '').trim();
          if (legacy) setCustomBoardTitle(legacy);
        } catch {
          /* empty */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openTitleModal = useCallback(() => {
    setTitleDraft(customBoardTitle || defaultBoardTitle);
    setTitleModalOpen(true);
  }, [customBoardTitle, defaultBoardTitle]);

  const saveBoardTitle = useCallback(async () => {
    const next = titleDraft.trim();
    try {
      await putBusinessBoardTitle(next || null);
      setCustomBoardTitle(next);
      try {
        localStorage.removeItem(BUSINESS_BOARD_TITLE_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setTitleModalOpen(false);
    } catch (e: unknown) {
      message.error((e as Error)?.message || '保存失败，请稍后重试');
    }
  }, [titleDraft]);

  const resetBoardTitle = useCallback(async () => {
    try {
      await putBusinessBoardTitle(null);
      setCustomBoardTitle('');
      setTitleDraft(defaultBoardTitle);
      try {
        localStorage.removeItem(BUSINESS_BOARD_TITLE_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    } catch (e: unknown) {
      message.error((e as Error)?.message || '恢复默认失败，请稍后重试');
    }
  }, [defaultBoardTitle]);

  const planExecutionLineI18n = useMemo(
    () =>
      planExecutionLineData.map((d) => ({
        day: t(`dashboard.businessBoard.chartDay.${CHART_DAY_KEYS[d.dayIdx]}`),
        rate: d.rate,
      })),
    [t]
  );

  const equipmentOeeLine = useMemo(
    () =>
      equipmentUtilTrendData.map((d) => ({
        day: t(`dashboard.businessBoard.chartDay.${CHART_DAY_KEYS[d.dayIdx]}`),
        oee: d.oee,
      })),
    [t]
  );

  const equipmentDowntimeLine = useMemo(
    () =>
      equipmentUtilTrendData.map((d) => ({
        day: t(`dashboard.businessBoard.chartDay.${CHART_DAY_KEYS[d.dayIdx]}`),
        downtimeMin: d.downtimeMin,
      })),
    [t]
  );

  const deviceStatusGauges = useMemo(() => {
    const total = deviceStatusMixData.reduce((acc, d) => acc + d.value, 0) || 1;
    const running = deviceStatusMixData.find((d) => d.typeKey === 'running')?.value || 0;
    const idle = deviceStatusMixData.find((d) => d.typeKey === 'idle')?.value || 0;
    const abnormal =
      (deviceStatusMixData.find((d) => d.typeKey === 'fault')?.value || 0) +
      (deviceStatusMixData.find((d) => d.typeKey === 'maintenance')?.value || 0);

    return [
      { label: t('dashboard.businessBoard.deviceStatus.running'), percent: running / total, value: running, color: accent.emerald },
      { label: t('dashboard.businessBoard.deviceStatus.idle'), percent: idle / total, value: idle, color: accent.amber },
      { label: t('dashboard.businessBoard.deviceStatus.fault'), percent: abnormal / total, value: abnormal, color: accent.rose },
    ];
  }, [t]);

  const salesShipLong = useMemo(
    () =>
      salesShipTrendData.flatMap((d) => {
        const day = t(`dashboard.businessBoard.chartDay.${CHART_DAY_KEYS[d.dayIdx]}`);
        return [
          { day, metric: t('dashboard.businessBoard.metric.orders'), value: d.orders },
          { day, metric: t('dashboard.businessBoard.metric.shipments'), value: d.shipments },
        ];
      }),
    [t]
  );

  const procurementInboundI18n = useMemo(
    () =>
      procurementInboundData.map((d) => ({
        day: t(`dashboard.businessBoard.chartDay.${CHART_DAY_KEYS[d.dayIdx]}`),
        batches: d.batches,
      })),
    [t]
  );

  const warehouseQcBarI18n = useMemo(
    () =>
      warehouseQcBarData.map((d) => ({
        stage: t(`dashboard.businessBoard.warehouseQc.${d.stageKey}`),
        qty: d.qty,
      })),
    [t]
  );

  /** 产线：分组柱「计划 vs 实际」 */
  const productionPlanActual = useMemo(
    () =>
      unitOutputData.flatMap((d) => [
        {
          name: d.name,
          series: t('dashboard.businessBoard.metric.planShort'),
          value: d.target,
        },
        {
          name: d.name,
          series: t('dashboard.businessBoard.metric.actualShort'),
          value: d.actual,
        },
      ]),
    [t]
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(dayjs().format('YYYY-MM-DD HH:mm:ss')), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#020617',
        backgroundImage: `
          linear-gradient(rgba(56, 189, 248, 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(56, 189, 248, 0.035) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        boxSizing: 'border-box',
        position: 'relative',
        borderRadius: isFullscreen ? 0 : token.borderRadiusLG || token.borderRadius,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 70% 45% at 50% -15%, rgba(56, 189, 248, 0.1), transparent)',
          pointerEvents: 'none',
        }}
      />

      <header
        style={{
          position: 'relative',
          zIndex: 10,
          flexShrink: 0,
          overflow: 'hidden',
          borderBottom: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        >
          <SciFiTitleBackground />
        </div>
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px 10px',
          }}
        >
        <div style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <img
            src={siteLogoUrl}
            alt=""
            style={{ height: 36, maxWidth: 160, width: 'auto', objectFit: 'contain', display: 'block' }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/img/logo.png';
            }}
          />
        </div>
        <div
          style={{
            justifySelf: 'center',
            textAlign: 'center',
            minWidth: 0,
            maxWidth: 'min(52vw, 480px)',
          }}
        >
          <Title
            level={4}
            style={{
              color: '#f8fafc',
              margin: 0,
              fontWeight: 700,
              fontSize: 32,
              lineHeight: 1.25,
              letterSpacing: 0.3,
            }}
            ellipsis
          >
            {displayBoardTitle}
          </Title>
          <Text style={{ color: '#94a3b8', fontSize: 12, display: 'block', marginTop: 2 }} ellipsis>
            {t('dashboard.businessBoard.subtitle')}
          </Text>
        </div>
        <div
          style={{
            justifySelf: 'end',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexShrink: 0,
          }}
        >
          <time
            dateTime={currentTime}
            style={{
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 500,
              fontFamily: clockFont,
              letterSpacing: 0.5,
              whiteSpace: 'nowrap',
            }}
          >
            {currentTime}
          </time>
          <Tooltip title={t('dashboard.businessBoard.customizeTitle')}>
            <Button
              type="text"
              icon={<SettingOutlined style={{ fontSize: 18 }} />}
              onClick={openTitleModal}
              style={{ color: '#e2e8f0' }}
              aria-label={t('dashboard.businessBoard.customizeTitle')}
            />
          </Tooltip>
          <Tooltip title={isFullscreen ? t('dashboard.businessBoard.exitFullscreen') : t('dashboard.businessBoard.fullscreen')}>
            <Button
              type="text"
              icon={isFullscreen ? <FullscreenExitOutlined style={{ fontSize: 18 }} /> : <FullscreenOutlined style={{ fontSize: 18 }} />}
              onClick={toggleFullscreen}
              style={{ color: accent.cyan }}
              aria-label={isFullscreen ? t('dashboard.businessBoard.exitFullscreen') : t('dashboard.businessBoard.fullscreen')}
            />
          </Tooltip>
        </div>
        </div>
      </header>

      <Modal
        title={t('dashboard.businessBoard.titleSettingsModal')}
        open={titleModalOpen}
        onOk={saveBoardTitle}
        onCancel={() => setTitleModalOpen(false)}
        okText={t('dashboard.businessBoard.saveTitle')}
        cancelText={t('common.cancel')}
        destroyOnHidden
      >
        <Input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          placeholder={t('dashboard.businessBoard.titleInputPlaceholder')}
          maxLength={80}
          showCount
          onPressEnter={saveBoardTitle}
        />
        <Button type="link" size="small" onClick={resetBoardTitle} style={{ paddingLeft: 0, marginTop: 8 }}>
          {t('dashboard.businessBoard.resetTitle')}
        </Button>
      </Modal>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          gap: 8,
          padding: '14px 10px 10px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            flex: '3 1 0',
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <SciFiPanelFrame rimConverge="sw" style={{ flex: '1 1 0', minHeight: 158 }}>
            <div style={titleSm}>
              <SectionTitleIconBtn>
                <ShoppingOutlined />
              </SectionTitleIconBtn>
              {t('dashboard.businessBoard.section.salesShipTrend')}
            </div>
            <div style={{ ...chartHost, minHeight: 118 }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center' }}>
                <div style={{ height: '100%', width: '100%', maxWidth: '480px', aspectRatio: '2' }}>
                  <Line
                    {...boardPlot}
                    padding="auto"
                    style={{ width: '100%', height: '100%' }}
                    data={salesShipLong}
                    xField="day"
                    yField="value"
                    seriesField="metric"
                    colorField="metric"
                    shapeField="smooth"
                    theme={businessBoardChartTheme}
                    color={[accent.cyan, accent.emerald]}
                    line={{ size: 2 }}
                    point={{ size: 3, shapeField: 'circle' }}
                    axis={{ x: { labelFill: '#cbd5e1', labelFontSize: 10, lineStroke: 'rgba(255,255,255,0.15)' }, y: { labelFill: '#cbd5e1', labelFontSize: 10, gridStroke: 'rgba(255,255,255,0.06)' } }}
                    legend={{ position: 'top', itemName: { style: { fill: '#cbd5e1', fontSize: 11 } }, color: { position: 'top', itemLabelFill: '#cbd5e1', itemLabelFontSize: 11 } } as any}
                    label={{ text: 'value', position: 'top', style: { fill: '#f8fafc', fontSize: 10, fontWeight: 500 }, dy: -8 }}
                  />
                </div>
              </div>
            </div>
          </SciFiPanelFrame>

          <SciFiPanelFrame rimConverge="sw" style={{ flex: '1 1 0', minHeight: 158 }}>
            <div style={titleSm}>
              <SectionTitleIconBtn>
                <InboxOutlined />
              </SectionTitleIconBtn>
              {t('dashboard.businessBoard.section.procurementInbound')}
            </div>
            <div style={{ ...chartHost, minHeight: 118 }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center' }}>
                <div style={{ height: '100%', width: '100%', maxWidth: '480px', aspectRatio: '2' }}>
                  <Area
                    {...boardPlot}
                    style={{ width: '100%', height: '100%', fill: `linear-gradient(-90deg, transparent 0%, ${accent.violet} 100%)`, fillOpacity: 0.35, stroke: accent.violet, lineWidth: 2 }}
                    data={procurementInboundI18n}
                    xField="day"
                    yField="batches"
                    shapeField="smooth"
                    theme={businessBoardChartTheme}
                    line={{ size: 2 }}
                    point={{ size: 4, fill: accent.violet }}
                    axis={{ x: { labelFill: '#cbd5e1', labelFontSize: 10 }, y: { labelFill: '#cbd5e1', labelFontSize: 10, gridStroke: 'rgba(255,255,255,0.06)' } }}
                    label={{ text: (d: any) => `${d.batches} 批`, position: 'top', style: { fill: '#f8fafc', fontSize: 10, fontWeight: 500 }, dy: -8 }}
                  />
                </div>
              </div>
            </div>
          </SciFiPanelFrame>

          <SciFiPanelFrame rimConverge="sw" style={{ flex: '1 1 0', minHeight: 158 }}>
            <div style={titleSm}>
              <SectionTitleIconBtn>
                <ContainerOutlined />
              </SectionTitleIconBtn>
              {t('dashboard.businessBoard.section.warehouseQcBoard')}
            </div>
            <div style={{ ...chartHost, minHeight: 118 }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center' }}>
                <div style={{ height: '100%', width: '100%', maxWidth: '360px', aspectRatio: '1.5' }}>
                  <Pie
                    {...boardPlotRose}
                    padding="auto"
                    style={{ width: '100%', height: '100%' }}
                    data={warehouseQcBarI18n}
                    angleField="qty"
                    colorField="stage"
                    innerRadius={0.62}
                    radius={0.87}
                    theme={businessBoardChartTheme}
                    color={[accent.amber, accent.emerald, accent.violet, accent.cyan, accent.rose, accent.slate]}
                    label={{ text: 'qty', style: { fill: '#f8fafc', fontSize: 11, fontWeight: 'bold' } }}
                    legend={{ position: 'right', offsetX: -10, layout: 'vertical', itemSpacing: 6, itemName: { style: { fill: '#cbd5e1', fontSize: 10 } }, color: { position: 'right', itemLabelFill: '#cbd5e1', itemLabelFontSize: 11 } } as any}
                  />
                </div>
              </div>
            </div>
          </SciFiPanelFrame>
        </div>

        <div
          style={{
            flex: '4 1 0',
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            overflow: 'visible',
          }}
        >
          <div
            style={{
              flex: '2 1 0',
              minHeight: 316,
              minWidth: 0,
              position: 'relative',
              overflow: 'visible',
              boxSizing: 'border-box',
              paddingTop: 'clamp(10px, 2vh, 22px)',
              paddingBottom: 'clamp(18px, 3.5vh, 36px)',
              marginBottom: 8,
            }}
          >
            <OrbitalKpiField kpiItems={kpiItems} t={t} isFullscreen={isFullscreen} />
          </div>

          {/*
            中列下部：固定 1 行 2 列（勿改回 2×2）
          */}
          <div
            style={{
              flex: '1 1 0',
              minHeight: 158,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
            }}
          >
            <SciFiPanelFrame rimConverge="sw" style={{ minHeight: 158, minWidth: 0 }}>
              <div style={titleSm}>
                <SectionTitleIconBtn>
                  <BarChartOutlined />
                </SectionTitleIconBtn>
                {t('dashboard.businessBoard.section.productionOutput')}
              </div>
              <div style={{ ...chartHost, minHeight: 132 }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center' }}>
                  <div style={{ height: '100%', width: '100%', maxWidth: '400px', aspectRatio: '1.5' }}>
                    <Radar
                      {...boardPlotRose}
                      padding="auto"
                      style={{ width: '100%', height: '100%' }}
                      data={productionPlanActual}
                      xField="name"
                      yField="value"
                      seriesField="series"
                      colorField="series"
                      theme={businessBoardChartTheme}
                      color={[accent.slate, accent.cyan]}
                      area={{ style: { fillOpacity: 0.15 } }}
                      line={{ style: { lineWidth: 2 } }}
                      point={{ size: 3, shapeField: 'circle' }}
                      axis={{
                        x: { labelFill: '#cbd5e1', labelFontSize: 10, gridStroke: 'rgba(255,255,255,0.1)' },
                        y: { label: false, gridStroke: 'rgba(255,255,255,0.1)' }
                      }}
                      legend={{ position: 'top', layout: 'horizontal', itemName: { style: { fill: '#cbd5e1', fontSize: 11 } }, color: { position: 'top', itemLabelFill: '#cbd5e1', itemLabelFontSize: 11 } } as any}
                    />
                  </div>
                </div>
              </div>
            </SciFiPanelFrame>
            <SciFiPanelFrame rimConverge="se" style={{ minHeight: 158, minWidth: 0 }}>
              <div style={titleSm}>
                <SectionTitleIconBtn>
                  <LineChartOutlined />
                </SectionTitleIconBtn>
                {t('dashboard.businessBoard.section.planExecution')}
              </div>
              <div style={{ ...chartHost, minHeight: 132 }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center' }}>
                  <div style={{ height: '100%', width: '100%', maxWidth: '480px', aspectRatio: '2' }}>
                    <Area
                      {...boardPlot}
                      padding="auto"
                      style={{ width: '100%', height: '100%', fill: `linear-gradient(-90deg, transparent 0%, ${accent.emerald} 100%)`, fillOpacity: 0.22, stroke: accent.emerald, lineWidth: 2 }}
                    data={planExecutionLineI18n}
                    xField="day"
                    yField="rate"
                    shapeField="smooth"
                    theme={businessBoardChartTheme}
                    line={{ size: 2 }}
                    point={{ size: 3, fill: accent.emerald }}
                    axis={{ x: { labelFill: '#cbd5e1', labelFontSize: 10 }, y: { labelFormatter: (v: string) => `${v}%`, labelFill: '#cbd5e1', labelFontSize: 10, gridStroke: 'rgba(255,255,255,0.06)' } }}
                      label={{ text: (d: any) => `${d.rate}%`, position: 'top', style: { fill: '#f8fafc', fontSize: 10, fontWeight: 500 }, dy: -8 }}
                      legend={false}
                    />
                  </div>
                </div>
              </div>
            </SciFiPanelFrame>
          </div>
        </div>

        <div
          style={{
            flex: '3 1 0',
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <SciFiPanelFrame rimConverge="se" style={{ flex: '1 1 0', minHeight: 158 }}>
            <div style={titleSm}>
              <SectionTitleIconBtn>
                <PieChartOutlined />
              </SectionTitleIconBtn>
              {t('dashboard.businessBoard.section.deviceStatusMix')}
            </div>
            <div style={{ ...chartHost, minHeight: 140, display: 'flex' }}>
              <div style={{ display: 'flex', gap: 12, height: '100%', width: '100%', alignItems: 'center', justifyContent: 'center', padding: '12px 6px' }}>
                {deviceStatusGauges.map((g: any, idx: number) => (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
                    <Progress
                      type="dashboard"
                      percent={Math.round(g.percent * 100)}
                      size={isFullscreen ? 115 : 95}
                      strokeColor={{
                        '0%': g.color,
                        '100%': g.color + 'dd',
                      }}
                      railColor="rgba(255,255,255,0.06)"
                      format={(p) => (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          <span style={{ color: g.color, fontSize: isFullscreen ? 17 : 14, fontWeight: 800 }}>{p}%</span>
                          <span style={{ color: '#94a3b8', fontSize: isFullscreen ? 11 : 9, marginTop: -2 }}>{g.value} 台</span>
                        </div>
                      )}
                      gapDegree={70}
                      strokeWidth={10}
                    />
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', marginTop: -14 }}>{g.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </SciFiPanelFrame>

          <SciFiPanelFrame rimConverge="se" style={{ flex: '1 1 0', minHeight: 158 }}>
            <div style={titleSm}>
              <SectionTitleIconBtn>
                <LineChartOutlined />
              </SectionTitleIconBtn>
              {t('dashboard.businessBoard.section.equipmentUtilTrend')}
            </div>
            <div style={{ fontSize: 9, color: '#64748b', marginBottom: 2, flexShrink: 0 }}>
              <span style={{ color: accent.cyan }}>●</span> {t('dashboard.businessBoard.metric.oee')}{' '}
              <span style={{ color: accent.amber, marginLeft: 8 }}>■</span> {t('dashboard.businessBoard.metric.downtimeMin')}
            </div>
            <div style={{ ...chartHost, minHeight: 118 }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center' }}>
                <div style={{ height: '100%', width: '100%', maxWidth: '480px', aspectRatio: '2' }}>
                  <DualAxes
                    {...boardPlot}
                    padding="auto"
                    style={{ width: '100%', height: '100%' }}
                  xField="day"
                  theme={businessBoardChartTheme}
                  children={[
                    {
                      type: 'line',
                      data: equipmentOeeLine,
                      xField: 'day',
                      yField: 'oee',
                      shape: 'smooth',
                      style: { stroke: accent.cyan, lineWidth: 2 },
                      axis: { y: { labelFormatter: (v: string) => `${String(v)}%`, labelFill: '#cbd5e1', labelFontSize: 10, gridStroke: 'rgba(255,255,255,0.06)' } as any },
                      label: { text: (d: any) => `${d.oee}%`, style: { fill: accent.cyan, fontSize: 10, fontWeight: 500 }, dy: -8 } as any,
                    },
                    {
                      type: 'line',
                      data: equipmentDowntimeLine,
                      xField: 'day',
                      yField: 'downtimeMin',
                      shape: 'smooth',
                      style: { stroke: accent.amber, lineWidth: 2, lineDash: [4, 4] },
                      axis: {
                        y: {
                          position: 'right' as const,
                          labelFormatter: (v: string) => `${String(v)}m`,
                          labelFill: '#cbd5e1',
                          labelFontSize: 10,
                        } as any,
                      },
                      label: { text: (d: any) => `${d.downtimeMin}m`, style: { fill: accent.amber, fontSize: 10, fontWeight: 500 }, dy: 10 } as any,
                    },
                  ]}
                />
               </div>
              </div>
            </div>
          </SciFiPanelFrame>

          <SciFiPanelFrame rimConverge="se" style={{ flex: '1 1 0', minHeight: 158 }}>
            <div style={titleSm}>
              <SectionTitleIconBtn>
                <ToolOutlined />
              </SectionTitleIconBtn>
              {t('dashboard.businessBoard.section.equipmentEventStream')}
            </div>
            <EventFeed items={operationsFeed} t={t} />
          </SciFiPanelFrame>
        </div>
      </div>
    </div>
  );
};

export default BusinessBoardPage;
