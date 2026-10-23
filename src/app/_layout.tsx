import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="add-income" options={{ title: 'Add income' }} />
        <Stack.Screen name="add-expense" options={{ title: 'Add expense' }} />
        <Stack.Screen
          name="new-category"
          options={{ presentation: 'modal', title: 'New category' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
