import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AnimatedHeaderProps {
  title: string;
  scrollY: Animated.SharedValue<number>;
  showMenuButton?: boolean;
  rightComponent?: React.ReactNode;
  
  // Customization props
  height?: number;
  backgroundColor?: string;
  titleColor?: string;
  titleSize?: number;
  borderColor?: string;
  borderWidth?: number;
  paddingHorizontal?: number;
  menuIconSize?: number; // NEW: Menu icon size
  
  // Animation customization
  fadeDistance?: number;
  slideDistance?: number;
  animationDelay?: number;
}

export const AnimatedHeader: React.FC<AnimatedHeaderProps> = ({
  title,
  scrollY,
  showMenuButton = true,
  rightComponent,
  
  // Default customization values
  height = 60,
  backgroundColor = '#25292e',
  titleColor = 'white',
  titleSize = 18,
  borderColor = 'rgba(255, 255, 255, 0.1)',
  borderWidth = 1,
  paddingHorizontal = 16,
  menuIconSize = 26, // NEW: Default larger menu icon
  
  // Default animation values
  fadeDistance = 100,
  slideDistance = 100,
  animationDelay = 0,
}) => {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const insets = useSafeAreaInsets();
  
  const totalHeaderHeight = height + insets.top;
  
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const scrollValue = scrollY.value - animationDelay;
    
    const opacity = interpolate(
      scrollValue,
      [0, fadeDistance],
      [1, 0],
      Extrapolate.CLAMP
    );

    const translateY = interpolate(
      scrollValue,
      [0, slideDistance],
      [0, -totalHeaderHeight],
      Extrapolate.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: totalHeaderHeight,
          backgroundColor,
          zIndex: 1000,
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingHorizontal,
          paddingBottom: 13,
          paddingTop: insets.top,
          borderBottomWidth: borderWidth,
          borderBottomColor: borderColor,
        },
        headerAnimatedStyle,
      ]}
    >
      {showMenuButton && (
        <Pressable
          onPress={() => navigation.openDrawer()}
          style={{ 
            marginRight: 16,
            padding: 4, // Add padding for better touch area
          }}
        >
          <Ionicons name="menu" size={menuIconSize} color={titleColor} />
        </Pressable>
      )}
      
      <Text style={{ 
        color: titleColor, 
        fontSize: titleSize, 
        fontWeight: 'bold',
        flex: 1,
      }}>
        {title}
      </Text>
      
      {rightComponent}
    </Animated.View>
  );
};