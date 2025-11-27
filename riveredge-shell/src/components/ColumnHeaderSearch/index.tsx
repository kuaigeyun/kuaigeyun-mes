/**
 * 表头搜索组件
 * 
 * 用于在表格列头显示搜索图标，点击后弹出搜索框
 */

import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Dropdown, Space, Select } from 'antd';
import { SearchOutlined, ReloadOutlined, CheckOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

/**
 * 表头搜索组件属性
 */
interface ColumnHeaderSearchProps {
  /**
   * 列标题
   */
  title: string;
  /**
   * 搜索值
   */
  value?: string | number;
  /**
   * 搜索值变化回调
   */
  onChange?: (value: string | number) => void;
  /**
   * 确认搜索回调
   */
  onConfirm?: (value: string | number) => void;
  /**
   * 重置搜索回调
   */
  onReset?: () => void;
  /**
   * 占位符文本
   */
  placeholder?: string;
  /**
   * 搜索类型：'text' | 'select'
   */
  searchType?: 'text' | 'select';
  /**
   * 选择框选项（当 searchType 为 'select' 时使用）
   */
  options?: Array<{ label: string; value: string | number }>;
  /**
   * 排序状态（从 ProTable 的 title 函数传入）
   */
  sortOrder?: 'ascend' | 'descend' | null;
  /**
   * 是否启用排序（用于显示排序图标）
   */
  sorter?: boolean;
}

/**
 * 表头搜索组件
 */
export const ColumnHeaderSearch: React.FC<ColumnHeaderSearchProps> = ({
  title,
  value,
  onChange,
  onConfirm,
  onReset,
  placeholder,
  searchType = 'text',
  options = [],
  sortOrder,
  sorter = false,
}) => {
  const [searchValue, setSearchValue] = useState<string | number | undefined>(value);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<any>(null);

  /**
   * 同步外部 value 到内部状态
   */
  useEffect(() => {
    setSearchValue(value);
  }, [value]);

  /**
   * 处理搜索值变化（文本输入）
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchValue(newValue);
    onChange?.(newValue);
  };

  /**
   * 处理搜索值变化（选择框）
   */
  const handleSelectChange = (newValue: string | number) => {
    setSearchValue(newValue);
    onChange?.(newValue);
  };

  /**
   * 处理确认搜索
   */
  const handleConfirm = () => {
    onConfirm?.(searchValue || '');
    setOpen(false);
  };

  /**
   * 处理重置
   */
  const handleReset = () => {
    setSearchValue(undefined);
    onChange?.(undefined as any);
    onReset?.();
    setOpen(false);
  };

  /**
   * 下拉菜单内容
   */
  const dropdownContent = (
    <div style={{ padding: '12px', width: '280px', background: '#fff', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
      {searchType === 'select' ? (
        <Select
          placeholder={placeholder || `请选择 ${title}`}
          value={searchValue}
          onChange={handleSelectChange}
          style={{ width: '100%', marginBottom: '8px' }}
          allowClear
          options={options}
        />
      ) : (
        <Input
          ref={inputRef}
          placeholder={placeholder || `搜索 ${title}`}
          value={searchValue as string}
          onChange={handleInputChange}
          onPressEnter={handleConfirm}
          style={{ marginBottom: '8px' }}
          allowClear
        />
      )}
      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={handleReset}
        >
          重置
        </Button>
        <Button
          type="primary"
          size="small"
          icon={<CheckOutlined />}
          onClick={handleConfirm}
        >
          确认
        </Button>
      </Space>
    </div>
  );

  /**
   * 处理搜索图标点击，阻止事件冒泡
   */
  const handleSearchClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，防止触发排序
    e.preventDefault(); // 阻止默认行为
  };

  /**
   * 处理标题区域点击，只在点击搜索图标时阻止事件冒泡
   */
  const handleTitleClick = (e: React.MouseEvent) => {
    // 如果点击的是搜索图标区域，阻止冒泡（防止触发排序）
    const target = e.target as HTMLElement;
    if (target.closest('.column-header-search-icon')) {
      e.stopPropagation();
      return;
    }
    // 点击的是标题文字或排序图标，不阻止冒泡（允许排序功能正常工作）
  };

  /**
   * 渲染排序图标
   */
  const renderSortIcon = () => {
    if (!sorter) return null;
    
    return (
      <span 
        className="ant-table-column-sorter"
        style={{ 
          display: 'inline-flex',
          alignItems: 'center',
          marginLeft: '4px',
        }}
      >
        <span className="ant-table-column-sorter-inner">
          <ArrowUpOutlined 
            className={`anticon anticon-caret-up ${sortOrder === 'ascend' ? 'active' : ''}`}
            style={{ 
              fontSize: '10px',
              color: sortOrder === 'ascend' ? '#1890ff' : '#bfbfbf',
            }}
          />
          <ArrowDownOutlined 
            className={`anticon anticon-caret-down ${sortOrder === 'descend' ? 'active' : ''}`}
            style={{ 
              fontSize: '10px',
              color: sortOrder === 'descend' ? '#1890ff' : '#bfbfbf',
              marginTop: '-0.3em',
            }}
          />
        </span>
      </span>
    );
  };

  return (
    <div 
      style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}
      onClick={handleTitleClick}
    >
      <span style={{ cursor: sorter ? 'pointer' : 'default', flex: 1 }}>{title}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        {/* 搜索图标 */}
        <Dropdown
          open={open}
          onOpenChange={setOpen}
          dropdownRender={() => dropdownContent}
          trigger={['click']}
          placement="bottomLeft"
          getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
        >
          <span 
            className="column-header-search-icon"
            onClick={handleSearchClick}
            onMouseDown={(e) => {
              // 在 mousedown 阶段也阻止冒泡
              e.stopPropagation();
            }}
            style={{ 
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 4px',
            }}
          >
            <SearchOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
          </span>
        </Dropdown>
        {/* 排序图标（手动渲染） */}
        {renderSortIcon()}
      </div>
    </div>
  );
};

