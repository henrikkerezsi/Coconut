import { DefaultTheme, MD3DarkTheme } from 'react-native-paper';

const baseTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#3A7D44',
    secondary: '#90674C',
    tertiary: '#6B5E9F',
  },
};

export const theme = {
  ...baseTheme,
  dark: false,
};

export const darkTheme = {
  ...MD3DarkTheme,
  dark: true,
};