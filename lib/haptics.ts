/**
 * Haptic feedback utility using expo-haptics.
 * Provides consistent vibration feedback across the app.
 */
import * as Haptics from 'expo-haptics';

/** Light tap — for button presses, zone switches */
export function lightHaptic() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Silently fail if haptics unavailable
  }
}

/** Medium tap — for confirmations, saves */
export function mediumHaptic() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Silently fail
  }
}

/** Heavy tap — for warnings, alerts */
export function heavyHaptic() {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // Silently fail
  }
}

/** Success notification — for completed actions */
export function successHaptic() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Silently fail
  }
}

/** Error notification — for failed actions */
export function errorHaptic() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Silently fail
  }
}

/** Warning notification — for alerts */
export function warningHaptic() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Silently fail
  }
}

