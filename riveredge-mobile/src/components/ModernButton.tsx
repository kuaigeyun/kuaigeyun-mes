import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  type?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'large' | 'medium' | 'small';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

export const ModernButton: React.FC<ButtonProps> = ({
  title,
  onPress,
  type = 'primary',
  size = 'large',
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const getContainerStyle = () => {
    let base: ViewStyle = { ...styles.baseContainer };
    
    // Size variants
    if (size === 'large') {
      base.height = 56;
      base.paddingHorizontal = theme.spacing.xl;
      base.borderRadius = theme.radii.lg;
    } else if (size === 'medium') {
      base.height = 44;
      base.paddingHorizontal = theme.spacing.lg;
      base.borderRadius = theme.radii.md;
    } else {
      base.height = 32;
      base.paddingHorizontal = theme.spacing.md;
      base.borderRadius = theme.radii.sm;
    }

    // Color variants
    if (disabled) {
      base.backgroundColor = theme.colors.border;
      base.borderColor = theme.colors.border;
    } else if (type === 'primary') {
      // Background handled by LinearGradient wrapper
      base.backgroundColor = 'transparent';
      Object.assign(base, theme.shadows.md);
    } else if (type === 'danger') {
      base.backgroundColor = theme.colors.danger;
      Object.assign(base, theme.shadows.md);
    } else if (type === 'secondary') {
      base.backgroundColor = theme.colors.primaryLight;
    } else if (type === 'ghost') {
      base.backgroundColor = 'transparent';
      base.borderWidth = 1;
      base.borderColor = theme.colors.border;
    }

    return base;
  };

  const getTextStyle = () => {
    let base: TextStyle = { ...styles.baseText };
    
    if (size === 'large') base = { ...base, ...theme.typography.title1 };
    else if (size === 'medium') base = { ...base, ...theme.typography.bodyBold };
    else base = { ...base, ...theme.typography.subhead };

    if (disabled) {
      base.color = theme.colors.textTertiary;
    } else if (type === 'primary' || type === 'danger') {
      base.color = theme.colors.textInverse;
    } else if (type === 'secondary') {
      base.color = theme.colors.primary;
    } else {
      base.color = theme.colors.text;
    }
    return base;
  };

  const innerContent = (
    <View style={[getContainerStyle(), style, { backgroundColor: type === 'primary' && !disabled ? 'transparent' : getContainerStyle().backgroundColor }]}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={[getTextStyle(), textStyle]}>{title}</Text>
    </View>
  );

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      style={[
         type === 'primary' && !disabled ? { borderRadius: getContainerStyle().borderRadius, overflow: 'hidden', ...theme.shadows.md } : {},
         style
      ]}
    >
      {type === 'primary' && !disabled ? (
         <LinearGradient
            colors={[theme.colors.primaryGradientStart, theme.colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
         >
            {innerContent}
         </LinearGradient>
      ) : (
         innerContent
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  baseText: {
    textAlign: 'center',
  },
  iconContainer: {
    marginRight: theme.spacing.sm,
  }
});
