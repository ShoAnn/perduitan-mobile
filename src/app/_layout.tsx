import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db/schema';
import '@/i18n';
import { DEBUG_SHARE_INTENT, logShareIntent } from '@/utils/share-intent-log';

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <ShareIntentProvider
      options={{
        // Share-intent debug logs follow the same testing flag as the scanner.
        debug: DEBUG_SHARE_INTENT,
        resetOnBackground: true,
        // No onResetShareIntent auto-redirect: resetShareIntent() fires it
        // synchronously, so redirecting to '/' here would race the form
        // navigation in shared-receipt (double replace, form route lost).
        // shared-receipt owns navigation after a manual reset.
      }}>
      <ShareIntentRedirect />
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
              <Stack.Screen
                name="manage-categories"
                options={{ title: t('navigation.categories') }}
              />

              <Stack.Screen name="edit-account" options={{ title: t('navigation.editAccount') }} />
              <Stack.Screen name="add-account" options={{ title: t('navigation.addAccount') }} />
              <Stack.Screen name="history" options={{ title: t('navigation.history') }} />
              <Stack.Screen name="analytics" options={{ title: t('navigation.analytics') }} />
              <Stack.Screen name="settings" options={{ title: t('navigation.settings') }} />
              <Stack.Screen
                name="transaction/[id]"
                options={{ title: t('navigation.transaction') }}
              />
              <Stack.Screen
                name="edit-transaction"
                options={{ title: t('navigation.editTransaction') }}
              />
              <Stack.Screen name="shared-receipt" options={{ title: t('share.title') }} />
            </Stack>
          </SQLiteProvider>
        </Suspense>
      </ThemeProvider>
    </ShareIntentProvider>
  );
}

/**
 * Android share intents never arrive as a deeplink — `expo-share-intent` polls
 * the native module and only fills the context. Without this listener the
 * payload sits unused on the home screen. (`+native-intent.ts` covers iOS,
 * where the share arrives as a `dataUrl=` deeplink.)
 */
function ShareIntentRedirect() {
  const { isReady, hasShareIntent } = useShareIntentContext();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isReady || !hasShareIntent || pathname === '/shared-receipt') {
      return;
    }
    logShareIntent('routing to /shared-receipt from', pathname);
    router.replace('/shared-receipt');
  }, [isReady, hasShareIntent, pathname, router]);

  return null;
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
