import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

const logo = require('../../assets/coconut-logo.jpg');

interface CoconutLogoProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function CoconutLogo({ size = 40, style }: CoconutLogoProps) {
  return (
    <Image
      source={logo}
      style={[{ width: size, height: size, borderRadius: size * 0.42 }, style]}
      resizeMode="contain"
    />
  );
}