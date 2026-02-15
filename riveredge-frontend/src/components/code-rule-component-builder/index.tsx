/**
 * 编码规则组件构建器
 * 
 * 参考简道云流水号规则设计，提供拖拽式规则配置界面
 */

import React, { useState, useCallback } from 'react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  useSortable, 
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Card, Space, theme, Modal, message, Dropdown, MenuProps, Typography } from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  EditOutlined,
  HolderOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import {
  CodeRuleComponent,
  CodeRuleComponentType,
  CODE_RULE_COMPONENT_DISPLAY_INFO,
  getComponentDisplayText,
  createDefaultAutoCounterComponent,
  createDefaultDateComponent,
  createDefaultFixedTextComponent,
  createDefaultFormFieldComponent,
} from '../../types/codeRuleComponent';
import CodeRuleComponentConfigModal from './ComponentConfigModal';
import { CodeRuleComponentService } from '../../utils/codeRuleComponent';
import { CODE_FONT_FAMILY } from '../../constants/fonts';

const { Text } = Typography;

interface CodeRuleComponentBuilderProps {
  value?: CodeRuleComponent[];
  onChange?: (components: CodeRuleComponent[]) => void;
  availableFields?: Array<{ field_name: string; field_label: string; field_type: string }>;
}

/**
 * 可拖拽的规则组件项
 */
interface SortableComponentItemProps {
  component: CodeRuleComponent;
  index: number;
  onEdit: (component: CodeRuleComponent, index: number) => void;
  onDelete: (index: number) => void;
  canDelete: boolean;
}

