/**
 * 报表设计器组件
 *
 * 基于@dnd-kit + @ant-design/charts开发的拖拽式报表设计器
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useState, useCallback, useRef } from 'react';
import { Layout, Card, Button, Space, message, Tabs, Divider, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { SaveOutlined, EyeOutlined, UndoOutlined, RedoOutlined } from '@ant-design/icons';
import { DndContext, DragOverlay, DragEndEvent, DragStartEvent, DragOverEvent, useSensor, useSensors, PointerSensor, useDroppable } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import PropertyPanel from './property-panel';
import DraggableComponent from './DraggableComponent';
import DraggableItem from './DraggableItem';
import Canvas from './Canvas';
import Preview from './preview';
import { TableComponent, ChartComponent, TextComponent, ImageComponent, SystemConfigComponent, CoreConfigComponent, BusinessConfigComponent } from './components';

const { Sider, Content } = Layout;
const { useToken } = theme;

/**
 * 报表组件类型
 */
export type ComponentType = 'table' | 'chart' | 'text' | 'image' | 'group' | 'system-config' | 'core-config' | 'business-config';

/**
 * 报表组件接口
 */
export interface ReportComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  width: number;
  height: number;
  style?: Record<string, any>;
  [key: string]: any;
}

/**
 * 报表配置接口
 */
export interface ReportConfig {
  version: string;
  layout: Record<string, any>;
  components: ReportComponent[];
  dataSources?: Array<Record<string, any>>;
  styles?: Record<string, any>;
}

/**
 * 报表设计器Props
 */
export interface ReportDesignerProps {
  /** 初始配置 */
  initialConfig?: ReportConfig;
  /** 保存回调 */
  onSave?: (config: ReportConfig) => void;
  /** 预览回调 */
  onPreview?: (config: ReportConfig) => void;
  /** 数据模式（可用变量） */
  dataSchema?: any;
}

/**
 * 报表设计器组件
 */
