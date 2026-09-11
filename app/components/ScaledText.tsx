import { useApp } from '@/app/lib/AppContext';
import React from 'react';
import { Text, TextProps } from 'react-native';

interface ScaledTextProps extends TextProps {
  children: React.ReactNode;
}

/**
 * A Text component that automatically applies the user's font size preference.
 * Use this instead of `<Text>` for text that should scale.
 */
export default function ScaledText({ style, children, ...props }: ScaledTextProps) {
  const { fontScale } = useApp();

  return (
    <Text
      style={[
        style,
        fontScale !== 1 && { fontSize: (style as any)?.fontSize ? (style as any).fontSize * fontScale : undefined },
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}

