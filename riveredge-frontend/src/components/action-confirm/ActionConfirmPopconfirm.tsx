import React from 'react';
import { Popconfirm, type PopconfirmProps } from 'antd';

export type ActionConfirmPopconfirmProps = Omit<PopconfirmProps, 'onConfirm' | 'onCancel'> & {
  onConfirm: () => void | Promise<void>;
  onCancel?: PopconfirmProps['onCancel'];
  children: React.ReactElement;
};

/**
 * 行内 / 工具栏纯确认：气泡贴触发器，禁止 Modal.confirm 遮罩整页。
 * 字符串补充说明走 description（原 modal content 文本）。
 */
export function ActionConfirmPopconfirm({
  onConfirm,
  onCancel,
  children,
  ...rest
}: ActionConfirmPopconfirmProps) {
  return (
    <Popconfirm
      {...rest}
      onConfirm={(e) => {
        e?.stopPropagation();
        void onConfirm();
      }}
      onCancel={(e) => {
        e?.stopPropagation();
        onCancel?.(e);
      }}
    >
      {children}
    </Popconfirm>
  );
}

export default ActionConfirmPopconfirm;
