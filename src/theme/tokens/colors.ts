export interface SurfaceColors {
  readonly background: string;
  readonly surface: string;
  readonly surfaceSecondary: string;
  readonly surfaceTertiary: string;
  readonly surfaceHover: string;
  readonly surfacePressed: string;
  readonly elevation1: string;
  readonly elevation2: string;
  readonly elevation3: string;
  readonly elevation4: string;
  readonly elevation5: string;
}

export interface BorderColors {
  readonly border: string;
  readonly borderStrong: string;
  readonly borderSubtle: string;
}

export interface TextColors {
  readonly primary: string;
  readonly secondary: string;
  readonly tertiary: string;
  readonly disabled: string;
  readonly onAccent: string;
}

export interface BrandScale {
  readonly base: string;
  readonly hover: string;
  readonly pressed: string;
  readonly light: string;
  readonly muted: string;
}

export interface SemanticTokens {
  readonly success: string;
  readonly successLight: string;
  readonly successBorder: string;
  readonly warning: string;
  readonly warningLight: string;
  readonly warningBorder: string;
  readonly error: string;
  readonly errorLight: string;
  readonly errorBorder: string;
  readonly onErrorContainer: string;
  readonly info: string;
  readonly infoLight: string;
  readonly infoBorder: string;
}

export interface ColorTokens {
  readonly surfaces: SurfaceColors;
  readonly borders: BorderColors;
  readonly text: TextColors;
  readonly primary: BrandScale;
  readonly secondary: BrandScale;
  readonly water: BrandScale;
  readonly warm: BrandScale;
  readonly semantic: SemanticTokens;
}

export const lightColors: ColorTokens = {
  surfaces: {
    background: '#F7F4EC',
    surface: '#FFFDF8',
    surfaceSecondary: '#F0ECE2',
    surfaceTertiary: '#E5DFD2',
    surfaceHover: '#F4F0E7',
    surfacePressed: '#E3DDD0',
    elevation1: '#FBF7EF',
    elevation2: '#F8F3EA',
    elevation3: '#F4EDE2',
    elevation4: '#F1E9DC',
    elevation5: '#EDE4D5',
  },
  borders: {
    border: '#DDD6C8',
    borderStrong: '#C8BFAF',
    borderSubtle: '#EAE5DA',
  },
  text: {
    primary: '#29251F',
    secondary: '#625C52',
    tertiary: '#827B70',
    disabled: '#AAA398',
    onAccent: '#FFFDF8',
  },
  primary: {
    base: '#5B4636',
    hover: '#4D3A2D',
    pressed: '#403026',
    light: '#E8DED2',
    muted: '#D4C5B6',
  },
  secondary: {
    base: '#56745A',
    hover: '#49654D',
    pressed: '#3D5641',
    light: '#E1EADF',
    muted: '#C7D5C8',
  },
  water: {
    base: '#6F9FA3',
    hover: '#628E92',
    pressed: '#557D81',
    light: '#E2EFF0',
    muted: '#C8DDDF',
  },
  warm: {
    base: '#B58A52',
    hover: '#9F7847',
    pressed: '#89653D',
    light: '#F2E8D7',
    muted: '#DECBAE',
  },
  semantic: {
    success: '#4F7A59',
    successLight: '#E3EEE5',
    successBorder: '#C2D8C6',
    warning: '#A87532',
    warningLight: '#F5EBD9',
    warningBorder: '#E3CEAA',
    error: '#B4554F',
    errorLight: '#F5E4E1',
    errorBorder: '#E4C4C0',
    onErrorContainer: '#6B2A26',
    info: '#557E91',
    infoLight: '#E3EDF1',
    infoBorder: '#C5D7DF',
  },
};

export const darkColors: ColorTokens = {
  surfaces: {
    background: '#181612',
    surface: '#211D18',
    surfaceSecondary: '#29241E',
    surfaceTertiary: '#332D25',
    surfaceHover: '#2D2822',
    surfacePressed: '#383127',
    elevation1: '#231E19',
    elevation2: '#262019',
    elevation3: '#2A231B',
    elevation4: '#2D261D',
    elevation5: '#302920',
  },
  borders: {
    border: '#3A342C',
    borderStrong: '#4B4338',
    borderSubtle: '#302B25',
  },
  text: {
    primary: '#F4F0E7',
    secondary: '#C5BEB2',
    tertiary: '#999185',
    disabled: '#69635A',
    onAccent: '#FFFDF8',
  },
  primary: {
    base: '#B99A7E',
    hover: '#C6AA91',
    pressed: '#A88A70',
    light: '#49392E',
    muted: '#624D3E',
  },
  secondary: {
    base: '#88A88C',
    hover: '#99B79D',
    pressed: '#75977B',
    light: '#2C3B2E',
    muted: '#405443',
  },
  water: {
    base: '#88B5B8',
    hover: '#99C1C4',
    pressed: '#759FA3',
    light: '#28393A',
    muted: '#3B5556',
  },
  warm: {
    base: '#D0A866',
    hover: '#DBB77D',
    pressed: '#BB9356',
    light: '#3E3425',
    muted: '#59482F',
  },
  semantic: {
    success: '#79B184',
    successLight: '#293B2D',
    successBorder: '#405D46',
    warning: '#D0A25D',
    warningLight: '#403421',
    warningBorder: '#645135',
    error: '#D77B73',
    errorLight: '#422925',
    errorBorder: '#663D38',
    onErrorContainer: '#F0B4AE',
    info: '#86B0C5',
    infoLight: '#293840',
    infoBorder: '#3E5967',
  },
};