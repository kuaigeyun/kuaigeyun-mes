/**
 * 表单 Modal 布局模板
 *
 * 提供统一的表单 Modal 布局，遵循 Ant Design 设计规范
 * 使用 ProForm 实现 standard 化的表单布局
 *
 * Author: Luigi Lu
 * Date: 2025-12-26
 */

import React, { ReactNode, useRef, useState, useEffect } from 'react';
import { Modal, Button, theme, App } from 'antd';
import { ProForm, ProFormInstance } from '@ant-design/pro-components';
import { MODAL_CONFIG, FORM_LAYOUT } from './constants';
import { useSubmitShortcut } from '../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../utils/globalSubmitShortcut';

const { useToken } = theme;

/** Modal body：固定底部操作区，仅内容区滚动并显示滚动条 */
const MODAL_BODY_FLEX_STYLES = {
  body: {
    display: 'flex',
    flexDirection: 'column' as const,
    maxHeight: MODAL_CONFIG.BODY_MAX_HEIGHT,
    overflow: 'hidden',
    padding: 0,
  },
};

/**
 * 表单 Modal 模板属性
 */
export interface FormModalTemplateProps {
  /** Modal 标题 */
  title: string;
  /** 是否显示 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 提交回调 */
  onFinish: (values: any) => Promise<void>;
  /** 是否为编辑模式 */
  isEdit?: boolean;
  /** 表单初始值 */
  initialValues?: Record<string, any>;
  /** 表单子元素 */
  children: ReactNode;
  /** Modal 宽度（默认：标准宽度） */
  width?: number;
  /** 表单布局类型（默认：垂直布局） */
  layout?: 'vertical' | 'horizontal';
  /** 是否启用网格布局（默认：true） */
  grid?: boolean;
  /** 加载状态 */
  loading?: boolean;
  /** 表单引用（可选，用于外部访问表单实例） */
  formRef?: React.RefObject<ProFormInstance>;
  /** 表单实例（可选，由 Form.useForm() 获取） */
  form?: any;
  /** 表单值变化回调 */
  onValuesChange?: (changedValues: any, allValues: any) => void;
  /** 自定义样式类名 */
  className?: string;
  /** 自定义 Modal 渲染（如包裹锚点元素供智能建议面板定位） */
  modalRender?: (modal: React.ReactNode) => React.ReactNode;
  /** 底部额外内容（如测试连接按钮），渲染在创建/更新按钮后面 */
  extraFooter?: ReactNode;
}

/**
 * 表单 Modal 布局模板
 */
export const FormModalTemplate: React.FC<FormModalTemplateProps> = ({
  title,
  open,
  onClose,
  onFinish,
  isEdit = false,
  initialValues,
  children,
  width = MODAL_CONFIG.STANDARD_WIDTH,
  layout = FORM_LAYOUT.VERTICAL,
  grid = false,
  loading = false,
  formRef: externalFormRef,
  form,
  onValuesChange,
  className,
  modalRender,
  extraFooter,
}) => {
  const { token } = useToken();
  const { message: messageApi } = App.useApp();
  const internalFormRef = useRef<ProFormInstance>();
  const formRef = externalFormRef || internalFormRef;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasScrollbar, setHasScrollbar] = useState(false);

  useSubmitShortcut(() => formRef.current?.submit(), open);

  useEffect(() => {
    if (!open) {
      setHasScrollbar(false);
      return;
    }
    let ro: ResizeObserver | null = null;
    const timer = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const update = () => setHasScrollbar(el.scrollHeight > el.clientHeight + 1);
      update();
      ro = new ResizeObserver(update);
      ro.observe(el);
    }, 0);
    return () => {
      clearTimeout(timer);
      ro?.disconnect();
    };
  }, [open]);

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={null}
      width={width}
      destroyOnHidden
      className={[className, 'form-modal-template'].filter(Boolean).join(' ')}
      modalRender={modalRender}
      styles={MODAL_BODY_FLEX_STYLES}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div
          ref={scrollRef}
          className="modal-content-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: hasScrollbar ? 6 : 0,
          }}
        >
          <div className="form-modal-content-inner" style={{ padding: 0 }}>
            <ProForm
              formRef={formRef}
              form={form}
              loading={loading}
              onFinish={onFinish}
              onFinishFailed={({ errorFields }) => {
                const first = errorFields?.[0];
                const text = first?.errors?.filter(Boolean)[0];
                messageApi.error(text || '请检查表单填写是否完整');
              }}
              scrollToFirstError
              onValuesChange={onValuesChange}
              initialValues={initialValues}
              layout={layout}
              grid={grid}
              rowProps={{ gutter: FORM_LAYOUT.GRID_GUTTER }}
              submitter={false}
            >
              {children}
            </ProForm>
          </div>
        </div>
        <div
          className="form-modal-footer"
          style={{
            flexShrink: 0,
            borderTop: `1px solid ${token.colorBorderSecondary}`,
            marginTop: 6,
            padding: '16px 0 0 0',
            background: token.colorBgContainer,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={loading} onClick={() => formRef.current?.submit()}>
            {(isEdit ? '更新' : '创建') + SUBMIT_SHORTCUT_HINT}
          </Button>
          {extraFooter}
        </div>
      </div>
    </Modal>
  );
};

export default FormModalTemplate;
