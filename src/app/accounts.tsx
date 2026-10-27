import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getAccountBalance } from '@/db/transactions';
import { useAccounts } from '@/stores/accounts';
import { useEffect, useState } from 'react';

export default function AccountsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const accounts = useAccounts(db);
  const [balances, setBalances] = useState<Record<number, number>>({});

  useEffect(() => {
    for (const account of accounts) {
      getAccountBalance(db, account.id).then((bal) => {
        setBalances((prev) => ({ ...prev, [account.id]: bal }));
      });
    }
  }, [db, accounts]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={accounts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/edit-account', params: { id: String(item.id) } })
              }
              accessibilityRole="button"
              accessibilityLabel={`Edit account ${item.name}`}>
              {({ pressed }) => (
                <ThemedView
                  type="backgroundElement"
                  style={[styles.card, pressed && styles.pressed]}>
                  <View style={styles.cardRow}>
                    <View style={styles.accountInfo}>
                      <ThemedText type="default">{item.name}</ThemedText>
                      <ThemedText themeColor="textSecondary" type="small">
                        {item.currency}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={styles.balance}>
                      {new Intl.NumberFormat('en-US').format(
                        (balances[item.id] ?? 0) / 100
                      )}
                    </ThemedText>
                  </View>
                </ThemedView>
              )}
            </Pressable>
          )}
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  listContent: {
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountInfo: {
    gap: Spacing.half,
  },
  balance: {
    fontSize: 18,
  },
});
