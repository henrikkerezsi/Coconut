export interface Palette {
  brown: {
    readonly 50: string;
    readonly 100: string;
    readonly 200: string;
    readonly 300: string;
    readonly 400: string;
    readonly 500: string;
    readonly 600: string;
    readonly 700: string;
    readonly 800: string;
    readonly 900: string;
  };
  green: {
    readonly 50: string;
    readonly 100: string;
    readonly 200: string;
    readonly 300: string;
    readonly 400: string;
    readonly 500: string;
    readonly 600: string;
    readonly 700: string;
    readonly 800: string;
    readonly 900: string;
  };
  neutral: {
    readonly 50: string;
    readonly 100: string;
    readonly 200: string;
    readonly 300: string;
    readonly 400: string;
    readonly 500: string;
    readonly 600: string;
    readonly 700: string;
    readonly 800: string;
    readonly 900: string;
  };
}

export const lightPalette: Palette = {
  brown: {
    50: '#FAF5EF',
    100: '#F0E5D6',
    200: '#D4BA8A',
    300: '#A87844',
    400: '#9B7043',
    500: '#865C35',
    600: '#745030',
    700: '#5D432F',
    800: '#4F321B',
    900: '#2E1D0F',
  },
  green: {
    50: '#F4FBF6',
    100: '#E8F5EC',
    200: '#DEF3E4',
    300: '#C3D9CB',
    400: '#A5C1AF',
    500: '#8BAA97',
    600: '#6F8E7B',
    700: '#5A7A66',
    800: '#4A6554',
    900: '#3A5043',
  },
  neutral: {
    50: '#FDFCFA',
    100: '#F5F4F0',
    200: '#E8E7E3',
    300: '#D9D9D0',
    400: '#B8B7B0',
    500: '#9A9990',
    600: '#7A7970',
    700: '#5A5950',
    800: '#3A3930',
    900: '#1A1910',
  },
};

export const darkPalette: Palette = {
  brown: {
    50: '#2E1D0F',
    100: '#4F321B',
    200: '#5D432F',
    300: '#745030',
    400: '#865C35',
    500: '#9B7043',
    600: '#A87844',
    700: '#D4BA8A',
    800: '#F0E5D6',
    900: '#FAF5EF',
  },
  green: {
    50: '#3A5043',
    100: '#4A6554',
    200: '#5A7A66',
    300: '#6F8E7B',
    400: '#8BAA97',
    500: '#A5C1AF',
    600: '#C3D9CB',
    700: '#DEF3E4',
    800: '#E8F5EC',
    900: '#F4FBF6',
  },
  neutral: {
    50: '#1A1910',
    100: '#3A3930',
    200: '#5A5950',
    300: '#7A7970',
    400: '#9A9990',
    500: '#B8B7B0',
    600: '#D9D9D0',
    700: '#E8E7E3',
    800: '#F5F4F0',
    900: '#FDFCFA',
  },
};
