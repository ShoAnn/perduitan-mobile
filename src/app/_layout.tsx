import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/schema';

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Suspense fallback={<DatabaseFallback />}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="add-income" options={{ title: 'Add income' }} />
            <Stack.Screen name="add-expense" options={{ title: 'Add expense' }} />
            <Stack.Screen
              name="new-category"
              options={{ presentation: 'modal', title: 'New category' }}
            />

            <Stack.Screen name="edit-account" options={{ title: 'Edit account' }} />
            <Stack.Screen name="add-account" options={{ title: 'Add account' }} />
            <Stack.Screen name="history" options={{ title: 'History' }} />
            <Stack.Screen name="transaction/[id]" options={{ title: 'Transaction' }} />
          </Stack>
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}

function DatabaseFallback() {
  return (
    <ThemedView style={styles.fallback}>
      <ActivityIndicator />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
