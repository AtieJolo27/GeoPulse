import { useApp } from './AppContext';

export function useThemeColors() {
  const { isDarkMode } = useApp();

  return {
    // Base backgrounds
    // Keep every farmer-facing tab on a calm white canvas. Cards provide the hierarchy.
    bg: '#FFFFFF',
    cardBg: isDarkMode ? '#14251A' : '#FFFFFF',
    cardBgAlt: isDarkMode ? '#1C3323' : '#FFFFFF',
    
    // Text colors
    text: isDarkMode ? '#F4FAF3' : '#183322',
    subText: isDarkMode ? '#A7C6AD' : '#5B7161',
    mutedText: isDarkMode ? '#77917D' : '#748078',
    greenText: isDarkMode ? '#8FD19E' : '#28784A',
    
    // Borders
    border: isDarkMode ? '#294332' : '#D6E2D8',
    cardBorder: isDarkMode ? '#294332' : '#DDE7DF',
    
    // Headers
    headerBg: isDarkMode ? '#123E26' : '#1B5E37',
    headerText: '#F0FDF4',
    
    // Sensor cards
    sensorCardBg: isDarkMode ? '#14251A' : '#FFFFFF',
    sensorCardBorder: isDarkMode ? '#294332' : '#E3ECE3',
    
    // Soil card
    soilCardBg: isDarkMode ? '#173923' : '#FFFFFF',
    soilCardBorder: isDarkMode ? '#2D553A' : '#D7E5D9',
    
    // Utility
    white: isDarkMode ? '#14281A' : '#FFFFFF',
    isDarkMode,
    
    // Accent colors
    primary: '#28784A',
    primaryLight: '#4C9A68',
    primaryDark: '#1B5E37',
    success: '#2E7D4A',
    warning: '#B7791F',
    danger: '#C2413A',
    inputBg: isDarkMode ? '#102116' : '#FFFFFF',
    
    // Progress bar colors
    progressTrack: isDarkMode ? '#1A3522' : '#E5E7EB',
    
    // For charts
    chartBg: isDarkMode ? '#14281A' : '#FFFFFF',
    chartLabel: isDarkMode ? '#86EFAC' : '#4A6741',
    chartGrid: isDarkMode ? '#1A3522' : '#BBF7D0',
    chartLine: isDarkMode ? '#4ADE80' : '#16A34A',
    chartDot: isDarkMode ? '#22C55E' : '#0D5E33',
  };
}

