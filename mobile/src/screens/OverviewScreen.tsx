import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';
import { api } from '../api/client';
import { DateFilterBar } from '../components/DateFilterBar';
import { DateRangeFilter, Transaction, Account } from '../types';

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

  // Total Money Left across all active wallets & accounts
  const totalMoneyLeft = accounts.reduce((acc, a) => acc + (a.balance || 0), 0);

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
          <View style={styles.walletBadge}>
            <Ionicons name="wallet" size={12} color={Colors.white} />
            <Text style={styles.walletBadgeText}>{accounts.length} Wallets</Text>
          </View>
        </View>

        <Text style={styles.heroAmount}>
          {currencySymbol}
          {totalMoneyLeft.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>

        {/* Quick Breakdown of Wallets */}
        {accounts.length > 0 ? (
          <View style={styles.walletPillsRow}>
            {accounts.slice(0, 3).map((acc) => (
              <View key={acc.id} style={styles.walletMiniPill}>
                <Text style={styles.walletMiniName} numberOfLines={1}>
                  {acc.name}:
                </Text>
                <Text style={styles.walletMiniBal}>
                  {currencySymbol}
                  {Math.round(acc.balance).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Action Button */}
        <TouchableOpacity
          style={styles.quickAddHeroBtn}
          onPress={onOpenQuickLog}
        >
          <Ionicons name="add" size={16} color={Colors.black} />
          <Text style={styles.quickAddHeroText}>+ Quick Log Expense / Inflow</Text>
        </TouchableOpacity>
      </View>

      {/* 31-Day Visual Calendar Filter Bar */}
      <DateFilterBar filter={filter} onFilterChange={onFilterChange} />

      {/* 4 Quick Stat Cards */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Text style={styles.statLabel}>Total Inflow</Text>
            <Ionicons name="arrow-down-circle-outline" size={14} color={Colors.textSecondary} />
          </View>
          <Text style={styles.statValue}>
            +{currencySymbol}
            {metrics.totalInflow.toLocaleString('en-US', {
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
            {metrics.totalOutflow.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statHeader}>
            <Text style={styles.statLabel}>Net Cashflow</Text>
            <Ionicons name="swap-vertical-outline" size={14} color={Colors.textSecondary} />
          </View>
          <Text
            style={[
              styles.statValue,
              metrics.netCashflow < 0 ? styles.negativeText : undefined,
            ]}
          >
            {metrics.netCashflow >= 0 ? '+' : '−'}
            {currencySymbol}
            {Math.abs(metrics.netCashflow).toLocaleString('en-US', {
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
            {transactions.slice(0, 10).map((tx) => {
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
                      {tx.category || 'Expense'}
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
          </View>
        )}
      </View>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginVertical: 12,
  },
  statCard: {
    width: '48.5%',
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
});