const ReportDesigner: React.FC<ReportDesignerProps> = ({
  initialConfig,
  onSave,
  onPreview,
  dataSchema,
}) => {
  const { t } = useTranslation();
  const { token } = useToken();
  const [config, setConfig] = useState<ReportConfig>(
    initialConfig || {
      version: '1.0',
      layout: {},
      components: [],
    }
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<ReportComponent | null>(null);
  const [activeTab, setActiveTab] = useState<string>('design');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  /**
   * 处理拖拽开始
   */
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  /**
   * 处理拖拽悬停
   */
  const handleDragOver = useCallback((event: DragOverEvent) => {
    // 可以在这里实现拖拽时的视觉反馈
  }, []);

  /**
   * 处理拖拽结束
   */
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    // 如果从组件库拖拽到画布，添加新组件
    if (over.id === 'canvas' && active.id.toString().startsWith('component-')) {
      const componentType = active.id.toString().replace('component-', '') as ComponentType;
      
      // Determine default dimensions based on component type
      let defaultWidth = 200;
      let defaultHeight = 50;
      
      if (['system-config', 'core-config', 'business-config'].includes(componentType)) {
        defaultWidth = 800;
        defaultHeight = 600;
      } else if (componentType === 'table') {
        defaultWidth = 600;
        defaultHeight = 300;
      } else if (componentType === 'chart') {
        defaultWidth = 400;
        defaultHeight = 300;
      }

      const newComponent: ReportComponent = {
        id: `comp-${Date.now()}`,
        type: componentType,
        x: 100,
        y: 100,
        width: defaultWidth,
        height: defaultHeight,
        ...(componentType === 'text' && { content: t('components.reportDesigner.defaultTextContent'), textType: 'paragraph' }),
        ...(componentType === 'image' && { src: '', alt: '' }),
        ...(componentType === 'chart' && { chartType: 'column' }),
      };
      setConfig((prev) => ({
        ...prev,
        components: [...prev.components, newComponent],
      }));
      setSelectedComponent(newComponent);
    }

    // 如果拖拽画布上的组件，更新位置
    if (active.id.toString().startsWith('comp-') && over.id === 'canvas') {
      const componentId = active.id as string;
      const component = config.components.find((c) => c.id === componentId);
      if (component) {
        // 获取鼠标位置（简化实现，实际应该从event获取）
        const newX = component.x + (event.delta?.x || 0);
        const newY = component.y + (event.delta?.y || 0);
        
        setConfig((prev) => ({
          ...prev,
          components: prev.components.map((comp) =>
            comp.id === componentId
              ? { ...comp, x: Math.max(0, newX), y: Math.max(0, newY) }
              : comp
          ),
        }));
      }
    }

    setActiveId(null);
  }, [config.components]);

  /**
   * 处理组件更新
   */
  const handleComponentUpdate = useCallback((component: ReportComponent) => {
    setConfig((prev) => ({
      ...prev,
      components: prev.components.map((comp) =>
        comp.id === component.id ? component : comp
      ),
    }));
    setSelectedComponent(component);
  }, []);

  /**
   * 处理组件点击
   */
  const handleComponentClick = useCallback((component: ReportComponent) => {
    setSelectedComponent(component);
  }, []);

  /**
   * 处理保存
   */
  const handleSave = useCallback(() => {
    if (onSave) {
      onSave(config);
      message.success(t('components.reportDesigner.saveSuccess'));
    }
  }, [config, onSave]);

  /**
   * 处理预览
   */
  const handlePreview = useCallback(() => {
    if (onPreview) {
      onPreview(config);
    }
  }, [config, onPreview]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <Layout style={{ height: '100%' }}>
        {/* 左侧组件库 */}
        <Sider width={200} style={{ background: '#fff', borderRight: `1px solid ${token.colorBorder}` }}>
          <Card title={t('components.reportDesigner.componentLibrary')} size="small" style={{ height: '100%' }}>
            <Space orientation="vertical" style={{ width: '100%' }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{t('components.reportDesigner.basicComponents')}</div>
              <DraggableItem id="component-table" label={t('components.reportDesigner.table')} />
              <DraggableItem id="component-chart" label={t('components.reportDesigner.chart')} />
              <DraggableItem id="component-text" label={t('components.reportDesigner.text')} />
              <DraggableItem id="component-image" label={t('components.reportDesigner.image')} />
              <DraggableItem id="component-group" label={t('components.reportDesigner.group')} />

              <Divider style={{ margin: '12px 0' }} />
              
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{t('components.reportDesigner.systemConfig')}</div>
              <DraggableItem id="component-system-config" label={t('components.reportDesigner.systemParams')} />
              <DraggableItem id="component-core-config" label={t('components.reportDesigner.coreConfig')} />
              <DraggableItem id="component-business-config" label={t('components.reportDesigner.businessConfig')} />
            </Space>
          </Card>
        </Sider>

        {/* 中间画布区域 */}
        <Content style={{ background: '#f5f5f5', padding: '16px', position: 'relative' }}>
          <Card
            title={
              <Space>
                <Button icon={<SaveOutlined />} onClick={handleSave}>
                  保存
                </Button>
              </Space>
            }
            style={{ height: '100%' }}
          >
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'design',
                  label: t('components.reportDesigner.tabDesign'),
                  children: (
                    <Canvas id="canvas" components={config.components}>
              {config.components.map((component) => (
                <DraggableComponent
                  key={component.id}
                  component={component}
                  isSelected={selectedComponent?.id === component.id}
                  onClick={() => handleComponentClick(component)}
                  onRender={(comp) => {
                    switch (comp.type) {
                      case 'table':
                        return <TableComponent component={comp} />;
                      case 'chart':
                        return <ChartComponent component={comp} />;
                      case 'text':
                        return <TextComponent component={comp} />;
                      case 'image':
                        return <ImageComponent component={comp} />;
                      case 'system-config':
                        return <SystemConfigComponent component={comp} />;
                      case 'core-config':
                        return <CoreConfigComponent component={comp} />;
                      case 'business-config':
                        return <BusinessConfigComponent component={comp} />;
                      default:
                        return <div>{comp.type}</div>;
                    }
                  }}
                />
                      ))}
                    </Canvas>
                  ),
                },
                {
                  key: 'preview',
                  label: t('components.reportDesigner.tabPreview'),
                  children: <Preview config={config} />,
                },
              ]}
            />
          </Card>
        </Content>

        {/* 右侧属性配置面板 */}
        <Sider width={300} style={{ background: '#fff', borderLeft: `1px solid ${token.colorBorder}` }}>
          <PropertyPanel
            selectedComponent={selectedComponent}
            onUpdate={handleComponentUpdate}
            dataSchema={dataSchema}
          />
        </Sider>
      </Layout>

      <DragOverlay>
        {activeId ? <div>拖拽中...</div> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default ReportDesigner;
export { default as Preview } from './preview';

