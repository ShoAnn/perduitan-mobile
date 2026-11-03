import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/schema';
import '@/i18n';

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Suspense fallback={<DatabaseFallback />}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: true, title: '' }} />
            <Stack.Screen name="add-income" options={{ title: t('navigation.addIncome') }} />
            <Stack.Screen name="add-expense" options={{ title: t('navigation.addExpense') }} />
            <Stack.Screen
              name="new-category"
              options={{ presentation: 'modal', title: t('navigation.newCategory') }}
            />
            <Stack.Screen name="manage-categories" options={{ title: t('navigation.categories') }} />

            <Stack.Screen name="edit-account" options={{ title: t('navigation.editAccount') }} />
            <Stack.Screen name="add-account" options={{ title: t('navigation.addAccount') }} />
            <Stack.Screen name="history" options={{ title: t('navigation.history') }} />
            <Stack.Screen name="analytics" options={{ title: t('navigation.analytics') }} />
            <Stack.Screen name="settings" options={{ title: t('navigation.settings') }} />
            <Stack.Screen name="transaction/[id]" options={{ title: t('navigation.transaction') }} />
            <Stack.Screen
              name="edit-transaction"
              options={{ title: t('navigation.editTransaction') }}
            />
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