const SortableComponentItem: React.FC<SortableComponentItemProps> = ({
  component,
  index,
  onEdit,
  onDelete,
  canDelete,
}) => {
  const { token } = theme.useToken();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `component-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const info = CODE_RULE_COMPONENT_DISPLAY_INFO[component.type];

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        padding: '12px',
        marginBottom: '8px',
        backgroundColor: token.colorBgContainer,
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadius,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: 'grab',
          color: token.colorTextSecondary,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <HolderOutlined />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, marginBottom: '4px' }}>
          {getComponentDisplayText(component)}
        </div>
        <div style={{ fontSize: '12px', color: token.colorTextSecondary }}>
          {info.description}
        </div>
      </div>
      <Space>
        <Button
          type="text"
          size="small"
          icon={<EditOutlined />}
          onClick={() => onEdit(component, index)}
        >
          编辑
        </Button>
        {canDelete && (
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDelete(index)}
          >
            删除
          </Button>
        )}
      </Space>
    </div>
  );
};

/**
 * 编码规则组件构建器
 */
const CodeRuleComponentBuilder: React.FC<CodeRuleComponentBuilderProps> = ({
  value = [],
  onChange,
  availableFields = [],
}) => {
  const { token } = theme.useToken();
  const [components, setComponents] = useState<CodeRuleComponent[]>(value);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingComponent, setEditingComponent] = useState<CodeRuleComponent | null>(null);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [addComponentType, setAddComponentType] = useState<CodeRuleComponentType | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 同步value变化到内部state
  React.useEffect(() => {
    if (value && value.length > 0) {
      // 只有当value真正变化时才更新（避免循环更新）
      const valueStr = JSON.stringify(value.map(c => ({ ...c, order: c.order })));
      const currentStr = JSON.stringify(components.map(c => ({ ...c, order: c.order })));
      if (valueStr !== currentStr) {
        setComponents(value);
      }
    } else if (components.length === 0) {
      // 如果没有组件，添加默认的自动计数组件
      const defaultComponent = createDefaultAutoCounterComponent(0);
      setComponents([defaultComponent]);
      onChange?.([defaultComponent]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // 当components变化时，通知父组件
  const handleComponentsChange = useCallback((newComponents: CodeRuleComponent[]) => {
    setComponents(newComponents);
    onChange?.(newComponents);
  }, [onChange]);

  // 处理拖拽结束
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = parseInt(String(active.id).replace('component-', ''));
      const newIndex = parseInt(String(over.id).replace('component-', ''));

      const newComponents = arrayMove(components, oldIndex, newIndex);
      // 更新order
      const reorderedComponents = newComponents.map((comp, index) => ({
        ...comp,
        order: index,
      }));
      handleComponentsChange(reorderedComponents);
    }
  }, [components, handleComponentsChange]);

  // 处理添加组件
  const handleAddComponent = useCallback((type: CodeRuleComponentType) => {
    // 检查是否已存在该类型的组件（如果是不可重复的）
    const info = CODE_RULE_COMPONENT_DISPLAY_INFO[type];
    if (!info.repeatable) {
      const exists = components.some(comp => comp.type === type);
      if (exists) {
        message.warning(`${info.label}组件只能添加一个`);
        return;
      }
    }

    // 检查是否已有自动计数组件（必选）
    if (type === 'auto_counter') {
      const exists = components.some(comp => comp.type === 'auto_counter');
      if (exists) {
        message.warning('自动计数组件只能添加一个');
        return;
      }
    }

    let newComponent: CodeRuleComponent;
    const maxOrder = Math.max(...components.map(c => c.order), -1);
    
    switch (type) {
      case 'auto_counter':
        newComponent = createDefaultAutoCounterComponent(maxOrder + 1);
        break;
      case 'date':
        newComponent = createDefaultDateComponent(maxOrder + 1);
        break;
      case 'fixed_text':
        newComponent = createDefaultFixedTextComponent(maxOrder + 1);
        break;
      case 'form_field':
        newComponent = createDefaultFormFieldComponent(maxOrder + 1);
        break;
    }

    const newComponents = [...components, newComponent];
    handleComponentsChange(newComponents);
    
    // 自动打开编辑对话框
    setEditingComponent(newComponent);
    setEditingIndex(newComponents.length - 1);
    setConfigModalVisible(true);
  }, [components, handleComponentsChange]);

  // 处理编辑组件
  const handleEditComponent = useCallback((component: CodeRuleComponent, index: number) => {
    setEditingComponent(component);
    setEditingIndex(index);
    setConfigModalVisible(true);
  }, []);

  // 处理删除组件
  const handleDeleteComponent = useCallback((index: number) => {
    const component = components[index];
    const info = CODE_RULE_COMPONENT_DISPLAY_INFO[component.type];
    
    // 检查是否是必选组件
    if (info.required) {
      message.warning(`${info.label}组件是必选的，不能删除`);
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除"${info.label}"组件吗？`,
      onOk: () => {
        const newComponents = components.filter((_, i) => i !== index);
        // 重新排序
        const reorderedComponents = newComponents.map((comp, i) => ({
          ...comp,
          order: i,
        }));
        handleComponentsChange(reorderedComponents);
      },
    });
  }, [components, handleComponentsChange]);

  // 处理保存组件配置
  const handleSaveComponentConfig = useCallback((updatedComponent: CodeRuleComponent) => {
    if (editingIndex === null) return;

    const newComponents = [...components];
    newComponents[editingIndex] = {
      ...updatedComponent,
      order: editingIndex,
    };
    handleComponentsChange(newComponents);
    
    setConfigModalVisible(false);
    setEditingComponent(null);
    setEditingIndex(null);
  }, [components, editingIndex, handleComponentsChange]);

  // 获取可添加的组件类型
  const getAvailableComponentTypes = useCallback((): CodeRuleComponentType[] => {
    const allTypes: CodeRuleComponentType[] = ['auto_counter', 'date', 'fixed_text', 'form_field'];
    return allTypes.filter(type => {
      const info = CODE_RULE_COMPONENT_DISPLAY_INFO[type];
      if (!info.repeatable) {
        // 如果不可重复，检查是否已存在
        return !components.some(comp => comp.type === type);
      }
      return true;
    });
  }, [components]);

  return (
    <div>
      <Card
        title="流水号规则"
        size="small"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={components.map((_, index) => `component-${index}`)}
            strategy={verticalListSortingStrategy}
          >
            {components.map((component, index) => {
              const info = CODE_RULE_COMPONENT_DISPLAY_INFO[component.type];
              return (
                <SortableComponentItem
                  key={`component-${index}`}
                  component={component}
                  index={index}
                  onEdit={handleEditComponent}
                  onDelete={handleDeleteComponent}
                  canDelete={!info.required}
                />
              );
            })}
          </SortableContext>
        </DndContext>
        
        {/* 添加组件按钮 */}
        <div style={{ 
          marginTop: '16px', 
          marginBottom: '16px',
          display: 'flex', 
          justifyContent: 'center',
          padding: '12px 0',
          borderTop: `1px dashed ${token.colorBorderSecondary}`,
          borderBottom: `1px dashed ${token.colorBorderSecondary}`,
        }}>
          <AddComponentButton
            availableTypes={getAvailableComponentTypes()}
            onAdd={handleAddComponent}
          />
        </div>
        
        {/* 编码预览 */}
        {components.length > 0 && (
          <Card
            size="small"
            style={{
              marginTop: '16px',
              backgroundColor: token.colorPrimaryBg,
              border: `1px solid ${token.colorPrimaryBorder}`,
            }}
          >
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <EyeOutlined style={{ color: token.colorPrimary }} />
              <Text strong style={{ fontSize: '14px', color: token.colorPrimary }}>
                编码预览
              </Text>
            </div>
            <div style={{
              padding: '16px',
              backgroundColor: token.colorBgContainer,
              borderRadius: token.borderRadius,
              fontFamily: CODE_FONT_FAMILY,
              fontSize: '16px',
              fontWeight: 600,
              border: `1px solid ${token.colorBorder}`,
              marginBottom: '12px',
              wordBreak: 'break-all',
              textAlign: 'center',
              color: token.colorText,
              letterSpacing: '1px',
            }}>
              {CodeRuleComponentService.previewComponents(components) || '请配置规则组件'}
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: token.colorTextSecondary,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}>
              <Text type="secondary">
                💡 这是根据当前配置生成的编码预览，实际生成时会使用真实的序号和日期
              </Text>
            </div>
          </Card>
        )}
      </Card>

      {/* 组件配置对话框 */}
      {configModalVisible && editingComponent && (
        <CodeRuleComponentConfigModal
          visible={configModalVisible}
          component={editingComponent}
          availableFields={availableFields}
          onSave={handleSaveComponentConfig}
          onCancel={() => {
            setConfigModalVisible(false);
            setEditingComponent(null);
            setEditingIndex(null);
          }}
        />
      )}
    </div>
  );
};

/**
 * 添加组件按钮
 */
interface AddComponentButtonProps {
  availableTypes: CodeRuleComponentType[];
  onAdd: (type: CodeRuleComponentType) => void;
}

const AddComponentButton: React.FC<AddComponentButtonProps> = ({ availableTypes, onAdd }) => {
  const { token } = theme.useToken();

  if (availableTypes.length === 0) {
    return (
      <Button
        type="primary"
        icon={<PlusOutlined />}
        disabled
      >
        添加
      </Button>
    );
  }

  const menuItems: MenuProps['items'] = availableTypes.map(type => {
    const info = CODE_RULE_COMPONENT_DISPLAY_INFO[type];
    return {
      key: type,
      label: (
        <div>
          <div style={{ fontWeight: 500 }}>{info.label}</div>
          <div style={{ fontSize: '12px', color: token.colorTextSecondary }}>
            {info.description}
          </div>
        </div>
      ),
      onClick: () => onAdd(type),
    };
  });

  return (
    <Dropdown menu={{ items: menuItems }} trigger={['click']}>
      <Button type="primary" icon={<PlusOutlined />}>
        添加
      </Button>
    </Dropdown>
  );
};

export default CodeRuleComponentBuilder;
