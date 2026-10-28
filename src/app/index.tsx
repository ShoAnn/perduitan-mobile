import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  BackHandler,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  ToastAndroid,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, MaxContentWidth } from '@/constants/theme';
import { archiveAccount } from '@/db/accounts';
import { getAccountBalance, getLastUsedAccountId } from '@/db/transactions';
import { refreshAccounts, useAccounts } from '@/stores/accounts';
import { useCallback, useRef, useState } from 'react';

export default function HomeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const accounts = useAccounts(db);
  const [lastAccountId, setLastAccountId] = useState<number | null>(null);
  const [balance, setBalance] = useState<number>(0);

  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const backPressedOnce = useRef(false);
  const backResetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastAccount = accounts.find((a) => a.id === lastAccountId) ?? accounts[0] ?? null;

  // Any transaction changes which account was used last, so refresh whenever
  // this screen regains focus (e.g. after saving income or an expense).
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      getLastUsedAccountId(db)
        .then((id) => {
          if (isActive) {
            setLastAccountId(id);
          }
        })
        .catch((error: unknown) => {
          console.error('Failed to load the last used account', error);
        });

      return () => {
        isActive = false;
      };
    }, [db])
  );

  useFocusEffect(
    useCallback(() => {
      if (!lastAccount) {
        return;
      }

      let isActive = true;

      getAccountBalance(db, lastAccount.id)
        .then((bal) => {
          if (isActive) {
            setBalance(bal);
          }
        })
        .catch((error: unknown) => {
          console.error('Failed to load the account balance', error);
        });

      return () => {
        isActive = false;
      };
    }, [db, lastAccount])
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      for (const account of accounts) {
        getAccountBalance(db, account.id)
          .then((bal) => {
            if (isActive) {
              setBalances((prev) => ({ ...prev, [account.id]: bal }));
            }
          })
          .catch((error: unknown) => {
            console.error('Failed to load account balances', error);
          });
      }

      return () => {
        isActive = false;
      };
    }, [db, accounts])
  );

  // Require a second back press to leave the app from the home screen.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') {
        return;
      }

      const onBackPress = () => {
        if (backPressedOnce.current) {
          return false;
        }

        backPressedOnce.current = true;
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);

        backResetTimeout.current = setTimeout(() => {
          backPressedOnce.current = false;
        }, 2000);

        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        subscription.remove();
        if (backResetTimeout.current) {
          clearTimeout(backResetTimeout.current);
          backResetTimeout.current = null;
        }
        backPressedOnce.current = false;
      };
    }, [])
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable
          onPress={() => {
            if (lastAccount) {
              setSelectedAccountId(null);
              setShowAccountsModal(true);
            } else {
              router.push('/add-account');
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={lastAccount ? 'Last used account' : 'Add account'}
          style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }, styles.lastUsedSection]}>
          <ThemedView type="backgroundElement" style={styles.lastUsedCard}>
            <ThemedText type="subtitle" style={styles.balanceText}>
              {lastAccount
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'IDR' }).format(
                    balance / 100
                  )
                : 'Add account'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.accountName}>
              {lastAccount ? lastAccount.name : "You haven't add any accounts yet"}
            </ThemedText>
          </ThemedView>
        </Pressable>

        <ThemedView style={styles.actionRow}>
          <ActionButton
            href="/add-income"
            glyph="+"
            label="Add income"
            accessibilityLabel="Add income"
            glyphColor="positive"
          />
          <ActionButton
            href="/add-expense"
            glyph="−"
            label="Add expense"
            accessibilityLabel="Add expense"
            glyphColor="negative"
          />
        </ThemedView>

        <Pressable
          onPress={() => router.push('/history')}
          accessibilityRole="button"
          accessibilityLabel="History"
          style={({ pressed }) => [styles.historyButton, pressed && { opacity: 0.8 }]}>
          <ThemedView type="backgroundElement" style={styles.historyInner}>
            <ThemedText type="subtitle">History</ThemedText>
          </ThemedView>
        </Pressable>
      </SafeAreaView>

      <Modal
        visible={showAccountsModal}
        transparent
        animationType="none"
        onRequestClose={() => {
          setSelectedAccountId(null);
          setConfirmDeleteId(null);
          setShowAccountsModal(false);
        }}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setSelectedAccountId(null);
            setConfirmDeleteId(null);
            setShowAccountsModal(false);
          }}
          accessibilityRole="button"
          accessibilityLabel="Close accounts">
          <ThemedView
            type="backgroundElement"
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
            onResponderRelease={() => {
              // Tapping the grey area between cards resets to the first state.
              setSelectedAccountId(null);
              setConfirmDeleteId(null);
            }}>
            <FlatList
              data={accounts}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    if (selectedAccountId !== null) {
                      // Switching focus: reset to the first state (account info shown).
                      setSelectedAccountId(null);
                      setConfirmDeleteId(null);
                      return;
                    }
                    setSelectedAccountId(item.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={item.name}>
                  {({ pressed }) => (
                    <ThemedView
                      type="backgroundElement"
                      style={[styles.modalCard, pressed && styles.modalPressed]}>
                      <View style={[styles.modalCardRow, selectedAccountId === item.id && { opacity: 0 }]}>
                        <View style={styles.modalAccountInfo}>
                          <ThemedText type="default">{item.name}</ThemedText>
                          <ThemedText themeColor="textSecondary" type="small">
                            {item.currency}
                          </ThemedText>
                        </View>
                        <ThemedText type="smallBold" style={styles.modalBalance}>
                          {new Intl.NumberFormat('en-US').format(
                            (balances[item.id] ?? 0) / 100
                          )}
                        </ThemedText>
                      </View>
                      {selectedAccountId === item.id ? (
                        <View style={styles.modalSelectedRow}>
                          <Pressable
                            onPress={() => {
                              setShowAccountsModal(false);
                              router.push({ pathname: '/edit-account', params: { id: String(item.id) } });
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit account ${item.name}`}
                            style={({ pressed }) => [styles.modalBigButton, pressed && styles.modalPressed]}>
                            <ThemedText style={styles.modalBigText}>✎</ThemedText>
                          </Pressable>
                          <Pressable
                            onPress={async () => {
                              if (confirmDeleteId !== item.id) {
                                setConfirmDeleteId(item.id);
                                return;
                              }
                              setConfirmDeleteId(null);
                              setSelectedAccountId(null);
                              setShowAccountsModal(false);
                              await archiveAccount(db, item.id);
                              await refreshAccounts(db);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={
                              confirmDeleteId === item.id
                                ? `Confirm delete account ${item.name}`
                                : `Delete account ${item.name}`
                            }
                            style={({ pressed }) => [
                              styles.modalBigButton,
                              confirmDeleteId === item.id && styles.modalBigButtonDanger,
                              pressed && styles.modalPressed,
                            ]}>
                            <ThemedText
                              style={
                                confirmDeleteId === item.id
                                  ? styles.modalConfirmText
                                  : styles.modalBigText
                              }>
                              {confirmDeleteId === item.id ? 'Confirm delete?' : '🗑'}
                            </ThemedText>
                          </Pressable>
                        </View>
                      ) : null}
                    </ThemedView>
                  )}
                </Pressable>
              )}
              contentContainerStyle={styles.modalListContent}
              ListFooterComponent={
                <Pressable
                  onPress={() => {
                    setShowAccountsModal(false);
                    router.push('/add-account');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Add account"
                  style={({ pressed }) => [
                    styles.modalCard,
                    styles.addAccountCard,
                    pressed && styles.modalPressed,
                  ]}>
                  <ThemedText type="default" style={styles.addAccountText}>
                    + Add account
                  </ThemedText>
                </Pressable>
              }
            />
          </ThemedView>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
  },
  lastUsedSection: {
    alignSelf: 'stretch',
    width: '100%',
  },
  lastUsedCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    minHeight: 120,
  },
  balanceText: {
    fontSize: 32,
    fontWeight: 700,
    textAlign: 'center',
  },
  accountName: {
    textAlign: 'center',
  },
  historyButton: {
    alignSelf: 'stretch',
    width: '100%',
  },
  historyInner: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: Spacing.three,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 520,
    height: '50%',
    borderRadius: Spacing.four,
    overflow: 'hidden',
  },
  modalListContent: {
    gap: Spacing.three,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  modalCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    backgroundColor: '#000',
    minHeight: 100,
  },
  modalPressed: {
    opacity: 0.7,
  },
  modalCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalAccountInfo: {
    gap: Spacing.half,
  },
  modalBalance: {
    fontSize: 18,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  modalActionButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  modalActionText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalSelectedRow: {
    ...StyleSheet.absoluteFill, // covers the full card, including its padding
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.two,           // small margin so the buttons sit inside the rounded corners
  },
  modalBigButton: {
    flex: 1,
    justifyContent: 'center',       // centers the label vertically
    borderRadius: Spacing.three,
    backgroundColor: '#1c1c1e',
    alignItems: 'center',
  },
  modalBigButtonDanger: {
    backgroundColor: '#E03131',     // theme "negative" red for the confirm state
  },
  modalBigText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  addAccountCard: {
    minHeight: 22,
    backgroundColor: '#e5e5ea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addAccountText: {
    color: '#1c1c1e',
  },
});
