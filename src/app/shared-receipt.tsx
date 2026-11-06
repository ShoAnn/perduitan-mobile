import { router } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ReceiptKind } from '@/utils/receipt-parser';
import { receiptScanUnavailableKey, scanReceiptFromUri } from '@/utils/receipt-scan';
import { logShareIntent } from '@/utils/share-intent-log';
import { formatCentsForEditing } from '@/utils/transactions';

/**
 * Landing screen for receipt images shared into the app from another app. The
 * image has no originating in-app screen, so it asks which transaction type it
 * is, then OCRs it and opens the matching form already prefilled.
 */
export default function SharedReceiptScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isReady, shareIntent, resetShareIntent } = useShareIntentContext();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const files = shareIntent.files ?? [];
  const image = files.find((file) => file.mimeType?.startsWith('image/')) ?? files[0];

  // Log the payload once per change (metadata only, never file contents).
  // Deduped by fingerprint so re-renders don't spam the dev console.
  useEffect(() => {
    const currentFiles = shareIntent.files ?? [];
    const fingerprint = JSON.stringify({
      type: shareIntent.type,
      files: currentFiles.map((file) => ({
        fileName: file.fileName,
        mimeType: file.mimeType,
        size: file.size,
        width: file.width,
        height: file.height,
      })),
      hasText: Boolean(shareIntent.text),
      hasWebUrl: Boolean(shareIntent.webUrl),
    });
    logShareIntent('payload received', { isReady, fingerprint });
  }, [isReady, shareIntent]);

  const handleImport = async (kind: ReceiptKind) => {
    if (!image || isScanning) {
      return;
    }

    logShareIntent('import started', {
      kind,
      fileName: image.fileName,
      mimeType: image.mimeType,
      size: image.size,
    });
    setIsScanning(true);
    setError(null);

    const result = await scanReceiptFromUri(image.path, kind);

    if (result.status === 'unavailable') {
      logShareIntent('import unavailable', result.reason);
      setError(t(receiptScanUnavailableKey(result.reason)));
      setIsScanning(false);
      return;
    }

    if (result.status === 'error') {
      logShareIntent('import error', result.messageKey);
      setError(t(result.messageKey));
      setIsScanning(false);
      return;
    }

    const { receipt } = result;
    const params: Record<string, string> = { scanned: '1' };
    if (receipt.amountCents !== null) {
      params.amount = formatCentsForEditing(receipt.amountCents);
    }
    if (receipt.occurredOn) {
      params.occurredOn = receipt.occurredOn;
    }
    if (receipt.description) {
      params.description = receipt.description;
    }
    if (receipt.suggestedCategoryName) {
      params.categoryName = receipt.suggestedCategoryName;
    }
    if (receipt.warnings.length > 0) {
      params.scanNotice = receipt.warnings[0];
    }

    resetShareIntent();
    logShareIntent('import succeeded, opening form', {
      pathname: kind === 'income' ? '/add-income' : '/add-expense',
      params,
    });
    router.replace({
      pathname: kind === 'income' ? '/add-income' : '/add-expense',
      params,
    });
  };

  if (!isReady) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!image) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
          {t('share.noImage')}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/')}
          style={({ pressed }) => [
            styles.option,
            { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
          ]}>
          <ThemedText type="smallBold">{t('share.goHome')}</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Image source={{ uri: image.path }} resizeMode="contain" style={styles.preview} />

      <ThemedText type="smallBold">{t('share.prompt')}</ThemedText>

      {error ? (
        <ThemedText type="small" style={{ color: theme.negative }}>
          {error}
        </ThemedText>
      ) : null}

      {isScanning ? (
        <View style={styles.reading}>
          <ActivityIndicator />
          <ThemedText type="small" themeColor="textSecondary">
            {t('scan.readingReceipt')}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('share.addExpense')}
            onPress={() => handleImport('expense')}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
            ]}>
            <ThemedText themeColor="accent" style={styles.optionIcon}>
              ▣
            </ThemedText>
            <ThemedText type="smallBold">{t('share.addExpense')}</ThemedText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('share.addIncome')}
            onPress={() => handleImport('income')}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
            ]}>
            <ThemedText themeColor="positive" style={styles.optionIcon}>
              ▣
            </ThemedText>
            <ThemedText type="smallBold">{t('share.addIncome')}</ThemedText>
          </Pressable>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  message: {
    textAlign: 'center',
  },
  preview: {
    width: '100%',
    height: 320,
    borderRadius: Spacing.three,
  },
  actions: {
    gap: Spacing.three,
  },
  reading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
    minHeight: 52,
  },
  optionIcon: {
    fontSize: 20,
  },
});
