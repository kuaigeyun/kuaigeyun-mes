import React, { useState } from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, InputItem, List, WhiteSpace, WingBlank, Toast } from '@ant-design/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../src/components/GlassCard';

const { width } = Dimensions.get('window');

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
        // Simulate login
        setTimeout(() => {
            setLoading(false);
            Toast.success('登录成功');
            router.replace('/(tabs)');
        }, 1000);
    };

    return (
        <LinearGradient
            // Use a trendy "Liquid" gradient: Blue -> Purple -> Pinkish
            colors={['#e0c3fc', '#8ec5fc']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.container}
        >
            <WingBlank size="lg">
                <View style={styles.header}>
                    <View style={styles.logoShadow}>
                        <Image source={require('../../assets/icon.png')} style={styles.logo} />
                    </View>
                </View>

                <GlassCard style={styles.card}>
                    <View style={{ padding: 20 }}>
                        <View style={{ marginBottom: 20 }}>
                            <InputItem
                                clear
                                value={username}
                                onChange={(value: string) => setUsername(value)}
                                placeholder="请输入用户名"
                                style={styles.input}
                            >
                                <Image source={require('../../assets/icon.png')} style={{ width: 20, height: 20, opacity: 0 }} /> {/* Spacer hack or use Icon */}
                                账号
                            </InputItem>
                            <View style={styles.divider} />
                            <InputItem
                                clear
                                type="password"
                                value={password}
                                onChange={(value: string) => setPassword(value)}
                                placeholder="请输入密码"
                                style={styles.input}
                            >
                                密码
                            </InputItem>
                        </View>

                        <Button type="primary" loading={loading} onPress={handleLogin} style={styles.button}>
                            登录
                        </Button>
                    </View>
                </GlassCard>

                <View style={styles.footer}>
                    <Image source={require('../../assets/icon.png')} style={{ width: 20, height: 20, tintColor: '#fff', opacity: 0.8 }} />
                    {/* Simple footer text */}
                </View>
            </WingBlank>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoShadow: {
        shadowColor: '#7a42f4',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
    },
    logo: {
        width: 100,
        height: 100,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.8)',
    },
    card: {
        borderRadius: 30,
    },
    input: {
        backgroundColor: 'transparent',
        fontSize: 16,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginLeft: 15,
    },
    button: {
        borderRadius: 25,
        height: 50,
        backgroundColor: '#1890ff', // Or gradient button? Keep Ant Design primary for now
        shadowColor: '#1890ff',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        borderWidth: 0,
    },
    footer: {
        alignItems: 'center',
        marginTop: 30,
        opacity: 0.6
    }
});
