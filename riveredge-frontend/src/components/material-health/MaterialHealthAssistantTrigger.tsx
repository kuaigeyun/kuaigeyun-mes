import React, { useEffect, useState } from 'react';

const KUAIAI_MATERIAL_HEALTH = import.meta.glob(
  '../../apps/kuaiai/components/material-health/MaterialHealthAssistant.tsx',
);

type TriggerProps = Record<string, unknown>;

/** compose kuaiai 前不渲染；避免主仓 OSS 构建静态依赖 pro 包路径。 */
export function MaterialHealthAssistantTrigger(props: TriggerProps) {
  const [Inner, setInner] = useState<React.ComponentType<TriggerProps> | null>(null);

  useEffect(() => {
    const loader = Object.values(KUAIAI_MATERIAL_HEALTH)[0];
    if (!loader) return;
    void loader().then((mod) => {
      const exported = mod as { MaterialHealthAssistantTrigger?: React.ComponentType<TriggerProps> };
      if (exported.MaterialHealthAssistantTrigger) {
        setInner(() => exported.MaterialHealthAssistantTrigger);
      }
    });
  }, []);

  if (!Inner) return null;
  return <Inner {...props} />;
}
