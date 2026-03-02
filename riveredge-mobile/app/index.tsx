/**
 * 根入口：根据认证状态重定向
 * 未登录时自动以 guest 体验登录，直接进入工作台
 */
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { isAuthenticated, guestLogin } from '../src/services/authService';

export default function IndexScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ok = await isAuthenticated();
        if (cancelled) return;
        if (ok) {
          router.replace('/(tabs)');
          return;
        }
        // 未登录：自动 guest 体验登录，直接进入工作台
        try {
          await guestLogin();
          if (cancelled) return;
          router.replace('/(tabs)');
        } catch {
          if (!cancelled) router.replace('/(auth)/login');
        }
      } catch {
        if (!cancelled) router.replace('/(auth)/login');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1890ff" />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f9',
  },
});
