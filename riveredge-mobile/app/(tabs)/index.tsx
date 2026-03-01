/**
 * 首屏工作台 - Ant Design Mobile 规范
 * 参考：Card、NoticeBar、Grid、主色 #1677ff
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, RefreshControl, TouchableOpacity, ActivityIndicator, Image, useWindowDimensions, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Icon, NoticeBar, WhiteSpace } from '@ant-design/react-native';
import { FileText, List, ShieldCheck, Package, ChartBar, Warning } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../src/theme';
import { TouchableScale } from '../../src/components/TouchableScale';
import { ModernButton } from '../../src/components/ModernButton';
import { GlassCard } from '../../src/components/GlassCard';
import { getWorkOrderStatistics, WorkOrderStatistics } from '../../src/services/workOrderService';
import { getStoredUser } from '../../src/services/authService';
import { getUserMessageStats, getUserMessages } from '../../src/services/messageService';
import { getUserProfile } from '../../src/services/userProfileService';
import { getFilePreview } from '../../src/services/fileService';
import { BASE_URL } from '../../src/services/api';
import { getProcessInspections, getIncomingInspections, getFinishedGoodsInspections } from '../../src/services/qualityService';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 9) return '早安';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  if (h < 22) return '晚上好';
  return '夜深了';
}

export default function WorkbenchScreen() {
  const [stats, setStats] = useState<WorkOrderStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState<string>('操作员');
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [notices, setNotices] = useState<{ id: string; title: string; type?: string }[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingInspectionCount, setPendingInspectionCount] = useState(0);
  const [userRole, setUserRole] = useState<string>('');
  const [userDepartment, setUserDepartment] = useState<string>('');
  const [now, setNow] = useState(() => new Date());
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const { height: screenHeight } = useWindowDimensions();
  const isSmallScreen = screenHeight < 700;

  const loadData = useCallback(async () => {
    try {
      const [statsRes, user, profile, msgStats, msgList, processList, incomingList, finishedList] = await Promise.all([
        getWorkOrderStatistics(),
        getStoredUser(),
        getUserProfile().catch(() => null),
        getUserMessageStats().catch(() => null),
        getUserMessages({ page: 1, page_size: 5, unread_only: true }).catch(() => null),
        getProcessInspections({ status: '待检验', limit: 50 }).catch(() => []),
        getIncomingInspections({ status: '待检验', limit: 50 }).catch(() => []),
        getFinishedGoodsInspections({ status: '待检验', limit: 50 }).catch(() => []),
      ]);
      setStats(statsRes);
      setPendingInspectionCount((processList?.length || 0) + (incomingList?.length || 0) + (finishedList?.length || 0));
      
      let nameToSet = user?.full_name || user?.username || '操作员';
      if (profile?.full_name || profile?.username) {
        nameToSet = profile.full_name || profile.username || '操作员';
      }
      setUserName(nameToSet);
      setUserRole(user?.position?.name || user?.roles?.[0]?.name || (user ? '操作员' : ''));
      setUserDepartment(user?.department?.name || '');
      
      const avatarUuid = profile?.avatar || user?.avatar;
      if (avatarUuid && typeof avatarUuid === 'string' && avatarUuid.length > 0) {
        try {
          const previewInfo = await getFilePreview(avatarUuid, true);
          if (previewInfo.preview_url) {
            let processedUrl = previewInfo.preview_url;
            
            // 后端有可能返回带有 localhost 的绝对路径。在安卓模拟器或者真机上，需要将其转换为当前的真实 API BASE_URL
            if (processedUrl.includes('localhost') || processedUrl.includes('127.0.0.1')) {
              const match = processedUrl.match(/https?:\/\/[^\/]+(.*)/);
              if (match && match[1]) {
                processedUrl = match[1];
              }
            }

            const base = BASE_URL.replace(/\/api\/v1\/?$/, '');
            const url = processedUrl.startsWith('http') 
              ? processedUrl 
              : `${base}${processedUrl.startsWith('/') ? '' : '/'}${processedUrl}`;
            
            setUserAvatar(url);
          } else {
             setUserAvatar(null);
          }
        } catch (error) {
           setUserAvatar(null);
        }
      } else {
        setUserAvatar(null);
      }

      if (msgStats) setUnreadCount(msgStats.unread);
      if (msgList?.items?.length) {
        setNotices(
          msgList.items.slice(0, 3).map((m) => ({
            id: m.uuid,
            title: m.subject || m.content?.slice(0, 40) || '新消息',
            type: m.type,
          }))
        );
      } else {
        setNotices([]);
      }
    } catch {
      setStats({
        in_progress_count: 0,
        completed_today_count: 0,
        overdue_count: 0,
        draft_count: 0,
        completed_count: 0,
      });
      setPendingInspectionCount(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const goToWorkOrders = (filterStatus?: string) => {
    Haptics.selectionAsync();
    router.push({ pathname: '/mes', params: filterStatus ? { status: filterStatus } : {} } as any);
  };

  const goToQuality = () => {
    Haptics.selectionAsync();
    router.push('/quality' as any);
  };

  return (
    <View style={styles.container}>


      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#1677ff']} />}
      >
        {/* Hero Header - mobile_bannert.png 作为背景，图片置于右下角贴边 */}
        <View style={styles.bannerWrapper}>
          <View style={[styles.bannerContent, { paddingTop: Math.max(insets.top, 10), paddingBottom: isSmallScreen ? 28 : 36 }]}>
            <Image
              source={require('../../assets/images/mobile_bannert.png')}
              style={styles.bannerBgImage}
              resizeMode="contain"
            />
            {/* 顶栏：左侧欢迎语，右侧工具图标 */}
            <View style={styles.headerTopBar}>
              <Text style={styles.headerWelcomeText} numberOfLines={1}>{getGreeting()}，{userName}</Text>
              <View style={styles.headerIconsMerged}>
                <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/message' as any); }} style={styles.iconBtnMerged}>
                  <View style={[styles.iconWithBadge]}>
                    <Icon name="bell" size="md" color="#fff" />
                    {unreadCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { Haptics.selectionAsync(); router.push('/(tabs)/profile' as any); }} style={styles.iconBtnMerged}>
                  <View style={[styles.headerIconCircle, { backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' }]}>
                    {userAvatar ? (
                      <Image source={{ uri: userAvatar }} style={styles.avatarImageSmall} onError={() => setUserAvatar(null)} />
                    ) : (
                      <Text style={styles.avatarTextSmall}>{userName.charAt(0) || '?'}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </View>
            {/* 主内容区：角色/部门 + 日期时间 */}
            <View style={styles.heroMain}>
              <View style={styles.heroTextBlock}>
                {(userRole || userDepartment) ? (
                  <View style={styles.headerBadgeRow}>
                    {userRole ? <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{userRole}</Text></View> : null}
                    {userDepartment ? <View style={styles.headerBadge}><Text style={styles.headerBadgeText}>{userDepartment}</Text></View> : null}
                  </View>
                ) : null}
                <Text style={styles.headerSubline}>
                  {now.getMonth() + 1}月{now.getDate()}日 {['周日','周一','周二','周三','周四','周五','周六'][now.getDay()]} · {String(now.getHours()).padStart(2,'0')}:{String(now.getMinutes()).padStart(2,'0')}
                </Text>
                {!loading && (
                  <View style={styles.headerStatsRow}>
                    <View style={styles.headerStatItemWithIcon}>
                      <Icon name="mail" size="xs" color="rgba(255,255,255,0.9)" style={styles.headerStatIcon} />
                      <Text style={styles.headerStatItem}>未读消息 {unreadCount} 条</Text>
                    </View>
                    {(stats?.completed_count ?? 0) > 0 && (
                      <>
                        <Text style={styles.headerStatDot}>·</Text>
                        <Text style={styles.headerStatItem}>累计完成 {stats?.completed_count} 单</Text>
                      </>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {notices.length > 0 && (
          <>
            <NoticeBar
              mode="link"
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/(tabs)/message' as any);
              }}
              icon={<Icon name="info-circle" size="xxs" color="#faad14" />}
            >
              {notices[0].title}
              {notices.length > 1 && ` (+${notices.length - 1})`}
            </NoticeBar>
            <WhiteSpace size="md" />
          </>
        )}

        {/* 指标卡片 - 液态玻璃化容器 */}
        <View style={styles.cardOverlapWrapper}>
        <GlassCard intensity={50} style={styles.glassStatsContainer as ViewStyle}>
          <View style={styles.statsRow}>
            {loading ? (
              <View style={[styles.statCard, styles.statCardLoading]}>
                <ActivityIndicator size="small" color="#1677ff" />
              </View>
            ) : (
              <>
                <TouchableScale hapticMode="selection" style={[styles.statCard, styles.statCardPrimary]} onPress={() => goToWorkOrders('in_progress')}>
                  <Text style={[styles.statValue, styles.statValuePrimary]}>{stats?.in_progress_count ?? 0}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>进行中</Text>
                </TouchableScale>
                <TouchableScale hapticMode="selection" style={[styles.statCard, styles.statCardSuccess]} onPress={() => goToWorkOrders('completed')}>
                  <Text style={[styles.statValue, styles.statValueSuccess]}>{stats?.completed_today_count ?? 0}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>今日完成</Text>
                </TouchableScale>
                <TouchableScale hapticMode="selection" style={[styles.statCard, styles.statCardDanger]} onPress={() => goToWorkOrders('overdue')}>
                  <Text style={[styles.statValue, (stats?.overdue_count ?? 0) > 0 ? styles.statValueDanger : styles.statValueMuted]}>
                    {stats?.overdue_count ?? 0}
                  </Text>
                  <Text style={styles.statLabel} numberOfLines={1}>逾期</Text>
                </TouchableScale>
                <TouchableScale hapticMode="selection" style={[styles.statCard, styles.statCardWarning]} onPress={goToQuality}>
                  <Text style={[styles.statValue, styles.statValueWarning]}>{pendingInspectionCount}</Text>
                  <Text style={styles.statLabel} numberOfLines={1}>待检验</Text>
                </TouchableScale>
              </>
            )}
          </View>
        </GlassCard>
        </View>
        <WhiteSpace size="lg" />

        {/* 主操作：扫码报工 - 采用全新的 ModernButton */}
        <ModernButton
          title="扫码报工"
          type="primary"
          size="large"
          icon={<Icon name="scan" size={24} color="#fff" />}
          onPress={() => router.push('/mes/scan' as any)}
          style={{ shadowColor: theme.colors.primary, shadowOffset: { width:0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 }}
        />
        <WhiteSpace size="lg" />

        {/* 次要入口：玻璃拟态宫格 */}
        <View style={styles.cardContainer}>
          <View style={styles.gridContainer}>
            {[
              { id: '1', icon: <FileText size={28} color="#1677ff" weight="duotone" duotoneColor="#1677ff" duotoneOpacity={0.3} />, text: '我的工单', path: 'mes-my' },
              { id: '2', icon: <List size={28} color="#52c41a" weight="duotone" duotoneColor="#52c41a" duotoneOpacity={0.3} />, text: '全部工单', path: 'mes' },
              { id: '3', icon: <ShieldCheck size={28} color="#faad14" weight="duotone" duotoneColor="#faad14" duotoneOpacity={0.3} />, text: '质量检验', path: 'quality' },
              { id: '4', icon: <Package size={28} color="#1677ff" weight="duotone" duotoneColor="#1677ff" duotoneOpacity={0.3} />, text: '仓储领料', path: 'wms' },
              { id: '5', icon: <ChartBar size={28} color="#722ed1" weight="duotone" duotoneColor="#722ed1" duotoneOpacity={0.3} />, text: '我的绩效', path: 'performance' },
              { id: '6', icon: <Warning size={28} color="#eb2f96" weight="duotone" duotoneColor="#eb2f96" duotoneOpacity={0.3} />, text: '异常上报', path: 'exception' },
            ].map((item) => (
              <TouchableScale
                key={item.id}
                hapticMode="selection"
                activeScale={0.92}
                style={styles.gridItemContainer}
                onPress={() => {
                  if (item.path === 'mes-my') router.push({ pathname: '/mes', params: { my: '1' } } as any);
                  else if (item.path) router.push(`/${item.path}` as any);
                }}
              >
                <GlassCard intensity={35} style={styles.gridItemGlass}>
                  <View style={styles.gridItemIconWrapper}>
                    {item.icon}
                  </View>
                  <Text style={styles.gridItemText}>{item.text}</Text>
                </GlassCard>
              </TouchableScale>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f4f7' },
  bannerWrapper: {
    marginHorizontal: -theme.spacing.lg,
    marginTop: -theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.lg,
  },
  bannerContent: {
    paddingLeft: 20,
    paddingRight: 0,
    paddingBottom: 20,
    minHeight: 220,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0078F3',
  },
  bannerBgImage: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: '85%',
    height: '100%',
  },
  headerWelcomeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    marginRight: 12,
  },
  headerTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingRight: 20,
  },
  heroMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    gap: 16,
    paddingRight: 20,
  },
  heroTextBlock: {
    flex: 1,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  headerBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  headerSubline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 10,
    fontWeight: '500',
  },
  headerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 4,
  },
  headerStatItemWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerStatIcon: {
    marginRight: 4,
  },
  headerStatItem: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  headerStatDot: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  headerStatDanger: {
    color: '#ffccc7',
    fontWeight: '600',
  },
  heroIllustration: {
    width: 100,
    height: 72,
    flexShrink: 0,
  },
  headerTitleMerged: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  headerIconsMerged: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBtnMerged: {
    padding: 4,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImageSmall: { width: 40, height: 40 },
  avatarTextSmall: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cardOverlapWrapper: {
    marginTop: -36,
    marginHorizontal: 0,
  },
  glassStatsContainer: {
    marginHorizontal: 0,
    padding: 12,
    borderRadius: 20,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.4)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
      web: { boxShadow: '0 6px 20px rgba(0,0,0,0.08)' } as any,
    }),
  },
  scrollContent: {
    padding: 16,
  },
  userNameBold: {
    fontWeight: '700',
    color: '#374151',
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  iconBtn: { padding: theme.spacing.xs },
  iconWithBadge: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
  },
  badgeText: { color: theme.colors.textInverse, fontSize: 10, fontWeight: '700' },
  avatarBtn: { padding: 2 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.round,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: theme.shadows.sm,
      android: { elevation: 2 },
    }),
  },
  avatarImage: { width: 40, height: 40 },
  avatarText: { color: theme.colors.textInverse, fontSize: 16, fontWeight: '600' },
  cardContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.05)' } as any,
    }),
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 76,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
      web: { boxShadow: '0 1px 4px rgba(0,0,0,0.04)' } as any,
    }),
  },
  statCardPrimary: {},
  statCardSuccess: {},
  statCardDanger: {},
  statCardWarning: {},
  statCardLoading: {
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statValuePrimary: { color: theme.colors.primary },
  statValueSuccess: { color: theme.colors.success },
  statValueDanger: { color: theme.colors.danger },
  statValueWarning: { color: theme.colors.warning },
  statValueMuted: { color: '#8c8c8c' },
  statLabel: {
    color: '#8c8c8c',
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
  },
  /* primaryBtn and primaryBtnText styles removed gracefully */
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  gridItemContainer: {
    width: '48%',
    marginBottom: 10,
  },
  gridItemGlass: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.5)',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 12px rgba(0,0,0,0.06)' } as any,
    }),
  },
  gridItemIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#fff', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.5, shadowRadius: 2 },
      android: { elevation: 1 },
      web: { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)' } as any,
    }),
  },
  gridItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
});
