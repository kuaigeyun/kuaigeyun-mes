import React from 'react';
import { useTranslation } from 'react-i18next';

export interface TwoColumnLayoutResizerProps {
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  visible?: boolean;
}

export const TwoColumnLayoutResizer: React.FC<TwoColumnLayoutResizerProps> = ({
  onMouseDown,
  visible = true,
}) => {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <div
      className="two-column-layout-resizer"
      role="separator"
      aria-orientation="vertical"
      aria-label={t('components.twoColumnLayout.resizeLeftPanel')}
      onMouseDown={onMouseDown}
      style={{
        width: 6,
        flexShrink: 0,
        cursor: 'col-resize',
        position: 'relative',
        zIndex: 2,
        marginLeft: -3,
        marginRight: -3,
      }}
    />
  );
};
