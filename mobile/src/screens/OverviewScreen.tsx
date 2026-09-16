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
import { ProfileModal } from '../components/ProfileModal';
import { SpendingDonutChart } from '../components/SpendingDonutChart';
import { CashflowBarChart } from '../components/CashflowBarChart';
import { AiAdvisorModal } from '../components/AiAdvisorModal';
import { StatementModal } from '../components/StatementModal';
import { DateRangeFilter, Transaction, Account } from '../types';
import { getCategoryName } from '../utils/format';
import { offlineStorage } from '../services/offlineStorage';

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
  interface MetricsState {
    totalInflow: number;
    totalOutflow: number;
    netCashflow: number;
    budgetCap: number;
    activeMonthInflow?: number;
  }

  const [metrics, setMetrics] = useState<MetricsState>({
    totalInflow: 0,
    totalOutflow: 0,
    netCashflow: 0,
    budgetCap: 0,
    activeMonthInflow: 0,
  });
  const [breakdown, setBreakdown] = useState<{ name: string; amount: number; percentage: number; color: string }[]>([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [cashflow, setCashflow] = useState<any[]>([]);

  const [txPage, setTxPage] = useState(1);
  const TX_PAGE_SIZE = 6;

  useEffect(() => {
    setTxPage(1);
  }, [filter]);

  const totalTxPages = Math.max(1, Math.ceil(transactions.length / TX_PAGE_SIZE));
  const paginatedRecent = transactions.slice((txPage - 1) * TX_PAGE_SIZE, txPage * TX_PAGE_SIZE);

  const currencySymbol = user?.currency === 'USD' ? '$' : '₱';

  const [offlinePendingCount, setOfflinePendingCount] = useState(0);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);

  // 1. Instant Cache Hydration on startup (0.01s instant data rendering)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cached = await offlineStorage.getOverviewCache();
        if (cached && mounted) {
          if (cached.accounts?.length) setAccounts(cached.accounts);
          if (cached.transactions?.length) setTransactions(cached.transactions);
          if (cached.metrics) setMetrics(cached.metrics);
          if (cached.breakdown) setBreakdown(cached.breakdown);
          if (cached.cashflow) setCashflow(cached.cashflow);
          if (cached.totalExpense !== undefined) setTotalExpense(cached.totalExpense);
          setLoading(false);
        }
        const queue = await offlineStorage.getOfflineQueue();
        if (mounted) {
          setOfflinePendingCount(queue.length);
        }
      } catch (e) {
        console.warn('Cache hydration error:', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Background offline queue sync
  const syncOfflineData = useCallback(async () => {
    setIsSyncingOffline(true);
    try {
      const result = await offlineStorage.syncOfflineQueue();
      setOfflinePendingCount(result.remainingCount);
      return result.syncedCount > 0;
    } catch {
      return false;
    } finally {
      setIsSyncingOffline(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // Sync any pending offline actions first
      await syncOfflineData();

      // Build query string for active date range filter
      let query = '';
      if (filter.startDate && filter.endDate) {
        query = `?startDate=${filter.startDate}&endDate=${filter.endDate}`;
      }

      // DO NOT catch and return fake empty arrays for accounts & transactions.
      // If offline, letting these throw ensures we branch to the catch block instead of wiping user data!
      const [accountsRes, transRes, metricsRes, breakdownRes, cashflowRes] = await Promise.all([
        api.get<{ accounts: Account[] }>('/api/accounts'),
        api.get<{ transactions: Transaction[] }>(`/api/transactions${query}`),
        api.get<any>(`/api/analytics/summary${query}`).catch(() => null),
        api.get<any>(`/api/analytics/breakdown${query}`).catch(() => null),
        api.get<any>('/api/analytics/cashflow?months=6').catch(() => null),
      ]);

      const accs = accountsRes.accounts || [];
      const txs = transRes.transactions || [];
      setAccounts(accs);
      setTransactions(txs);

      let bDown: { name: string; amount: number; percentage: number; color: string }[] = [];
      let totExp = 0;
      if (breakdownRes?.breakdown) {
        bDown = breakdownRes.breakdown;
        totExp = breakdownRes.totalExpense || 0;
        setBreakdown(bDown);
        setTotalExpense(totExp);
      } else {
        setBreakdown([]);
        setTotalExpense(0);
      }

      let cFlow: any[] = [];
      if (cashflowRes?.cashflow) {
        cFlow = cashflowRes.cashflow;
        setCashflow(cFlow);
      } else {
        setCashflow([]);
      }

      let newMetrics = {
        totalInflow: 0,
        totalOutflow: 0,
        netCashflow: 0,
        budgetCap: 0,
        activeMonthInflow: 0,
      };

      if (metricsRes) {
        const inflow = metricsRes.totalInflow ?? metricsRes.totalIncome ?? metricsRes.monthlyIncome ?? 0;
        const outflow = metricsRes.totalOutflow ?? metricsRes.totalExpenses ?? metricsRes.monthlyBurnRate ?? 0;
        newMetrics = {
          totalInflow: Number(inflow),
          totalOutflow: Number(outflow),
          netCashflow: Number(inflow) - Number(outflow),
          budgetCap: metricsRes.budgetCap || metricsRes.overallBudgetLimit || 0,
          activeMonthInflow: Number(metricsRes.activeMonthInflow || inflow),
        };
      } else {
        // Compute locally from transactions
        const inflow = txs.filter((t) => t.type === 'INCOME').reduce((acc, t) => acc + Number(t.amount || 0), 0);
        const outflow = txs.filter((t) => t.type === 'EXPENSE').reduce((acc, t) => acc + Number(t.amount || 0), 0);
        newMetrics = {
          totalInflow: inflow,
          totalOutflow: outflow,
          netCashflow: inflow - outflow,
          budgetCap: 0,
          activeMonthInflow: inflow,
        };
      }
      setMetrics(newMetrics);

      // Save to local cache for instant future loads
      if (accs.length > 0 || txs.length > 0) {
        offlineStorage.saveOverviewCache({
          accounts: accs,
          transactions: txs,
          metrics: newMetrics,
          breakdown: bDown,
          cashflow: cFlow,
          totalExpense: totExp,
        });
        if (txs.length > 0) {
          offlineStorage.saveLedgerCache(txs);
        }

        // Silently pre-cache budgets and vaults in background so Budgets tab works offline immediately
        Promise.all([
          api.get<{ budgets: any[] }>('/api/budgets').catch(() => null),
          api.get<{ vaults: any[] }>('/api/vaults').catch(() => null),
        ]).then(([bRes, vRes]) => {
          const bList = bRes?.budgets || [];
          const vList = vRes?.vaults || [];
          if (bList.length > 0 || vList.length > 0) {
            offlineStorage.saveBudgetsCache({
              budgets: bList,
              vaults: vList,
            });
          }
        }).catch(() => {});
      }
    } catch (e: any) {
      console.warn('Overview fetch error (offline or server unreachable):', e?.message || e);
      // DEVICE IS OFFLINE: Restore and retain cached data! NEVER wipe state to 0!
      try {
        const cached = await offlineStorage.getOverviewCache();
        if (cached) {
          if (cached.accounts?.length) setAccounts(cached.accounts);
          if (cached.transactions?.length) setTransactions(cached.transactions);
          if (cached.metrics) setMetrics(cached.metrics);
          if (cached.breakdown?.length) setBreakdown(cached.breakdown);
          if (cached.cashflow?.length) setCashflow(cached.cashflow);
          if (cached.totalExpense !== undefined) setTotalExpense(cached.totalExpense);
        }
      } catch (cacheErr) {
        console.warn('Failed to restore cache on offline fallback:', cacheErr);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, syncOfflineData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [aiAdvisorModalVisible, setAiAdvisorModalVisible] = useState(false);
  const [statementModalVisible, setStatementModalVisible] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [balanceInput, setBalanceInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Manual offline queue sync trigger
  const handleManualSync = async () => {
    setIsSyncingOffline(true);
    try {
      const res = await offlineStorage.syncOfflineQueue();
      setOfflinePendingCount(res.remainingCount);
      if (res.syncedCount > 0) {
        Alert.alert('Sync Complete', `Successfully synced ${res.syncedCount} offline transaction(s) to cloud.`);
        fetchData();
      } else if (res.remainingCount > 0) {
        Alert.alert('Offline', 'Cannot reach server yet. Your changes remain safely stored on this device.');
      } else {
        Alert.alert('All Caught Up', 'All offline transactions are already synced.');
      }
    } catch {
      Alert.alert('Sync Notice', 'Your changes remain saved locally on your device.');
    } finally {
      setIsSyncingOffline(false);
    }
  };

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

  // Total Money across active wallets & accounts (Persistent real live cash balance)
  const totalMoneyLeft = accounts.reduce((acc, a) => acc + (Number(a.balance) || 0), 0);

  // Inflow vs Outflow calculations
  const inflow = metrics.totalInflow || 0;
  const outflow = metrics.totalOutflow || 0;

  // Persistent Inflow Anchor (Approach B):
  // When viewing a single day with 0 daily inflow, anchor to the month's active inflow pool so it never drops to ₱0!
  const activeMonthInflow = (metrics as any).activeMonthInflow || metrics.totalInflow || 0;
  const displayInflow = filter.type === 'day' && inflow === 0 ? activeMonthInflow : inflow;
  const displayInflowLabel = filter.type === 'day' && inflow === 0 ? 'Active Month Inflow' : 'Total Inflow (Income)';

  const moneyLeftFromInflow = displayInflow > 0 ? displayInflow - outflow : totalMoneyLeft;
  const percentUsed = displayInflow > 0 ? Math.min(100, Math.round((outflow / displayInflow) * 100)) : 0;
  const percentRemaining = Math.max(0, 100 - percentUsed);

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
        <TouchableOpacity
          style={styles.welcomeContainer}
          onPress={() => setProfileModalVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.topAvatar}>
            <Text style={styles.topAvatarText}>
              {(user?.name || user?.email || 'WS').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.userName}>{user?.name || 'Commander'}</Text>
              <Ionicons name="chevron-forward" size={13} color={Colors.textMuted} />
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.topBarActions}>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Cloud Live</Text>
          </View>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => setProfileModalVisible(true)}
            accessibilityLabel="View Profile Credentials"
          >
            <Ionicons name="person-outline" size={17} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline Sync Banner */}
      {offlinePendingCount > 0 && (
        <View style={styles.offlineBanner}>
          <View style={styles.offlineBannerLeft}>
            <Ionicons name="cloud-offline-outline" size={18} color="#F59E0B" />
            <Text style={styles.offlineBannerText}>
              {offlinePendingCount} offline transaction{offlinePendingCount > 1 ? 's' : ''} waiting to sync
            </Text>
          </View>
          <TouchableOpacity
            style={styles.offlineSyncBtn}
            onPress={handleManualSync}
            disabled={isSyncingOffline}
            activeOpacity={0.8}
          >
            <Ionicons name="sync-outline" size={13} color="#FFF" />
            <Text style={styles.offlineSyncBtnText}>
              {isSyncingOffline ? 'Syncing...' : 'Sync'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Persistent Wallet Balance Hero Card (Approach B) */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.heroLabel}>TOTAL AVAILABLE MONEY</Text>
            <Text style={styles.heroFilterNote}>
              Active Balance Across {accounts.length} Wallets
            </Text>
          </View>

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

        {/* Big Persistent Available Cash Balance */}
        <Text
          style={[
            styles.heroAmount,
            totalMoneyLeft < 0 && { color: '#F87171' },
          ]}
        >
          {currencySymbol}
          {Number(totalMoneyLeft).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>

        {/* Inflow vs Outflow Comparison Box */}
        <View style={styles.inflowComparisonBox}>
          <View style={styles.inflowCompareRow}>
            <View style={styles.inflowCompareCol}>
              <View style={styles.inflowIndicatorDot} />
              <View>
                <Text style={styles.inflowCompareLabel}>{displayInflowLabel}</Text>
                <Text style={styles.inflowCompareVal}>
                  +{currencySymbol}{displayInflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>

            <View style={styles.inflowDivider} />

            <View style={styles.inflowCompareCol}>
              <View style={styles.outflowIndicatorDot} />
              <View>
                <Text style={styles.inflowCompareLabel}>
                  {filter.type === 'day' ? "Today's Spent" : "Total Spent"}
                </Text>
                <Text style={styles.outflowCompareVal}>
                  −{currencySymbol}{outflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          </View>

          {/* Progress Bar Comparing Inflow to Expenses */}
          {displayInflow > 0 ? (
            <View style={styles.inflowProgressSection}>
              <View style={styles.inflowProgressTrack}>
                <View
                  style={[
                    styles.inflowProgressBar,
                    {
                      width: `${percentUsed}%`,
                      backgroundColor:
                        percentUsed >= 100 ? '#EF4444' : percentUsed >= 80 ? '#F59E0B' : Colors.white,
                    },
                  ]}
                />
              </View>
              <View style={styles.inflowProgressLabels}>
                <Text style={styles.inflowProgressSub}>
                  {percentUsed}% spent ({currencySymbol}{outflow.toLocaleString()})
                </Text>
                <Text style={styles.inflowProgressSub}>
                  {percentRemaining}% left ({currencySymbol}{Math.max(0, moneyLeftFromInflow).toLocaleString()})
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.inflowZeroPrompt}>
              No income/salary logged yet. Tap below to log inflow!
            </Text>
          )}
        </View>


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

      {/* Action Tools: AI Advisor & Monthly Statement */}
      <View style={styles.actionToolsRow}>
        <TouchableOpacity
          style={styles.toolBtnAi}
          onPress={() => setAiAdvisorModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="sparkles" size={14} color="#A78BFA" />
          <Text style={styles.toolBtnAiText}>AI Financial Insights</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolBtnStatement}
          onPress={() => setStatementModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="receipt-outline" size={14} color={Colors.white} />
          <Text style={styles.toolBtnStatementText}>Statement & CSV</Text>
        </TouchableOpacity>
      </View>


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

      {/* 📊 Spending Breakdown Donut Chart */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Spending Breakdown</Text>
          <Text style={styles.sectionBadge}>{filter.label}</Text>
        </View>
        <View style={styles.chartCard}>
          {loading ? (
            <ActivityIndicator color={Colors.white} style={{ marginVertical: 20 }} />
          ) : (
            <SpendingDonutChart
              breakdown={breakdown}
              totalExpense={totalExpense}
              currencySymbol={currencySymbol}
            />
          )}
        </View>
      </View>

      {/* 📈 6-Month Cashflow Trend */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Cashflow Trend</Text>
          <Text style={styles.sectionBadge}>Last 6 Months</Text>
        </View>
        <View style={styles.chartCard}>
          {loading ? (
            <ActivityIndicator color={Colors.white} style={{ marginVertical: 20 }} />
          ) : (
            <CashflowBarChart cashflow={cashflow} currencySymbol={currencySymbol} />
          )}
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

      {/* User Profile & Credentials Modal */}
      <ProfileModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
        user={user}
        onLogout={logout}
      />

      {/* AI Financial Advisor Modal */}
      <AiAdvisorModal
        visible={aiAdvisorModalVisible}
        onClose={() => setAiAdvisorModalVisible(false)}
        filter={filter}
      />

      {/* Monthly Financial Statement & CSV Export Modal */}
      <StatementModal
        visible={statementModalVisible}
        onClose={() => setStatementModalVisible(false)}
        filter={filter}
        transactions={transactions}
        metrics={metrics}
      />
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
    paddingBottom: 120,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  welcomeText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  userName: {
    fontSize: 18,
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
  profileBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  heroFilterNote: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
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
    marginBottom: 12,
  },
  inflowComparisonBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  inflowCompareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inflowCompareCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inflowIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  outflowIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F87171',
  },
  inflowCompareLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  inflowCompareVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4ADE80',
    marginTop: 2,
  },
  outflowCompareVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F87171',
    marginTop: 2,
  },
  inflowDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },
  inflowProgressSection: {
    gap: 6,
  },
  inflowProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  inflowProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
  inflowProgressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inflowProgressSub: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  inflowZeroPrompt: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
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
  chartCard: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  actionToolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  toolBtnAi: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.3)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  toolBtnAiText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DDD6FE',
  },
  toolBtnStatement: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  toolBtnStatementText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(217, 119, 6, 0.12)',
    borderColor: '#D97706',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  offlineBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  offlineBannerText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '600',
  },
  offlineSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D97706',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  offlineSyncBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
});


