/**
 * 全局隔离 @rc-component/dialog（antd Modal 底层）的 Portal 点击冒泡。
 * 经 vite alias 替换包入口，避免逐页传 maskProps/wrapProps。
 *
 * 注意：rc-dialog 将 wrapProps 铺在内部 onClick 之后，会盖掉 maskClosable。
 * 此处在隔离 onClick 末尾按 e.target === currentTarget 补回点遮罩关闭。
 */
import React from 'react';
import OriginalDialogWrap from '@rc-component/dialog/es/DialogWrap';
import Panel from '@rc-component/dialog/es/Dialog/Content/Panel';
import { mergeOverlayIsolateProps } from '../utils/modalEventIsolation';

type DialogWrapProps = React.ComponentProps<typeof OriginalDialogWrap> & {
  maskClosable?: boolean;
  onClose?: (e: React.SyntheticEvent) => void;
  wrapProps?: React.HTMLAttributes<HTMLDivElement>;
  maskProps?: React.HTMLAttributes<HTMLDivElement>;
};

function IsolatedDialogWrap(props: DialogWrapProps) {
  const { wrapProps: userWrap, maskProps: userMask, maskClosable = true, onClose, ...rest } = props;

  const wrapProps = mergeOverlayIsolateProps({
    ...userWrap,
    onClick: (e: React.MouseEvent<HTMLDivElement>) => {
      userWrap?.onClick?.(e);
      // 补回被 wrapProps.onClick 覆盖的 maskClosable（与 rc-dialog 判定一致）
      if (maskClosable && e.target === e.currentTarget) {
        onClose?.(e);
      }
    },
  });

  const maskProps = mergeOverlayIsolateProps(userMask);

  return (
    <OriginalDialogWrap
      {...rest}
      maskClosable={maskClosable}
      onClose={onClose}
      wrapProps={wrapProps}
      maskProps={maskProps}
    />
  );
}

if (process.env.NODE_ENV !== 'production') {
  IsolatedDialogWrap.displayName = 'Dialog';
}

export { Panel };
export default IsolatedDialogWrap;
