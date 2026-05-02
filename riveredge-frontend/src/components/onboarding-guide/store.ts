import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface GuideStore {
  /** 当前正在运行的引导 ID */
  activeGuideId: string | null;
  /** 已完成的引导 ID 列表 */
  completedGuides: string[];
  /** 引导是否正在运行 */
  isRunning: boolean;
  /** 设置当前引导 */
  setGuide: (guideId: string | null) => void;
  /** 开始引导 */
  runGuide: (guideId: string) => void;
  /** 完成引导 */
  completeGuide: (guideId: string) => void;
  /** 停止当前引导 */
  stopGuide: () => void;
  /** 重置所有引导状态（调试用） */
  resetGuides: () => void;
}

export const useGuideStore = create<GuideStore>()(
  persist(
    (set) => ({
      activeGuideId: null,
      completedGuides: [],
      isRunning: false,
      setGuide: (guideId) => set({ activeGuideId: guideId }),
      runGuide: (guideId) => set({ activeGuideId: guideId, isRunning: true }),
      completeGuide: (guideId) =>
        set((state) => ({
          completedGuides: [...new Set([...state.completedGuides, guideId])],
          isRunning: false,
          activeGuideId: null,
        })),
      stopGuide: () => set({ isRunning: false, activeGuideId: null }),
      resetGuides: () => set({ completedGuides: [], isRunning: false, activeGuideId: null }),
    }),
    {
      name: 'riveredge-onboarding-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
