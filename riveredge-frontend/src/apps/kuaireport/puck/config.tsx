import type { Config } from '@measured/puck';
import type { TFunction } from 'i18next';
import ChartWidget, { type ChartType } from '../components/widgets/ChartWidget';
import IndicatorWidget from '../components/widgets/IndicatorWidget';
import TextWidget from '../components/widgets/TextWidget';
import MediaWidget from '../components/widgets/MediaWidget';
import {
  AccentDecoration,
  BorderPanel,
  DEMO_CHART_DATA,
  PanelBackground,
  TitleBar,
  themeToCssVars,
} from '../materials';

export type DashboardPuckProps = {
  Chart: {
    chartType: ChartType;
    title: string;
    height: number;
  };
  Indicator: {
    indicatorType: 'number' | 'flop' | 'gauge' | 'water';
    title: string;
    value: number;
    unit: string;
    color: string;
  };
  TextBlock: {
    textType: 'title' | 'marquee';
    content: string;
    color: string;
  };
  MediaBlock: {
    mediaType: 'video' | 'clock' | 'table';
    url: string;
    height: number;
  };
  BorderPanel: {
    variant: 'corner' | 'double' | 'gradient' | 'titleEmbed';
    title: string;
    animate: 'on' | 'off';
    minHeight: number;
    content: any;
  };
  TitleBar: {
    variant: 'accentBar' | 'techLine' | 'badgeCenter';
    title: string;
    subtitle: string;
    animate: 'on' | 'off';
  };
  AccentDecoration: {
    variant: 'scanLine' | 'cornerMarks' | 'pulseBar';
    animate: 'on' | 'off';
  };
  GridRow: {
    columns: number;
    gap: number;
    minHeight: number;
    content: any;
  };
};

export type DashboardPuckConfig = Config<{
  components: DashboardPuckProps;
  root: {
    accent: string;
    backgroundVariant: 'radialGrid' | 'panelWash' | 'deepVoid';
  };
}>;

const tr = (t: TFunction, key: string, fallback: string) =>
  String(t(key, { defaultValue: fallback }));

