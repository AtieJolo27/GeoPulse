import { useApp } from '@/shared/appLib/AppContext';

export function useThemeColors() {
  const { isDarkMode } = useApp();

  return {
    // Base backgrounds
    bg: isDarkMode ? '#0D1917' : '#F3F6F3',
    cardBg: isDarkMode ? '#162622' : '#FFFFFF',
    cardBgAlt: isDarkMode ? '#213A32' : '#EAF3ED',
    
    // Text colors
    text: isDarkMode ? '#EDF5EF' : '#172F28',
    subText: isDarkMode ? '#AEC4B9' : '#556D63',
    mutedText: isDarkMode ? '#94ADA1' : '#637B70',
    greenText: isDarkMode ? '#9CDEB7' : '#216E4F',
    
    // Borders
    border: isDarkMode ? '#30473D' : '#DCE6DF',
    cardBorder: isDarkMode ? '#30473D' : '#E2EAE4',
    
    // Headers
    headerBg: isDarkMode ? '#122E26' : '#174D3B',
    headerText: '#F0FDF4',
    
    // Sensor cards
    sensorCardBg: isDarkMode ? '#162622' : '#FFFFFF',
    sensorCardBorder: isDarkMode ? '#30473D' : '#E2EAE4',
    
    // Soil card
    soilCardBg: isDarkMode ? '#173923' : '#FFFFFF',
    soilCardBorder: isDarkMode ? '#2D553A' : '#D7E5D9',
    
    // Utility
    white: isDarkMode ? '#14281A' : '#FFFFFF',
    isDarkMode,
    
    // Accent colors
    primary: isDarkMode ? '#32815D' : '#246F50',
    primaryLight: '#69AC83',
    primaryDark: isDarkMode ? '#9CDEB7' : '#174D3B',
    success: '#2E7D4A',
    warning: '#B7791F',
    danger: '#C2413A',
    inputBg: isDarkMode ? '#10201B' : '#F7FAF7',
    
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
