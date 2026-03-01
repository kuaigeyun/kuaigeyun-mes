/**
 * 登录页 - Ant Design Mobile 规范
 * 参考：Form + InputItem、品牌区、白底卡片、主色按钮
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Platform, KeyboardAvoidingView } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, InputItem, List, WingBlank, Toast, WhiteSpace } from '@ant-design/react-native';
import { login } from '../../src/services/authService';

export default function LoginScreen() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!username || !password) {
            Toast.fail('请输入用户名和密码');
            return;
        }

        setLoading(true);
        try {
            await login({ username: username.trim(), password });
            Toast.success('登录成功');
            router.replace('/(tabs)');
        } catch (err: any) {
            const msg = err?.response?.data?.detail || err?.message || '登录失败';
            Toast.fail(typeof msg === 'string' ? msg : '登录失败，请检查网络');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
            <View style={styles.brandArea}>
                <Image source={require('../../assets/icon.png')} style={styles.logo} />
                <Text style={styles.brandTitle}>快格轻制造</Text>
                <Text style={styles.brandSubtitle}>车间移动工作台</Text>
            </View>

            <View style={styles.formArea}>
                <List style={styles.formList}>
                    <InputItem
                        clear
                        value={username}
                        onChange={(v: string) => setUsername(v)}
                        placeholder="请输入用户名"
                        placeholderTextColor="#bfbfbf"
                    >
                        账号
                    </InputItem>
                    <InputItem
                        clear
                        type="password"
                        value={password}
                        onChange={(v: string) => setPassword(v)}
                        placeholder="请输入密码"
                        placeholderTextColor="#bfbfbf"
                    >
                        密码
                    </InputItem>
                </List>
                <WhiteSpace size="xl" />
                <WingBlank size="lg">
                    <Button
                        type="primary"
                        loading={loading}
                        onPress={handleLogin}
                        style={styles.submitBtn}
                    >
                        登录
                    </Button>
                </WingBlank>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        paddingTop: Platform.OS === 'ios' ? 80 : 60,
    },
    brandArea: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        width: 64,
        height: 64,
        borderRadius: 12,
        marginBottom: 12,
    },
    brandTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1a1a1a',
    },
    brandSubtitle: {
        fontSize: 13,
        color: '#8c8c8c',
        marginTop: 4,
    },
    formArea: {
        flex: 1,
        paddingHorizontal: 16,
    },
    formList: {
        backgroundColor: '#fff',
        borderRadius: 8,
        overflow: 'hidden',
    },
    submitBtn: {
        height: 48,
        borderRadius: 8,
    },
});
