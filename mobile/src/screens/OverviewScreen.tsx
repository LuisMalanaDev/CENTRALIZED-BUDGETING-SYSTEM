import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';
import { api } from '../api/client';
import { DateFilterBar } from '../components/DateFilterBar';
import { DateRangeFilter, Transaction, Account } from '../types';
import { getCategoryName } from '../utils/format';

interface OverviewScreenProps {
  onOpenQuickLog: () => void;
  filter: DateRangeFilter;
  onFilterChange: (filter: DateRangeFilter) => void;
}

export const OverviewScreen: React.FC<OverviewScreenProps> = ({
  onOpenQuickLog,
  filter,
  onFilterChange,
}) => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [metrics, setMetrics] = useState({
    totalInflow: 0,
    totalOutflow: 0,
    netCashflow: 0,
    budgetCap: 0,
  });

  const [txPage, setTxPage] = useState(1);
  const TX_PAGE_SIZE = 6;

  useEffect(() => {
    setTxPage(1);
  }, [filter]);

  const totalTxPages = Math.max(1, Math.ceil(transactions.length / TX_PAGE_SIZE));
  const paginatedRecent = transactions.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE);

  const currencySymbol = user?.currency === 'USD' ? '$' : '₱';

  const fetchData = useCallback(async () => {
    try {
      // Build query string for active date range filter
      let query = '';
      if (filter.startDate && filter.endDate) {
        query = `?startDate=${filter.startDate}&endDate=${filter.endDate}`;
      }

      const [accountsRes, transRes, metricsRes] = await Promise.all([
        api.get<{ accounts: Account[] }>('/api/accounts').catch(() => ({ accounts: [] })),
        api.get<{ transactions: Transaction[] }>(`/api/transactions${query}`).catch(() => ({ transactions: [] })),
        api.get<any>(`/api/analytics/summary${query}`).catch(() => null),
      ]);

      setAccounts(accountsRes.accounts || []);
      const txs = transRes.transactions || [];
      setTransactions(txs);

      if (metricsRes) {
        setMetrics({
          totalInflow: metricsRes.totalIncome || 0,
          totalOutflow: metricsRes.totalExpenses || 0,
          netCashflow: (metricsRes.totalIncome || 0) - (metricsRes.totalExpenses || 0),
          budgetCap: metricsRes.budgetCap || 0,
        });
      } else {
        // Compute locally from transactions
        const inflow = txs.filter((t) => t.type === 'INCOME').reduce((acc, t) => acc + t.amount, 0);
        const outflow = txs.filter((t) => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0);
        setMetrics({
          totalInflow: inflow,
          totalOutflow: outflow,
          netCashflow: inflow - outflow,
          budgetCap: 0,
        });
      }
    } catch (e) {
      console.warn('Overview fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [balanceInput, setBalanceInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Reset all wallets to 0
  const handleResetAllToZero = async () => {
    setIsResetting(true);
    try {
      await api.post('/api/accounts/reset').catch(() => null);
      // Also update each account individually if needed to ensure persistence
      await Promise.all(
        accounts.map((a) => api.put(`/api/accounts/${a.id}`, { balance: 0 }).catch(() => null))
      );
      setAccounts((prev) => prev.map((a) => ({ ...a, balance: 0 })));
      setWalletModalVisible(false);
      fetchData();
      Alert.alert('Balances Cleared', 'All wallet balances have been reset to ₱0.00');
    } catch (err: any) {
      Alert.alert('Notice', 'Balances set to ₱0.00 locally.');
      setAccounts((prev) => prev.map((a) => ({ ...a, balance: 0 })));
      setWalletModalVisible(false);
    } finally {
      setIsResetting(false);
    }
  };

  // Save specific account balance
  const handleSaveBalance = async (accId: string) => {
    const num = parseFloat(balanceInput);
    if (isNaN(num)) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    try {
      await api.put(`/api/accounts/${accId}`, { balance: num }).catch(() => null);
      setAccounts((prev) =>
        prev.map((a) => (a.id === accId ? { ...a, balance: num } : a))
      );
      setEditingAccountId(null);
      setBalanceInput('');
      fetchData();
    } catch (err: any) {
      Alert.alert('Notice', 'Updated locally.');
      setAccounts((prev) =>
        prev.map((a) => (a.id === accId ? { ...a, balance: num } : a))
      );
      setEditingAccountId(null);
      setBalanceInput('');
    }
  };

  // Total Money Left across all active wallets & accounts (strictly parse as number)
  const totalMoneyLeft = accounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.white}
        />
      }
    >
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name || 'Commander'}</Text>
        </View>

        <View style={styles.topBarActions}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Cloud Live</Text>
          </View>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={logout}
            accessibilityLabel="Log out"
          >
            <Ionicons name="log-out-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Total Money Left Hero Card */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <Text style={styles.heroLabel}>TOTAL MONEY LEFT</Text>
          <TouchableOpacity
            style={styles.walletBadge}
            onPress={() => setWalletModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="wallet" size={12} color={Colors.white} />
            <Text style={styles.walletBadgeText}>{accounts.length} Wallets</Text>
            <Ionicons name="chevron-forward" size={10} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.heroAmount}>
          {currencySymbol}
          {Number(totalMoneyLeft || 0).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>

        {/* Quick Breakdown of Wallets */}
        {accounts.length > 0 ? (
          <View style={styles.walletPillsRow}>
            {accounts.slice(0, 3).map((acc) => (
              <TouchableOpacity
                key={acc.id}
                style={styles.walletMiniPill}
                onPress={() => setWalletModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.walletMiniName} numberOfLines={1}>
                  {acc.name}:
                </Text>
                <Text style={styles.walletMiniBal}>
                  {currencySymbol}
                  {Math.round(Number(acc.balance) || 0).toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {/* Action Button */}
        <TouchableOpacity
          style={styles.quickAddHeroBtn}
          onPress={onOpenQuickLog}
        >
          <Ionicons name="add" size={18} color={Colors.black} />
          <Text style={styles.quickAddHeroText}>Quick Log Expense / Inflow</Text>
        </TouchableOpacity>
      </View>

      {/* 31-Day Visual Calendar Filter Bar */}
      <DateFilterBar filter={filter} onFilterChange={onFilterChange} />

      {/* 4 Quick Stat Cards (2x2 Grid) */}
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Total Inflow</Text>
              <Ionicons name="arrow-down-circle-outline" size={14} color={Colors.textSecondary} />
            </View>
            <Text style={styles.statValue}>
              +{currencySymbol}
              {Number(metrics.totalInflow || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Total Outflow</Text>
              <Ionicons name="arrow-up-circle-outline" size={14} color={Colors.textSecondary} />
            </View>
            <Text style={styles.statValue}>
              −{currencySymbol}
              {Number(metrics.totalOutflow || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Net Cashflow</Text>
              <Ionicons name="swap-vertical-outline" size={14} color={Colors.textSecondary} />
            </View>
            <Text
              style={[
                styles.statValue,
                Number(metrics.netCashflow || 0) < 0 ? styles.negativeText : undefined,
              ]}
            >
              {Number(metrics.netCashflow || 0) >= 0 ? '+' : '−'}
              {currencySymbol}
              {Math.abs(Number(metrics.netCashflow || 0)).toLocaleString('en-US', {
                minimumFractionDigits: 2,
              })}
            </Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statHeader}>
              <Text style={styles.statLabel}>Active Transactions</Text>
              <Ionicons name="list-outline" size={14} color={Colors.textSecondary} />
            </View>
            <Text style={styles.statValue}>{transactions.length} items</Text>
          </View>
        </View>
      </View>

      {/* Recent Transactions List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Text style={styles.sectionBadge}>{filter.label}</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.white} style={{ marginVertical: 20 }} />
        ) : transactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={32} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No transactions recorded</Text>
            <Text style={styles.emptySubtext}>
              Tap the "+ Quick Log" button to record your first purchase or income.
            </Text>
          </View>
        ) : (
          <View style={styles.txList}>
            {paginatedRecent.map((tx) => {
              const isIncome = tx.type === 'INCOME';
              const dateObj = new Date(tx.date);
              const formattedDate = dateObj.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <View key={tx.id} style={styles.txItem}>
                  <View style={styles.txIconBox}>
                    <Ionicons
                      name={isIncome ? 'arrow-down' : 'arrow-up'}
                      size={14}
                      color={Colors.white}
                    />
                  </View>

                  <View style={styles.txDetails}>
                    <Text style={styles.txCategory} numberOfLines={1}>
                      {getCategoryName(tx.category, 'Expense')}
                    </Text>
                    <Text style={styles.txMeta} numberOfLines={1}>
                      {tx.description || tx.paymentMethod} • {formattedDate}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.txAmount,
                      isIncome ? styles.txAmountIncome : styles.txAmountExpense,
                    ]}
                  >
                    {isIncome ? '+' : '−'}
                    {currencySymbol}
                    {tx.amount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </Text>
                </View>
              );
            })}

            {/* Pagination Controls */}
            {transactions.length > TX_PAGE_SIZE && (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  style={[styles.pageBtn, txPage === 1 && styles.pageBtnDisabled]}
                  disabled={txPage === 1}
                  onPress={() => setTxPage((p) => Math.max(1, p - 1))}
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={txPage === 1 ? Colors.textMuted : Colors.white}
                  />
                  <Text style={[styles.pageBtnText, txPage === 1 && styles.pageBtnTextDisabled]}>
                    Prev
                  </Text>
                </TouchableOpacity>

                <Text style={styles.pageInfoText}>
                  Page {txPage} of {totalTxPages} • {transactions.length} total
                </Text>

                <TouchableOpacity
                  style={[styles.pageBtn, txPage === totalTxPages && styles.pageBtnDisabled]}
                  disabled={txPage === totalTxPages}
                  onPress={() => setTxPage((p) => Math.min(totalTxPages, p + 1))}
                >
                  <Text style={[styles.pageBtnText, txPage === totalTxPages && styles.pageBtnTextDisabled]}>
                    Next
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={txPage === totalTxPages ? Colors.textMuted : Colors.white}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Wallet Management & Reset Modal */}
      <Modal
        visible={walletModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setWalletModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="wallet-outline" size={20} color={Colors.white} />
                <Text style={styles.modalTitle}>Manage Wallets</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setWalletModalVisible(false);
                  setEditingAccountId(null);
                }}
              >
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Tap any wallet to set your real balance, or wipe mock balances to ₱0.00.
            </Text>

            <ScrollView style={{ maxHeight: 260, marginVertical: 10 }}>
              {accounts.map((acc) => {
                const isEditing = editingAccountId === acc.id;
                return (
                  <View key={acc.id} style={styles.walletModalItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.walletItemName}>{acc.name}</Text>
                      <Text style={styles.walletItemType}>{acc.type}</Text>
                    </View>

                    {isEditing ? (
                      <View style={styles.editBalanceRow}>
                        <TextInput
                          style={styles.balanceInput}
                          keyboardType="numeric"
                          placeholder="0.00"
                          placeholderTextColor={Colors.textMuted}
                          value={balanceInput}
                          onChangeText={setBalanceInput}
                          autoFocus
                        />
                        <TouchableOpacity
                          style={styles.saveBalBtn}
                          onPress={() => handleSaveBalance(acc.id)}
                        >
                          <Ionicons name="checkmark" size={16} color={Colors.black} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.balanceDisplayBtn}
                        onPress={() => {
                          setEditingAccountId(acc.id);
                          setBalanceInput(String(Number(acc.balance) || 0));
                        }}
                      >
                        <Text style={styles.walletItemBal}>
                          {currencySymbol}
                          {Number(acc.balance || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}
                        </Text>
                        <Ionicons name="pencil" size={12} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>

            {/* Clear / Reset All to 0 Button */}
            <TouchableOpacity
              style={styles.resetAllBtn}
              onPress={handleResetAllToZero}
              disabled={isResetting}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text style={styles.resetAllBtnText}>
                {isResetting ? 'Resetting...' : 'Reset All Wallets to ₱0.00'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  logoutBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    marginBottom: 8,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  walletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  walletBadgeText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -1,
    marginBottom: 14,
  },
  walletPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  walletMiniPill: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  walletMiniName: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  walletMiniBal: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: '700',
  },
  quickAddHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  quickAddHeroText: {
    color: Colors.black,
    fontSize: 14,
    fontWeight: '700',
  },
  statsGrid: {
    gap: 10,
    marginVertical: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  negativeText: {
    color: '#F87171',
  },
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  sectionBadge: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  emptySubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
  txList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 12,
  },
  txIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDetails: {
    flex: 1,
    gap: 2,
  },
  txCategory: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  txMeta: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txAmountIncome: {
    color: Colors.white,
  },
  txAmountExpense: {
    color: Colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 20,
    gap: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.white,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  walletModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 12,
  },
  walletItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  walletItemType: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  balanceDisplayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  walletItemBal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  editBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceInput: {
    width: 90,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.white,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
    textAlign: 'right',
  },
  saveBalBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
  },
  resetAllBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pageBtnDisabled: {
    opacity: 0.35,
  },
  pageBtnText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  pageBtnTextDisabled: {
    color: Colors.textMuted,
  },
  pageInfoText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
});
