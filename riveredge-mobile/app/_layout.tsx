import { Stack, router } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Provider } from '@ant-design/react-native';
import zhCN from '@ant-design/react-native/lib/locale-provider/zh_CN';
import 'react-native-reanimated'; // Import reanimated
import { setOn401Callback } from '../src/services/api';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const [fontTimeout, setFontTimeout] = useState(false);

    useEffect(() => {
        setOn401Callback(() => router.replace('/(auth)/login'));
    }, []);

    const [loaded, error] = useFonts({
        'antoutline': require('../assets/fonts/antoutline.ttf'),
        'antfill': require('../assets/fonts/antfill.ttf'),
    });

    // Web 平台：字体加载超时 3 秒后强制继续，避免 useFonts 卡住导致白屏
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const t = setTimeout(() => setFontTimeout(true), 3000);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        if (loaded || error || fontTimeout) {
            SplashScreen.hideAsync();
        }
    }, [loaded, error, fontTimeout]);

    if (!loaded && !error && !fontTimeout) {
        return null;
    }

    return (
        <Provider locale={zhCN}>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="mes" options={{ headerShown: false }} />
                <Stack.Screen name="quality" options={{ headerShown: false }} />
                <Stack.Screen name="wms" options={{ headerShown: false }} />
                <Stack.Screen name="performance" />
                <Stack.Screen name="exception" />
                <Stack.Screen name="(profile)" options={{ headerShown: false }} />
                {/* +not-found 由 expo-router 自动注入，显式声明会导致 "Too many screens" 警告 */}
            </Stack>
        </Provider>
    );
}
