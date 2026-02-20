/**
 * 报表预览组件
 *
 * 用于预览报表效果（所见即所得）
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Spin, message, theme } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { ReportConfig, ReportComponent } from './index';
import { TableComponent, ChartComponent, TextComponent, ImageComponent } from './components';
import { apiRequest } from '../../services/api';

/**
 * 预览组件Props
 */
export interface PreviewProps {
  /** 报表配置 */
  config: ReportConfig;
  /** 是否显示刷新按钮 */
  showRefresh?: boolean;
  /** 外部传入数据（用于打印预览等场景） */
  externalData?: Record<string, any>;
}

/**
 * 报表预览组件
 */
const { useToken } = theme;

const Preview: React.FC<PreviewProps> = ({ config, showRefresh = true, externalData }) => {
  const { token } = useToken();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, any>>({});

  /**
   * 加载数据
   */
  const loadData = async () => {
    // 如果有外部数据，直接使用外部数据
    if (externalData) {
      setData(externalData);
      return;
    }

    setLoading(true);
    try {
      // TODO: 从API获取数据
      // 当前为简化实现
      const mockData: Record<string, any> = {};
      
      // 模拟数据加载
      const dataSources = config.dataSources || {};
      for (const [dsId, config] of Object.entries(dataSources)) {
        const dsConfig = config as any;
        if (dsConfig.type === 'api' && dsConfig.url) {
          try {
            const response = await apiRequest(dsConfig.url, {
              method: 'GET',
            });
            mockData[dsId] = response;
          } catch (error) {
            console.error(`加载数据源 ${dsId} 失败:`, error);
            mockData[dsId] = [];
          }
        } else {
          // 模拟数据
          mockData[dsId] = [];
        }
      }
      
      setData(mockData);
    } catch (error) {
      message.error('加载数据失败');
      console.error('Preview load data error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [config, externalData]);

  /**
   * 渲染组件
   */
  const renderComponent = (component: ReportComponent) => {
    // 优先使用数据源绑定的数据，如果没有绑定数据源，则传递整个 data 上下文（用于文本变量替换）
    const componentData = component.dataSource?.code 
      ? (data[component.dataSource.code] || []) 
      : data;

    switch (component.type) {
      case 'table':
        return (
          <TableComponent
            component={{
              ...component,
              data: Array.isArray(componentData) ? componentData : [],
            }}
          />
        );
      case 'chart':
        return (
          <ChartComponent
            component={{
              ...component,
              data: Array.isArray(componentData) ? componentData : [],
            }}
          />
        );
      case 'text':
        return <TextComponent component={component} data={data} />;
      case 'image':
        return <ImageComponent component={component} />;
      default:
        return <div>{component.type}</div>;
    }
  };

  return (
    <Card
      title="报表预览"
      extra={
        showRefresh && (
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
            size="small"
          >
            刷新
          </Button>
        )
      }
    >
      <Spin spinning={loading}>
        <div
          style={{
            minHeight: '400px',
            background: '#fff',
            position: 'relative',
            padding: '20px',
          }}
        >
          {config.components.map((component) => (
            <div
              key={component.id}
              style={{
                position: 'absolute',
                left: component.x,
                top: component.y,
                width: component.width,
                height: component.height,
                border: `1px solid ${token.colorBorder}`,
                padding: '8px',
              }}
            >
              {renderComponent(component)}
            </div>
          ))}
          {config.components.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                color: '#999',
                padding: '100px 0',
              }}
            >
              暂无组件，请从组件库拖拽组件到画布
            </div>
          )}
        </div>
      </Spin>
    </Card>
  );
};

export default Preview;

