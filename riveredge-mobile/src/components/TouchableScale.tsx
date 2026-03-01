import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface TouchableScaleProps extends PressableProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    activeScale?: number;
    hapticMode?: 'selection' | 'impactLight' | 'impactMedium' | 'impactHeavy' | 'none';
}

export const TouchableScale: React.FC<TouchableScaleProps> = ({
    children,
    style,
    activeScale = 0.95,
    hapticMode = 'selection',
    onPressIn,
    onPressOut,
    onPress,
    ...rest
}) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    const triggerHaptic = () => {
        if (hapticMode === 'selection') {
            Haptics.selectionAsync();
        } else if (hapticMode === 'impactLight') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else if (hapticMode === 'impactMedium') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else if (hapticMode === 'impactHeavy') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }
    };

    const handlePressIn = (e: any) => {
        scale.value = withTiming(activeScale, { duration: 150 });
        if (onPressIn) onPressIn(e);
    };

    const handlePressOut = (e: any) => {
        scale.value = withSpring(1, { damping: 10, stiffness: 200 });
        if (onPressOut) onPressOut(e);
    };

    const handlePress = (e: any) => {
        triggerHaptic();
        if (onPress) onPress(e);
    };

    return (
        <AnimatedPressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handlePress}
            style={[animatedStyle, style]}
            {...rest}
        >
            {children}
        </AnimatedPressable>
    );
};
