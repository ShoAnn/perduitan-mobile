import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getTransactionById, type TransactionWithNames } from '@/db/transactions';
import { useTheme } from '@/hooks/use-theme';
import { categoryLabel } from '@/utils/category-names';
import { formatCurrency, formatTimestamp } from '@/utils/format';
import { formatDate, parseEditableDate } from '@/utils/transactions';

function formatOccurredOn(value: string): string {
  const date = parseEditableDate(value);
  return date ? formatDate(date) : value;
}

export default function TransactionDetailsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id?: string }>();
  const parsedId = Number(params.id);
  const transactionId = Number.isFinite(parsedId) ? parsedId : null;

  // `undefined` while loading, `null` when the transaction does not exist.
  const [transaction, setTransaction] = useState<TransactionWithNames | null | undefined>(undefined);

  // Refetch whenever the screen regains focus so edits are reflected.
  useFocusEffect(
    useCallback(() => {
      if (transactionId === null) {
        return;
      }

      let isActive = true;

      getTransactionById(db, transactionId)
        .then((result) => {
          if (isActive) {
            setTransaction(result);
          }
        })
        .catch((error: unknown) => {
          console.error('Failed to load the transaction', error);
          if (isActive) {
            setTransaction(null);
          }
        });

      return () => {
        isActive = false;
      };
    }, [db, transactionId])
  );

  if (transactionId === null || transaction === null) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: t('navigation.transaction') }} />
        <ThemedText type="small" themeColor="textSecondary">
          {t('transaction.notFound')}
        </ThemedText>
      </ThemedView>
    );
  }

  if (transaction === undefined) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ title: t('navigation.transaction') }} />
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const isIncome = transaction.amount_cents > 0;
  const amountColor = isIncome ? theme.positive : theme.negative;

  const details = [
    { label: t('transaction.type'), value: isIncome ? t('transaction.income') : t('transaction.expense') },
    { label: t('transaction.account'), value: transaction.account_name ?? t('transaction.unknownAccount') },
    {
      label: t('transaction.category'),
      value: transaction.category_name
        ? categoryLabel(transaction.category_name, t)
        : t('common.uncategorized'),
    },
    { label: t('transaction.date'), value: formatOccurredOn(transaction.occurred_on) },
    {
      label: t('transaction.added'),
      value: formatTimestamp(transaction.created_at, transaction.created_at),
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: isIncome ? t('navigation.incomeDetails') : t('navigation.expenseDetails'),
          headerRight: () => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/edit-transaction',
                  params: { id: String(transaction.id) },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={t('transaction.editAccessibility')}
              hitSlop={Spacing.two}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                {t('common.edit')}
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <ThemedView type="backgroundElement" style={styles.hero}>
              <ThemedText style={[styles.amount, { color: amountColor }]}>
                {isIncome ? '+' : '−'}
                {formatCurrency(transaction.amount_cents)}
              </ThemedText>
            </ThemedView>

            {transaction.description ? (
              <ThemedView type="backgroundElement" style={styles.descriptionCard}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('transaction.description')}
                </ThemedText>
                <ThemedText>{transaction.description}</ThemedText>
              </ThemedView>
            ) : 
              <ThemedView type="backgroundElement" style={styles.descriptionCard}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t('transaction.description')}
                </ThemedText>
                <ThemedText>{t('transaction.none')}</ThemedText>
              </ThemedView>
            }

            <ThemedView type="backgroundElement" style={styles.detailsCard}>
              {details.map((detail, index) => (
                <View
                  key={detail.label}
                  style={[
                    styles.detailRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: theme.backgroundSelected,
                    },
                  ]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {detail.label}
                  </ThemedText>
                  <ThemedText type="smallBold" style={styles.detailValue}>
                    {detail.value}
                  </ThemedText>
                </View>
              ))}
            </ThemedView>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  scrollContent: {
    alignItems: 'center',
    padding: Spacing.four,
    paddingBottom: Spacing.six,
  },
  content: {
    width: '100%',
    maxWidth: 520,
    gap: Spacing.three,
  },
  hero: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
  },
  heroLabel: {
    letterSpacing: 0.5,
  },
  amount: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: 700,
    textAlign: 'center',
  },
  descriptionCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  detailsCard: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    minHeight: 48,
  },
  detailValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  headerButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
