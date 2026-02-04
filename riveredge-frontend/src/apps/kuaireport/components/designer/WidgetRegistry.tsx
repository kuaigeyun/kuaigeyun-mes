import React from 'react';
import {
    BarChartOutlined,
    LineChartOutlined,
    PieChartOutlined,
    AreaChartOutlined,
    BorderOutlined,
    RocketOutlined,
    NumberOutlined,
    VideoCameraOutlined,
    ClockCircleOutlined,
    TableOutlined,
    FontSizeOutlined
} from '@ant-design/icons';
import { WidgetType } from '../../types/dashboard';

export interface WidgetDefinition {
    type: WidgetType;
    subType: string;
    title: string;
    icon: React.ReactNode;
    category: 'chart' | 'decoration' | 'indicator' | 'media' | 'text' | 'other';
    defaultSize: { w: number, h: number };
}

export const WIDGET_CATEGORIES = [
    { key: 'chart', label: '基础图表', icon: <BarChartOutlined /> },
    { key: 'decoration', label: '大屏装饰', icon: <BorderOutlined /> },
    { key: 'indicator', label: '数据指标', icon: <NumberOutlined /> },
    { key: 'media', label: '媒体/工具', icon: <VideoCameraOutlined /> },
    { key: 'text', label: '文本内容', icon: <FontSizeOutlined /> },
];

export const WIDGET_REGISTRY: WidgetDefinition[] = [
    // Charts
    { type: 'chart', subType: 'line', title: '折线图', icon: <LineChartOutlined />, category: 'chart', defaultSize: { w: 6, h: 6 } },
    { type: 'chart', subType: 'column', title: '柱状图', icon: <BarChartOutlined />, category: 'chart', defaultSize: { w: 6, h: 6 } },
    { type: 'chart', subType: 'pie', title: '饼图', icon: <PieChartOutlined />, category: 'chart', defaultSize: { w: 4, h: 6 } },
    { type: 'chart', subType: 'area', title: '面积图', icon: <AreaChartOutlined />, category: 'chart', defaultSize: { w: 6, h: 6 } },
    { type: 'chart', subType: 'radar', title: '雷达图', icon: <AreaChartOutlined />, category: 'chart', defaultSize: { w: 6, h: 6 } },
    { type: 'chart', subType: 'scatter', title: '散点图', icon: <BarChartOutlined />, category: 'chart', defaultSize: { w: 6, h: 6 } },
    { type: 'chart', subType: 'gauge', title: '仪表盘', icon: <PieChartOutlined />, category: 'chart', defaultSize: { w: 4, h: 4 } },
    { type: 'chart', subType: 'liquid', title: '水波图', icon: <RocketOutlined />, category: 'chart', defaultSize: { w: 4, h: 4 } },
    { type: 'chart', subType: 'dualAxes', title: '双轴图', icon: <LineChartOutlined />, category: 'chart', defaultSize: { w: 8, h: 6 } },

    // Decorations
    { type: 'border', subType: 'border-1', title: '层级边框 1', icon: <BorderOutlined />, category: 'decoration', defaultSize: { w: 4, h: 4 } },
    { type: 'border', subType: 'border-11', title: '科技边框 11', icon: <BorderOutlined />, category: 'decoration', defaultSize: { w: 4, h: 4 } },
    { type: 'decoration', subType: 'decoration-1', title: '动态装饰 1', icon: <RocketOutlined />, category: 'decoration', defaultSize: { w: 3, h: 2 } },
    { type: 'decoration', subType: 'decoration-2', title: '动态装饰 2', icon: <RocketOutlined />, category: 'decoration', defaultSize: { w: 3, h: 2 } },
    { type: 'decoration', subType: 'decoration-9', title: '放射环 9', icon: <RocketOutlined />, category: 'decoration', defaultSize: { w: 4, h: 4 } },

    // Indicators
    { type: 'indicator' as any, subType: 'number', title: '数字指标', icon: <NumberOutlined />, category: 'indicator', defaultSize: { w: 3, h: 2 } },
    { type: 'indicator' as any, subType: 'flop', title: '翻牌器', icon: <NumberOutlined />, category: 'indicator', defaultSize: { w: 4, h: 3 } },
    { type: 'indicator' as any, subType: 'gauge', title: '仪表盘/环图', icon: <PieChartOutlined />, category: 'indicator', defaultSize: { w: 4, h: 4 } },
    { type: 'indicator' as any, subType: 'water', title: '水位图', icon: <RocketOutlined />, category: 'indicator', defaultSize: { w: 4, h: 4 } },

    // Media
    { type: 'media' as any, subType: 'video', title: '视频播放', icon: <VideoCameraOutlined />, category: 'media', defaultSize: { w: 6, h: 4 } },
    { type: 'media' as any, subType: 'clock', title: '实时时钟', icon: <ClockCircleOutlined />, category: 'media', defaultSize: { w: 3, h: 2 } },
    { type: 'media' as any, subType: 'table', title: '滚动表格', icon: <TableOutlined />, category: 'media', defaultSize: { w: 6, h: 6 } },

    // Text
    { type: 'text' as any, subType: 'title', title: '标题文本', icon: <FontSizeOutlined />, category: 'text', defaultSize: { w: 4, h: 2 } },
    { type: 'text' as any, subType: 'marquee', title: '跑马灯', icon: <FontSizeOutlined />, category: 'text', defaultSize: { w: 6, h: 1 } },
];
