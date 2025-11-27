/**
 * RiverEdge SaaS 多组织框架 - ProTable 查询条件保存插件
 *
 * 用于接管 ProTable 的搜索栏，将搜索条件在弹窗中展示
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import type { ActionType, ProFormInstance, ProColumns } from '@ant-design/pro-components';
import { ProForm, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDateRangePicker } from '@ant-design/pro-components';
import { Button, Modal, Row, Col } from 'antd';
import { DownOutlined } from '@ant-design/icons';

/**
 * 查询搜索弹窗组件属性
 */
interface QuerySearchModalProps {
  /**
   * ProTable 的 columns
   */
  columns: ProColumns<any>[];
  /**
   * ProTable 的 formRef
   */
  formRef: React.MutableRefObject<ProFormInstance | undefined>;
  /**
   * ProTable 的 actionRef
   */
  actionRef: React.MutableRefObject<ActionType | undefined>;
  /**
   * 搜索弹窗是否可见
   */
  visible: boolean;
  /**
   * 关闭弹窗回调
   */
  onClose: () => void;
  /**
   * Modal 自定义样式
   */
  style?: React.CSSProperties;
}

/**
 * 查询搜索弹窗组件
 */
export const QuerySearchModal: React.FC<QuerySearchModalProps> = ({
  columns,
  formRef,
  actionRef,
  visible,
  onClose,
  style,
}) => {
  const searchFormRef = useRef<ProFormInstance>();

  /**
   * 获取可搜索的列
   */
  const getSearchableColumns = () => {
    return columns.filter((col) => {
      // 排除隐藏搜索的列
      if (col.hideInSearch) {
        return false;
      }
      // 排除操作列
      if (col.valueType === 'option') {
        return false;
      }
      return true;
    });
  };

  /**
   * 根据列类型渲染表单项
   */
  const renderFormItem = (column: ProColumns<any>) => {
    const { dataIndex, title, valueType, valueEnum, fieldProps } = column;

    // 文本输入框
    if (!valueType || valueType === 'text') {
      return (
        <ProFormText
          key={dataIndex as string}
          name={dataIndex as string}
          label={title as string}
          placeholder={`请输入${title as string}`}
          fieldProps={fieldProps}
        />
      );
    }

    // 选择框
    if (valueType === 'select' && valueEnum) {
      return (
        <ProFormSelect
          key={dataIndex as string}
          name={dataIndex as string}
          label={title as string}
          placeholder={`请选择${title as string}`}
          valueEnum={valueEnum}
          fieldProps={fieldProps}
        />
      );
    }

    // 日期选择器
    if (valueType === 'date') {
      return (
        <ProFormDatePicker
          key={dataIndex as string}
          name={dataIndex as string}
          label={title as string}
          placeholder={`请选择${title as string}`}
          fieldProps={fieldProps}
        />
      );
    }

    // 日期范围选择器
    if (valueType === 'dateRange') {
      return (
        <ProFormDateRangePicker
          key={dataIndex as string}
          name={dataIndex as string}
          label={title as string}
          placeholder={[`开始${title as string}`, `结束${title as string}`]}
          fieldProps={fieldProps}
        />
      );
    }

    // 默认使用文本输入框
    return (
      <ProFormText
        key={dataIndex as string}
        name={dataIndex as string}
        label={title as string}
        placeholder={`请输入${title as string}`}
        fieldProps={fieldProps}
      />
    );
  };

  /**
   * 处理搜索
   */
  const handleSearch = async () => {
    try {
      const values = await searchFormRef.current?.validateFields();
      if (values) {
        // 将搜索条件应用到 ProTable 的表单
        if (formRef.current) {
          formRef.current.setFieldsValue(values);
        }
        // 触发 ProTable 重新查询
        actionRef.current?.reload();
        onClose();
      }
    } catch (error) {
      console.error('搜索表单验证失败:', error);
    }
  };

  /**
   * 处理重置
   */
  const handleReset = () => {
    searchFormRef.current?.resetFields();
    if (formRef.current) {
      formRef.current.resetFields();
    }
    actionRef.current?.reload();
  };

  /**
   * 弹窗打开时，同步 ProTable 表单的值到搜索表单
   */
  useEffect(() => {
    if (visible && formRef.current) {
      const currentValues = formRef.current.getFieldsValue();
      // 延迟设置，确保表单已初始化
      setTimeout(() => {
        searchFormRef.current?.setFieldsValue(currentValues);
      }, 100);
    }
  }, [visible, formRef]);

  const searchableColumns = getSearchableColumns();

  return (
    <Modal
      title="搜索条件"
      open={visible}
      onCancel={onClose}
      width={600}
      centered={false}
      style={style}
      getContainer={() => document.body}
      mask={true}
      footer={[
        <Button key="reset" onClick={handleReset}>
          重置
        </Button>,
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="search" type="primary" onClick={handleSearch}>
          搜索
        </Button>,
      ]}
    >
      <ProForm
        formRef={searchFormRef}
        submitter={false}
      >
        <Row gutter={16}>
          {searchableColumns.map((column) => (
            <Col span={12} key={column.dataIndex as string}>
              {renderFormItem(column)}
            </Col>
          ))}
        </Row>
      </ProForm>
    </Modal>
  );
};

/**
 * 查询搜索按钮组件属性
 */
interface QuerySearchButtonProps {
  /**
   * ProTable 的 columns
   */
  columns: ProColumns<any>[];
  /**
   * ProTable 的 formRef
   */
  formRef: React.MutableRefObject<ProFormInstance | undefined>;
  /**
   * ProTable 的 actionRef
   */
  actionRef: React.MutableRefObject<ActionType | undefined>;
}

/**
 * 查询搜索按钮组件
 */
export const QuerySearchButton: React.FC<QuerySearchButtonProps> = ({
  columns,
  formRef,
  actionRef,
}) => {
  const [visible, setVisible] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [modalStyle, setModalStyle] = useState<React.CSSProperties>({});

  /**
   * 计算 Modal 位置，使其在按钮下方弹出，并与按钮左对齐
   */
  const calculateModalPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setModalStyle({
        top: `${rect.bottom + 8}px`,
        left: `${rect.left}px`,
        paddingBottom: 0,
        margin: 0,
        transform: 'none',
      });
    }
  }, []);

  /**
   * 打开弹窗时计算位置
   */
  const handleOpen = () => {
    setVisible(true);
    // 延迟计算，确保按钮已渲染
    setTimeout(() => {
      calculateModalPosition();
    }, 0);
  };

  /**
   * 窗口大小改变时重新计算位置
   */
  useEffect(() => {
    if (visible) {
      const handleResize = () => {
        calculateModalPosition();
      };
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleResize, true);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize, true);
      };
    }
  }, [visible, calculateModalPosition]);

  return (
    <>
      <Button
        ref={buttonRef}
        onClick={handleOpen}
        type="primary"
      >
        高级搜索
        <DownOutlined style={{ marginLeft: 4 }} />
      </Button>
      <QuerySearchModal
        columns={columns}
        formRef={formRef}
        actionRef={actionRef}
        visible={visible}
        onClose={() => setVisible(false)}
        style={modalStyle}
      />
    </>
  );
};