/** 按当前语言生成 Puck 物料配置（分类 / 组件名 / 字段标签） */
export function createDashboardPuckConfig(t: TFunction): DashboardPuckConfig {
  const chartTypeOptions = [
    { label: tr(t, 'app.kuaireport.designer.option.line', '折线图'), value: 'line' },
    { label: tr(t, 'app.kuaireport.designer.option.column', '柱状图'), value: 'column' },
    { label: tr(t, 'app.kuaireport.designer.option.pie', '饼图'), value: 'pie' },
    { label: tr(t, 'app.kuaireport.designer.option.area', '面积图'), value: 'area' },
    { label: tr(t, 'app.kuaireport.designer.option.radar', '雷达图'), value: 'radar' },
    { label: tr(t, 'app.kuaireport.designer.option.scatter', '散点图'), value: 'scatter' },
    { label: tr(t, 'app.kuaireport.designer.option.gauge', '仪表盘'), value: 'gauge' },
    { label: tr(t, 'app.kuaireport.designer.option.liquid', '水波图'), value: 'liquid' },
    { label: tr(t, 'app.kuaireport.designer.option.dualAxes', '双轴图'), value: 'dualAxes' },
  ];

  const onOffOptions = [
    { label: tr(t, 'app.kuaireport.designer.option.on', '开'), value: 'on' },
    { label: tr(t, 'app.kuaireport.designer.option.off', '关'), value: 'off' },
  ];

  return {
    categories: {
      chart: {
        title: tr(t, 'app.kuaireport.designer.category.chart', '图表'),
        components: ['Chart'],
      },
      indicator: {
        title: tr(t, 'app.kuaireport.designer.category.indicator', '指标'),
        components: ['Indicator'],
      },
      decoration: {
        title: tr(t, 'app.kuaireport.designer.category.decoration', '装饰'),
        components: ['BorderPanel', 'TitleBar', 'AccentDecoration', 'GridRow'],
      },
      content: {
        title: tr(t, 'app.kuaireport.designer.category.content', '文本媒体'),
        components: ['TextBlock', 'MediaBlock'],
      },
    },
    root: {
      fields: {
        accent: { type: 'text', label: tr(t, 'app.kuaireport.designer.field.accent', '主题色') },
        backgroundVariant: {
          type: 'select',
          label: tr(t, 'app.kuaireport.designer.field.backgroundVariant', '背景样式'),
          options: [
            { label: tr(t, 'app.kuaireport.designer.option.radialGrid', '径向网格'), value: 'radialGrid' },
            { label: tr(t, 'app.kuaireport.designer.option.panelWash', '面板渐变'), value: 'panelWash' },
            { label: tr(t, 'app.kuaireport.designer.option.deepVoid', '深空'), value: 'deepVoid' },
          ],
        },
      },
      defaultProps: {
        accent: '#00d4ff',
        backgroundVariant: 'radialGrid',
      },
      render: ({ children, accent, backgroundVariant }) => (
        <PanelBackground
          variant={backgroundVariant || 'radialGrid'}
          style={{
            ...themeToCssVars({ accent: accent || '#00d4ff' }),
            minHeight: '100%',
            padding: 16,
            boxSizing: 'border-box',
          }}
        >
          {children}
        </PanelBackground>
      ),
    },
    components: {
      Chart: {
        label: tr(t, 'app.kuaireport.designer.comp.chart', '图表'),
        fields: {
          chartType: {
            type: 'select',
            label: tr(t, 'app.kuaireport.designer.field.chartType', '图表类型'),
            options: chartTypeOptions,
          },
          title: { type: 'text', label: tr(t, 'app.kuaireport.designer.field.title', '标题') },
          height: { type: 'number', label: tr(t, 'app.kuaireport.designer.field.height', '高度'), min: 120 },
        },
        defaultProps: {
          chartType: 'line',
          title: tr(t, 'app.kuaireport.designer.comp.chart', '图表'),
          height: 280,
        },
        render: ({ chartType, title, height }) => (
          <div style={{ width: '100%', height }}>
            {title ? (
              <div style={{ color: 'var(--kb-text-muted)', fontSize: 13, marginBottom: 8 }}>{title}</div>
            ) : null}
            <div style={{ width: '100%', height: title ? height - 28 : height }}>
              <ChartWidget type={chartType || 'line'} data={DEMO_CHART_DATA} />
            </div>
          </div>
        ),
      },
      Indicator: {
        label: tr(t, 'app.kuaireport.designer.comp.indicator', '数据指标'),
        fields: {
          indicatorType: {
            type: 'select',
            label: tr(t, 'app.kuaireport.designer.field.type', '类型'),
            options: [
              { label: tr(t, 'app.kuaireport.designer.option.number', '数字'), value: 'number' },
              { label: tr(t, 'app.kuaireport.designer.option.flop', '翻牌'), value: 'flop' },
              { label: tr(t, 'app.kuaireport.designer.option.gauge', '仪表'), value: 'gauge' },
              { label: tr(t, 'app.kuaireport.designer.option.water', '水位'), value: 'water' },
            ],
          },
          title: { type: 'text', label: tr(t, 'app.kuaireport.designer.field.title', '标题') },
          value: { type: 'number', label: tr(t, 'app.kuaireport.designer.field.value', '数值') },
          unit: { type: 'text', label: tr(t, 'app.kuaireport.designer.field.unit', '单位') },
          color: { type: 'text', label: tr(t, 'app.kuaireport.designer.field.color', '颜色') },
        },
        defaultProps: {
          indicatorType: 'number',
          title: tr(t, 'app.kuaireport.designer.category.indicator', '指标'),
          value: 8888,
          unit: '',
          color: '#00d4ff',
        },
        render: ({ indicatorType, title, value, unit, color }) => (
          <div style={{ width: '100%', height: 140 }}>
            <IndicatorWidget
              type={indicatorType || 'number'}
              title={title}
              value={Number(value) || 0}
              unit={unit}
              props={{ color }}
            />
          </div>
        ),
      },
      TextBlock: {
        label: tr(t, 'app.kuaireport.designer.comp.text', '文本'),
        fields: {
          textType: {
            type: 'select',
            label: tr(t, 'app.kuaireport.designer.field.type', '类型'),
            options: [
              { label: tr(t, 'app.kuaireport.designer.option.titleText', '标题'), value: 'title' },
              { label: tr(t, 'app.kuaireport.designer.option.marquee', '跑马灯'), value: 'marquee' },
            ],
          },
          content: { type: 'textarea', label: tr(t, 'app.kuaireport.designer.field.content', '内容') },
          color: { type: 'text', label: tr(t, 'app.kuaireport.designer.field.color', '颜色') },
        },
        defaultProps: {
          textType: 'title',
          content: tr(t, 'app.kuaireport.designer.default.textContent', '文本内容'),
          color: '#ffffff',
        },
        render: ({ textType, content, color }) => (
          <TextWidget type={textType || 'title'} content={content || ''} props={{ color }} />
        ),
      },
      MediaBlock: {
        label: tr(t, 'app.kuaireport.designer.comp.media', '媒体/表格'),
        fields: {
          mediaType: {
            type: 'select',
            label: tr(t, 'app.kuaireport.designer.field.type', '类型'),
            options: [
              { label: tr(t, 'app.kuaireport.designer.option.clock', '时钟'), value: 'clock' },
              { label: tr(t, 'app.kuaireport.designer.option.table', '表格'), value: 'table' },
              { label: tr(t, 'app.kuaireport.designer.option.video', '视频'), value: 'video' },
            ],
          },
          url: { type: 'text', label: tr(t, 'app.kuaireport.designer.field.videoUrl', '视频地址') },
          height: { type: 'number', label: tr(t, 'app.kuaireport.designer.field.height', '高度'), min: 80 },
        },
        defaultProps: {
          mediaType: 'clock',
          url: '',
          height: 200,
        },
        render: ({ mediaType, url, height }) => (
          <div style={{ width: '100%', height: height || 200 }}>
            <MediaWidget type={mediaType || 'clock'} url={url} data={DEMO_CHART_DATA} />
          </div>
        ),
      },
      BorderPanel: {
        label: tr(t, 'app.kuaireport.designer.comp.borderPanel', '边框面板'),
        fields: {
          variant: {
            type: 'select',
            label: tr(t, 'app.kuaireport.designer.field.borderStyle', '边框样式'),
            options: [
              { label: tr(t, 'app.kuaireport.designer.option.corner', '角标框'), value: 'corner' },
              { label: tr(t, 'app.kuaireport.designer.option.double', '双线框'), value: 'double' },
              { label: tr(t, 'app.kuaireport.designer.option.gradient', '渐变描边'), value: 'gradient' },
              { label: tr(t, 'app.kuaireport.designer.option.titleEmbed', '标题嵌入'), value: 'titleEmbed' },
            ],
          },
          title: { type: 'text', label: tr(t, 'app.kuaireport.designer.field.embedTitle', '嵌入标题') },
          animate: {
            type: 'select',
            label: tr(t, 'app.kuaireport.designer.field.animate', '动效'),
            options: onOffOptions,
          },
          minHeight: {
            type: 'number',
            label: tr(t, 'app.kuaireport.designer.field.minHeight', '最小高度'),
            min: 80,
          },
          content: { type: 'slot' },
        },
        defaultProps: {
          variant: 'corner',
          title: tr(t, 'app.kuaireport.designer.default.panel', '面板'),
          animate: 'on',
          minHeight: 200,
          content: [],
        },
        render: ({ variant, title, animate, minHeight, content: Content }) => (
          <BorderPanel
            variant={variant || 'corner'}
            title={title}
            animate={animate !== 'off'}
            minHeight={minHeight || 200}
          >
            <Content />
          </BorderPanel>
        ),
      },
      TitleBar: {
        label: tr(t, 'app.kuaireport.designer.comp.titleBar', '标题条'),
        fields: {
          variant: {
            type: 'select',
            label: tr(t, 'app.kuaireport.designer.field.style', '样式'),
            options: [
              { label: tr(t, 'app.kuaireport.designer.option.accentBar', '左侧色条'), value: 'accentBar' },
              { label: tr(t, 'app.kuaireport.designer.option.techLine', '科技折线'), value: 'techLine' },
              { label: tr(t, 'app.kuaireport.designer.option.badgeCenter', '居中徽章'), value: 'badgeCenter' },
            ],
          },
          title: { type: 'text', label: tr(t, 'app.kuaireport.designer.field.title', '标题') },
          subtitle: { type: 'text', label: tr(t, 'app.kuaireport.designer.field.subtitle', '副标题') },
          animate: {
            type: 'select',
            label: tr(t, 'app.kuaireport.designer.field.animate', '动效'),
            options: onOffOptions,
          },
        },
        defaultProps: {
          variant: 'techLine',
          title: tr(t, 'app.kuaireport.designer.default.boardTitle', '生产看板'),
          subtitle: '',
          animate: 'on',
        },
        render: ({ variant, title, subtitle, animate }) => (
          <TitleBar
            variant={variant || 'techLine'}
            title={title}
            subtitle={subtitle}
            animate={animate !== 'off'}
          />
        ),
      },
      AccentDecoration: {
        label: tr(t, 'app.kuaireport.designer.comp.accent', '装饰条'),
        fields: {
          variant: {
            type: 'select',
            label: tr(t, 'app.kuaireport.designer.field.style', '样式'),
            options: [
              { label: tr(t, 'app.kuaireport.designer.option.scanLine', '扫描线'), value: 'scanLine' },
              { label: tr(t, 'app.kuaireport.designer.option.cornerMarks', '四角标'), value: 'cornerMarks' },
              { label: tr(t, 'app.kuaireport.designer.option.pulseBar', '脉冲条'), value: 'pulseBar' },
            ],
          },
          animate: {
            type: 'select',
            label: tr(t, 'app.kuaireport.designer.field.animate', '动效'),
            options: onOffOptions,
          },
        },
        defaultProps: {
          variant: 'scanLine',
          animate: 'on',
        },
        render: ({ variant, animate }) => (
          <AccentDecoration variant={variant || 'scanLine'} animate={animate !== 'off'} />
        ),
      },
      GridRow: {
        label: tr(t, 'app.kuaireport.designer.comp.gridRow', '网格行'),
        fields: {
          columns: { type: 'number', label: tr(t, 'app.kuaireport.designer.field.columns', '列数'), min: 1, max: 6 },
          gap: { type: 'number', label: tr(t, 'app.kuaireport.designer.field.gap', '间距'), min: 0 },
          minHeight: {
            type: 'number',
            label: tr(t, 'app.kuaireport.designer.field.minHeight', '最小高度'),
            min: 80,
          },
          content: { type: 'slot' },
        },
        defaultProps: {
          columns: 2,
          gap: 12,
          minHeight: 200,
          content: [],
        },
        render: ({ columns, gap, minHeight, content: Content }) => (
          <Content
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.max(1, Number(columns) || 2)}, 1fr)`,
              gap: Number(gap) || 12,
              minHeight: Number(minHeight) || 200,
              width: '100%',
            }}
          />
        ),
      },
    },
  };
}

/** 预览/分享页无需语言切换时的默认配置 */
export const dashboardPuckConfig = createDashboardPuckConfig(((key, opts) =>
  typeof opts === 'object' && opts && 'defaultValue' in opts ? String(opts.defaultValue) : key
) as TFunction);
