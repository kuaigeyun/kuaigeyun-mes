import { Platform, StyleSheet } from "react-native";

export const theme = {
  colors: {
    primary: "#1677ff", // 品牌主色 (Ant Design 默认)
    primaryLight: "#e6f4ff", // 主色浅底色
    primaryGradientStart: "#4096ff", // 现代感的主色渐变起点
    primaryGradientEnd: "#0958d9", // 现代感的主色渐变终点

    success: "#52c41a",
    successLight: "#f6ffed",
    warning: "#faad14",
    warningLight: "#fffbe6",
    danger: "#ff4d4f",
    dangerLight: "#fff2f0",
    info: "#1677ff",

    text: "#1a1a1a", // 主要文字
    textSecondary: "#666666", // 次要文字
    textTertiary: "#999999", // 辅助文字
    textInverse: "#ffffff", // 反色文字

    background: "#f5f7fa", // 稍微带点灰蓝的背景，显得高级
    surface: "#ffffff", // 卡片表面颜色
    border: "#f0f0f0", // 微弱的边框线
    divider: "#f0f0f0",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radii: {
    sm: 4,
    md: 8,
    lg: 16, // 卡片常用的现代大圆角
    xl: 24, // 更大的圆角
    round: 9999, // 全圆角
  },
  shadows: {
    // 使用更柔和的多层阴影(Smooth Shadows)替代原生的硬阴影
    sm: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
      },
    }),
    md: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
      },
    }),
    lg: Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
      },
    }),
  },
  typography: {
    h1: { fontSize: 28, fontWeight: "800" as const, letterSpacing: 0.5 },
    h2: { fontSize: 24, fontWeight: "700" as const },
    h3: { fontSize: 20, fontWeight: "600" as const },
    title1: { fontSize: 18, fontWeight: "600" as const },
    title2: { fontSize: 16, fontWeight: "600" as const },
    body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
    bodyBold: { fontSize: 15, fontWeight: "600" as const, lineHeight: 22 },
    callout: { fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
    subhead: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
    footnote: { fontSize: 12, fontWeight: "400" as const },
    caption: { fontSize: 11, fontWeight: "400" as const },
  },
};

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.sm,
  },
  flexRowCenter: {
    flexDirection: "row",
    alignItems: "center",
  },
  flexRowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
