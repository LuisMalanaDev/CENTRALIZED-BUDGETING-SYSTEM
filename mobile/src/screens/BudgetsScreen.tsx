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
import { CategoryBudget, SavingsVault } from '../types';
import { getCategoryName } from '../utils/format';

const BUDGET_CATEGORIES = [
  { name: 'Food & Dining', icon: 'restaurant-outline' },
  { name: 'Shopee / Online', icon: 'cart-outline' },
  { name: 'Groceries', icon: 'basket-outline' },
  { name: 'Transportation', icon: 'car-outline' },
  { name: 'Bills & Utilities', icon: 'receipt-outline' },
  { name: 'Entertainment', icon: 'game-controller-outline' },
  { name: 'Personal Care', icon: 'heart-outline' },
  { name: 'Other Expense', icon: 'ellipsis-horizontal-outline' },
];

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

  // Budget Modal State
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(BUDGET_CATEGORIES[0].name);
  const [budgetAmountInput, setBudgetAmountInput] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);

  // Vault Modal State
  const [vaultModalVisible, setVaultModalVisible] = useState(false);
  const [vaultNameInput, setVaultNameInput] = useState('');
  const [vaultTargetInput, setVaultTargetInput] = useState('');
  const [vaultInitialInput, setVaultInitialInput] = useState('');
  const [savingVault, setSavingVault] = useState(false);

  // Vault Deposit/Withdraw Modal State
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedVault, setSelectedVault] = useState<SavingsVault | null>(null);
  const [actionType, setActionType] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [actionAmountInput, setActionAmountInput] = useState('');
  const [savingAction, setSavingAction] = useState(false);

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

  const handleSaveBudget = async () => {
    const amt = parseFloat(budgetAmountInput.replace(/,/g, ''));
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid monthly budget limit.');
      return;
    }

    setSavingBudget(true);
    try {
      await api.post('/api/budgets', {
        name: selectedCategory,
        amount: amt,
        period: 'MONTHLY',
      });
      setBudgetModalVisible(false);
      setBudgetAmountInput('');
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save budget cap');
    } finally {
      setSavingBudget(false);
    }
  };

  const handleDeleteBudget = (id: string, name: string) => {
    Alert.alert('Delete Budget Cap', `Remove budget spending cap for "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/budgets/${id}`);
            fetchData();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete budget');
          }
        },
      },
    ]);
  };

  const handleSaveVault = async () => {
    const target = parseFloat(vaultTargetInput.replace(/,/g, ''));
    const initial = parseFloat(vaultInitialInput.replace(/,/g, '')) || 0;
    if (!vaultNameInput.trim()) {
      Alert.alert('Invalid Name', 'Please enter a name for your savings vault.');
      return;
    }
    if (isNaN(target) || target <= 0) {
      Alert.alert('Invalid Target', 'Please enter a target savings goal.');
      return;
    }

    setSavingVault(true);
    try {
      await api.post('/api/vaults', {
        name: vaultNameInput.trim(),
        targetAmount: target,
        currentAmount: initial,
      });
      setVaultModalVisible(false);
      setVaultNameInput('');
      setVaultTargetInput('');
      setVaultInitialInput('');
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create savings vault');
    } finally {
      setSavingVault(false);
    }
  };

  const handleVaultDepositWithdraw = async () => {
    if (!selectedVault) return;
    const amt = parseFloat(actionAmountInput.replace(/,/g, ''));
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive amount.');
      return;
    }

    setSavingAction(true);
    try {
      await api.post(`/api/vaults/${selectedVault.id}/deposit`, {
        amount: amt,
        action: actionType,
      });
      setActionModalVisible(false);
      setActionAmountInput('');
      setSelectedVault(null);
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || `Failed to ${actionType.toLowerCase()} funds`);
    } finally {
      setSavingAction(false);
    }
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
          {/* Header Action */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Category Budget Caps</Text>
            <TouchableOpacity
              style={styles.addPrimaryBtn}
              onPress={() => setBudgetModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={15} color={Colors.black} />
              <Text style={styles.addPrimaryBtnText}>Set Budget Cap</Text>
            </TouchableOpacity>
          </View>

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
              <TouchableOpacity
                style={[styles.addPrimaryBtn, { marginTop: 14 }]}
                onPress={() => setBudgetModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color={Colors.black} />
                <Text style={styles.addPrimaryBtnText}>Set First Budget Cap</Text>
              </TouchableOpacity>
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text
                          style={[
                            styles.budgetPercent,
                            percent >= 100 ? { color: '#F87171' } : percent >= 80 ? { color: '#FBBF24' } : null,
                          ]}
                        >
                          {percent}%
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleDeleteBudget(b.id, catName)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="trash-outline" size={15} color={Colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Progress Track */}
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressBar,
                          {
                            width: `${percent}%`,
                            backgroundColor:
                              percent >= 100 ? '#EF4444' : percent >= 80 ? '#F59E0B' : Colors.white,
                          },
                        ]}
                      />
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
          {/* Header Action */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Savings Lockboxes</Text>
            <TouchableOpacity
              style={styles.addPrimaryBtn}
              onPress={() => setVaultModalVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={15} color={Colors.black} />
              <Text style={styles.addPrimaryBtnText}>Create Vault</Text>
            </TouchableOpacity>
          </View>

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
              <TouchableOpacity
                style={[styles.addPrimaryBtn, { marginTop: 14 }]}
                onPress={() => setVaultModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color={Colors.black} />
                <Text style={styles.addPrimaryBtnText}>Create First Vault</Text>
              </TouchableOpacity>
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
                      <View style={[styles.progressBar, { width: `${percent}%`, backgroundColor: '#10B981' }]} />
                    </View>

                    <View style={styles.budgetBottom}>
                      <Text style={styles.budgetSpent}>
                        Saved: {currencySymbol}
                        {Number(v.currentAmount || 0).toLocaleString()}
                      </Text>
                      <Text style={styles.budgetLimit}>
                        Goal: {currencySymbol}
                        {Number(v.targetAmount || 0).toLocaleString()}
                      </Text>
                    </View>

                    {/* Deposit & Withdraw Action Buttons */}
                    <View style={styles.vaultActionsRow}>
                      <TouchableOpacity
                        style={styles.vaultActionBtnDeposit}
                        onPress={() => {
                          setSelectedVault(v);
                          setActionType('DEPOSIT');
                          setActionModalVisible(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add-circle" size={13} color="#4ADE80" />
                        <Text style={styles.vaultActionTextDeposit}>Deposit</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.vaultActionBtnWithdraw}
                        onPress={() => {
                          setSelectedVault(v);
                          setActionType('WITHDRAW');
                          setActionModalVisible(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="remove-circle" size={13} color="#F87171" />
                        <Text style={styles.vaultActionTextWithdraw}>Withdraw</Text>
                      </TouchableOpacity>
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

      {/* Set Category Budget Cap Modal */}
      <Modal
        visible={budgetModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBudgetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Category Budget Cap</Text>
              <TouchableOpacity onPress={() => setBudgetModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Select Expense Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChipsRow}>
              {BUDGET_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    style={[styles.catChip, isSelected && styles.catChipActive]}
                    onPress={() => setSelectedCategory(cat.name)}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={13}
                      color={isSelected ? Colors.black : Colors.textSecondary}
                    />
                    <Text style={[styles.catChipText, isSelected && styles.catChipTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.modalLabel}>Monthly Spending Limit ({currencySymbol})</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 5000"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={budgetAmountInput}
              onChangeText={setBudgetAmountInput}
              autoFocus
            />

            <TouchableOpacity
              style={[styles.modalSubmitBtn, savingBudget && { opacity: 0.6 }]}
              onPress={handleSaveBudget}
              disabled={savingBudget}
            >
              {savingBudget ? (
                <ActivityIndicator color={Colors.black} size="small" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Save Budget Cap</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Savings Vault Modal */}
      <Modal
        visible={vaultModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setVaultModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Savings Vault</Text>
              <TouchableOpacity onPress={() => setVaultModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Goal / Vault Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Emergency Fund, New PC"
              placeholderTextColor={Colors.textMuted}
              value={vaultNameInput}
              onChangeText={setVaultNameInput}
              autoFocus
            />

            <Text style={styles.modalLabel}>Target Savings Goal ({currencySymbol})</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 20000"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={vaultTargetInput}
              onChangeText={setVaultTargetInput}
            />

            <Text style={styles.modalLabel}>Initial Locked Deposit (Optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={vaultInitialInput}
              onChangeText={setVaultInitialInput}
            />

            <TouchableOpacity
              style={[styles.modalSubmitBtn, savingVault && { opacity: 0.6 }]}
              onPress={handleSaveVault}
              disabled={savingVault}
            >
              {savingVault ? (
                <ActivityIndicator color={Colors.black} size="small" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Create Lockbox Vault</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Vault Deposit/Withdraw Modal */}
      <Modal
        visible={actionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setActionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {actionType === 'DEPOSIT' ? 'Deposit into Vault' : 'Withdraw from Vault'}
              </Text>
              <TouchableOpacity onPress={() => setActionModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.vaultActionGoalName}>
              Vault: {selectedVault?.name}
            </Text>
            <Text style={styles.vaultActionGoalSub}>
              Current: {currencySymbol}{Number(selectedVault?.currentAmount || 0).toLocaleString()} • Goal: {currencySymbol}{Number(selectedVault?.targetAmount || 0).toLocaleString()}
            </Text>

            <Text style={styles.modalLabel}>
              Amount to {actionType === 'DEPOSIT' ? 'Deposit' : 'Withdraw'} ({currencySymbol})
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={actionAmountInput}
              onChangeText={setActionAmountInput}
              autoFocus
            />

            <TouchableOpacity
              style={[
                styles.modalSubmitBtn,
                actionType === 'WITHDRAW' && { backgroundColor: '#F87171' },
                savingAction && { opacity: 0.6 },
              ]}
              onPress={handleVaultDepositWithdraw}
              disabled={savingAction}
            >
              {savingAction ? (
                <ActivityIndicator color={Colors.black} size="small" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>
                  Confirm {actionType === 'DEPOSIT' ? 'Deposit (+)' : 'Withdraw (−)'}
                </Text>
              )}
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: -0.3,
  },
  addPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addPrimaryBtnText: {
    color: Colors.black,
    fontSize: 12,
    fontWeight: '700',
  },
  vaultActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  vaultActionBtnDeposit: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  vaultActionTextDeposit: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '700',
  },
  vaultActionBtnWithdraw: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  vaultActionTextWithdraw: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 4,
  },
  modalInput: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.white,
    fontSize: 15,
  },
  modalSubmitBtn: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  modalSubmitBtnText: {
    color: Colors.black,
    fontSize: 14,
    fontWeight: '700',
  },
  catChipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catChipActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  catChipTextActive: {
    color: Colors.black,
  },
  vaultActionGoalName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  vaultActionGoalSub: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});
