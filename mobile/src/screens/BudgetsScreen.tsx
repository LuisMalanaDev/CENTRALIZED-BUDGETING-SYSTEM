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
import { CategoryBudget, SavingsVault } from '../types';
import { getCategoryName } from '../utils/format';

export const BudgetsScreen: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'BUDGETS' | 'VAULTS'>('BUDGETS');
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [vaults, setVaults] = useState<SavingsVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [budgetPage, setBudgetPage] = useState(1);
  const [vaultPage, setVaultPage] = useState(1);
  const PAGE_SIZE = 6;

  const currencySymbol = user?.currency === 'USD' ? '$' : '₱';

  const fetchData = useCallback(async () => {
    try {
      const [budgetsRes, vaultsRes] = await Promise.all([
        api.get<{ budgets: CategoryBudget[] }>('/api/budgets').catch(() => ({ budgets: [] })),
        api.get<{ vaults: SavingsVault[] }>('/api/vaults').catch(() => ({ vaults: [] })),
      ]);
      setBudgets(budgetsRes.budgets || []);
      setVaults(vaultsRes.vaults || []);
    } catch (e) {
      console.warn('Budgets fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const totalBudget = budgets.reduce((acc, b) => acc + (b.limit ?? b.amount ?? 0), 0);
  const totalSpent = budgets.reduce((acc, b) => acc + (b.spent || 0), 0);
  const totalVaultsSaved = vaults.reduce((acc, v) => acc + (v.currentAmount || 0), 0);

  const totalBudgetPages = Math.max(1, Math.ceil(budgets.length / PAGE_SIZE));
  const paginatedBudgets = budgets.slice((budgetPage - 1) * PAGE_SIZE, budgetPage * PAGE_SIZE);

  const totalVaultPages = Math.max(1, Math.ceil(vaults.length / PAGE_SIZE));
  const paginatedVaults = vaults.slice((vaultPage - 1) * PAGE_SIZE, vaultPage * PAGE_SIZE);

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
      {/* Title */}
      <Text style={styles.title}>Budgets & Vaults</Text>

      {/* Segmented Tab Bar */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'BUDGETS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('BUDGETS')}
        >
          <Text
            style={[styles.tabText, activeTab === 'BUDGETS' && styles.tabTextActive]}
          >
            Category Budgets
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'VAULTS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('VAULTS')}
        >
          <Text
            style={[styles.tabText, activeTab === 'VAULTS' && styles.tabTextActive]}
          >
            Savings Vaults
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <ActivityIndicator color={Colors.white} style={{ marginVertical: 30 }} />
      ) : activeTab === 'BUDGETS' ? (
        /* Budgets Tab */
        <View style={styles.tabSection}>
          {/* Summary Card */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>TOTAL MONTHLY BUDGET</Text>
            <Text style={styles.summaryValue}>
              {currencySymbol}
              {totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summarySub}>
                Spent: {currencySymbol}
                {totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
              <Text style={styles.summarySub}>
                Remaining: {currencySymbol}
                {Math.max(0, totalBudget - totalSpent).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </Text>
            </View>
          </View>

          {budgets.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="pie-chart-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No budget caps set</Text>
              <Text style={styles.emptySubtext}>
                Set spending limits for Food, Shopee, and Groceries to prevent overspending.
              </Text>
            </View>
          ) : (
            <View style={styles.cardsList}>
              {paginatedBudgets.map((b) => {
                const capLimit = b.limit ?? b.amount ?? 0;
                const percent = Math.min(100, Math.round(((b.spent || 0) / (capLimit || 1)) * 100));
                const catName = getCategoryName(b.category, b.name || 'Budget Cap');
                return (
                  <View key={b.id} style={styles.budgetCard}>
                    <View style={styles.budgetTop}>
                      <Text style={styles.budgetCat}>{catName}</Text>
                      <Text style={styles.budgetPercent}>{percent}%</Text>
                    </View>

                    {/* Progress Track */}
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressBar, { width: `${percent}%` }]} />
                    </View>

                    <View style={styles.budgetBottom}>
                      <Text style={styles.budgetSpent}>
                        {currencySymbol}
                        {b.spent.toLocaleString()} spent
                      </Text>
                      <Text style={styles.budgetLimit}>
                        Cap: {currencySymbol}
                        {capLimit.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Budget Pagination Controls */}
              {budgets.length > PAGE_SIZE && (
                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    style={[styles.pageBtn, budgetPage === 1 && styles.pageBtnDisabled]}
                    disabled={budgetPage === 1}
                    onPress={() => setBudgetPage((p) => Math.max(1, p - 1))}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={16}
                      color={budgetPage === 1 ? Colors.textMuted : Colors.white}
                    />
                    <Text style={[styles.pageBtnText, budgetPage === 1 && styles.pageBtnTextDisabled]}>
                      Prev
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.pageInfoText}>
                    Page {budgetPage} of {totalBudgetPages} • {budgets.length} caps
                  </Text>

                  <TouchableOpacity
                    style={[styles.pageBtn, budgetPage === totalBudgetPages && styles.pageBtnDisabled]}
                    disabled={budgetPage === totalBudgetPages}
                    onPress={() => setBudgetPage((p) => Math.min(totalBudgetPages, p + 1))}
                  >
                    <Text style={[styles.pageBtnText, budgetPage === totalBudgetPages && styles.pageBtnTextDisabled]}>
                      Next
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={budgetPage === totalBudgetPages ? Colors.textMuted : Colors.white}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      ) : (
        /* Vaults Tab */
        <View style={styles.tabSection}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>TOTAL SAVINGS LOCKED</Text>
            <Text style={styles.summaryValue}>
              {currencySymbol}
              {totalVaultsSaved.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={styles.summarySub}>
              Protected emergency funds and personal savings vaults
            </Text>
          </View>

          {vaults.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="lock-closed-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No savings vaults active</Text>
              <Text style={styles.emptySubtext}>
                Create emergency fund or milestone savings goals to track your growth.
              </Text>
            </View>
          ) : (
            <View style={styles.cardsList}>
              {paginatedVaults.map((v) => {
                const percent = Math.min(
                  100,
                  Math.round(((v.currentAmount || 0) / (v.targetAmount || 1)) * 100)
                );
                return (
                  <View key={v.id} style={styles.budgetCard}>
                    <View style={styles.budgetTop}>
                      <View style={styles.vaultTitleRow}>
                        <Ionicons name="lock-closed" size={13} color={Colors.white} />
                        <Text style={styles.budgetCat}>{v.name}</Text>
                      </View>
                      <Text style={styles.budgetPercent}>{percent}%</Text>
                    </View>

                    <View style={styles.progressTrack}>
                      <View style={[styles.progressBar, { width: `${percent}%` }]} />
                    </View>

                    <View style={styles.budgetBottom}>
                      <Text style={styles.budgetSpent}>
                        Saved: {currencySymbol}
                        {v.currentAmount.toLocaleString()}
                      </Text>
                      <Text style={styles.budgetLimit}>
                        Goal: {currencySymbol}
                        {v.targetAmount.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Vaults Pagination Controls */}
              {vaults.length > PAGE_SIZE && (
                <View style={styles.paginationRow}>
                  <TouchableOpacity
                    style={[styles.pageBtn, vaultPage === 1 && styles.pageBtnDisabled]}
                    disabled={vaultPage === 1}
                    onPress={() => setVaultPage((p) => Math.max(1, p - 1))}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={16}
                      color={vaultPage === 1 ? Colors.textMuted : Colors.white}
                    />
                    <Text style={[styles.pageBtnText, vaultPage === 1 && styles.pageBtnTextDisabled]}>
                      Prev
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.pageInfoText}>
                    Page {vaultPage} of {totalVaultPages} • {vaults.length} vaults
                  </Text>

                  <TouchableOpacity
                    style={[styles.pageBtn, vaultPage === totalVaultPages && styles.pageBtnDisabled]}
                    disabled={vaultPage === totalVaultPages}
                    onPress={() => setVaultPage((p) => Math.min(totalVaultPages, p + 1))}
                  >
                    <Text style={[styles.pageBtnText, vaultPage === totalVaultPages && styles.pageBtnTextDisabled]}>
                      Next
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={vaultPage === totalVaultPages ? Colors.textMuted : Colors.white}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      )}
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
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.4,
    marginBottom: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: Colors.white,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.black,
  },
  tabSection: {
    gap: 12,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.6,
  },
  summaryValue: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.white,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  summarySub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cardsList: {
    gap: 10,
  },
  budgetCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  budgetTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vaultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  budgetCat: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  budgetPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceSubtle,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 3,
  },
  budgetBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetSpent: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  budgetLimit: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
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
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pageBtnDisabled: {
    opacity: 0.35,
  },
  pageBtnText: {
    color: Colors.white,
    fontSize: 12,
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
