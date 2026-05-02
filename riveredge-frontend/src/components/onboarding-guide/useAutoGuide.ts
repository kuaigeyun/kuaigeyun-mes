import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useGuideStore } from './store';
import { GUIDE_REGISTRY } from './registry';
import { useUserPreferenceStore } from '../../stores/userPreferenceStore';

/**
 * 自动触发引导的 Hook
 * @param pageKey 引导注册表中的键 (如 'dashboard')
 * @param force 是否强制触发 (忽略是否已完成)
 */
export const useAutoGuide = (pageKey: string, force = false) => {
  const location = useLocation();
  const { runGuide, completedGuides, isRunning } = useGuideStore();
  
  // 从个人偏好中获取是否显示引导的开关
  const showGuidePref = useUserPreferenceStore((s) => s.getPreference('ui.show_onboarding_guide', true));

  useEffect(() => {
    // 如果用户全局关闭了引导，则不触发
    if (!showGuidePref && !force) return;

    // 检查是否有对应的引导配置
    const hasConfig = !!GUIDE_REGISTRY[pageKey];
    if (!hasConfig) return;

    // 检查是否已完成
    const isCompleted = completedGuides.includes(pageKey);
    
    // 检查 URL 参数是否要求强制开启 (?tour=true 或 ?tour=pageKey)
    const searchParams = new URLSearchParams(location.search);
    const triggerParam = searchParams.get('tour');
    const shouldTriggerFromUrl = triggerParam === 'true' || triggerParam === pageKey;

    if ((!isCompleted || force || shouldTriggerFromUrl) && !isRunning) {
      // 延迟一会确保页面渲染完成
      const timer = setTimeout(() => {
        runGuide(pageKey);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [pageKey, force, completedGuides, isRunning, location.search, runGuide, showGuidePref]);
};

export default useAutoGuide;
