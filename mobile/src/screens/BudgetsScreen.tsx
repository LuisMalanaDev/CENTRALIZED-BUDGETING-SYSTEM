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
import { offlineStorage } from '../services/offlineStorage';

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

const VAULT_ICONS = [
  { label: 'Emergency', emoji: '🛡️', icon: 'shield-checkmark' },
  { label: 'Travel', emoji: '✈️', icon: 'airplane' },
  { label: 'Gadget', emoji: '📱', icon: 'phone-portrait' },
  { label: 'Shopping', emoji: '🛒', icon: 'cart' },
  { label: 'Home', emoji: '🏠', icon: 'home' },
  { label: 'Education', emoji: '📚', icon: 'book' },
  { label: 'Health', emoji: '💊', icon: 'medkit' },
  { label: 'Goal', emoji: '🎯', icon: 'trophy' },
];

const VAULT_COLORS = [
  { label: 'Green', hex: '#10B981' },
  { label: 'Blue', hex: '#3B82F6' },
  { label: 'Purple', hex: '#8B5CF6' },
  { label: 'Orange', hex: '#F59E0B' },
  { label: 'Rose', hex: '#F43F5E' },
  { label: 'Cyan', hex: '#06B6D4' },
];

/** Computes estimated completion month given current and target amounts + a daily/monthly save rate */
function computeETA(currentAmount: number, targetAmount: number, targetDate?: string): string | null {
  if (!targetDate) return null;
  const remaining = targetAmount - currentAmount;
  if (remaining <= 0) return null;
  const target = new Date(targetDate);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= 0) return 'Past due date';
  // Estimate monthly needed = remaining / months left
  const monthsLeft = diffMs / (1000 * 60 * 60 * 24 * 30);
  const monthlyNeeded = monthsLeft > 0 ? remaining / monthsLeft : remaining;
  const etaDate = new Date(now.getTime() + (remaining / (monthlyNeeded / 30)) * 24 * 60 * 60 * 1000);
  return etaDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const VAULT_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  // Lucide backend/web mappings
  ShieldCheck: 'shield-checkmark',
  Shield: 'shield',
  PiggyBank: 'wallet',
  Wallet: 'wallet',
  Target: 'trophy',
  Sparkles: 'sparkles',
  TrendingUp: 'trending-up',
  Lock: 'lock-closed',
  Award: 'ribbon',
  Heart: 'heart',
  Gift: 'gift',
  Home: 'home',
  Car: 'car',
  Plane: 'airplane',
  Smartphone: 'phone-portrait',
  Laptop: 'laptop',
  // Ionicons names
  'shield-checkmark': 'shield-checkmark',
  airplane: 'airplane',
  'phone-portrait': 'phone-portrait',
  cart: 'cart',
  home: 'home',
  book: 'book',
  medkit: 'medkit',
  trophy: 'trophy',
};

function getVaultIcon(icon?: string): keyof typeof Ionicons.glyphMap {
  if (!icon) return 'shield-checkmark';
  return VAULT_ICON_MAP[icon] || 'shield-checkmark';
}


export const BudgetsScreen: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'BUDGETS' | 'VAULTS'>('BUDGETS');
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [vaults, setVaults] = useState<SavingsVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
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
  const [vaultTargetDateInput, setVaultTargetDateInput] = useState('');
  const [selectedVaultIcon, setSelectedVaultIcon] = useState(VAULT_ICONS[0].icon);
  const [selectedVaultColor, setSelectedVaultColor] = useState(VAULT_COLORS[0].hex);
  const [savingVault, setSavingVault] = useState(false);

  // Vault Deposit/Withdraw Modal State
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [selectedVault, setSelectedVault] = useState<SavingsVault | null>(null);
  const [actionType, setActionType] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [actionAmountInput, setActionAmountInput] = useState('');
  const [savingAction, setSavingAction] = useState(false);

  const currencySymbol = user?.currency === 'USD' ? '$' : '₱';

  // Instant Cache Hydration on startup (0.01s instant data rendering)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cached = await offlineStorage.getBudgetsCache();
        if (cached && mounted) {
          if (cached.budgets?.length) setBudgets(cached.budgets);
          if (cached.vaults?.length) setVaults(cached.vaults);
          setLoading(false);
        }
      } catch (e) {
        console.warn('Budgets cache hydration error:', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      // DO NOT catch and return empty arrays. Let network errors throw so we preserve cache!
      const [budgetsRes, vaultsRes] = await Promise.all([
        api.get<{ budgets: CategoryBudget[] }>('/api/budgets'),
        api.get<{ vaults: SavingsVault[] }>('/api/vaults'),
      ]);
      const bList = budgetsRes.budgets || [];
      const vList = vaultsRes.vaults || [];
      setBudgets(bList);
      setVaults(vList);
      setIsOffline(false);

      if (bList.length > 0 || vList.length > 0) {
        offlineStorage.saveBudgetsCache({
          budgets: bList,
          vaults: vList,
        });
      }
    } catch (e: any) {
      console.warn('Budgets fetch error (offline):', e?.message || e);
      setIsOffline(true);
      // DEVICE IS OFFLINE: Restore and retain cached budgets & vaults!
      try {
        const cached = await offlineStorage.getBudgetsCache();
        if (cached) {
          if (cached.budgets?.length) setBudgets(cached.budgets);
          if (cached.vaults?.length) setVaults(cached.vaults);
        }
      } catch (cacheErr) {
        console.warn('Failed to restore budgets cache:', cacheErr);
      }
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
        icon: selectedVaultIcon,
        color: selectedVaultColor,
        targetDate: vaultTargetDateInput.trim() || undefined,
      });
      setVaultModalVisible(false);
      setVaultNameInput('');
      setVaultTargetInput('');
      setVaultInitialInput('');
      setVaultTargetDateInput('');
      setSelectedVaultIcon(VAULT_ICONS[0].icon);
      setSelectedVaultColor(VAULT_COLORS[0].hex);
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

      {/* Offline Cache Indicator */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color="#F59E0B" />
          <Text style={styles.offlineBannerText}>
            Viewing cached budgets & vaults (Offline mode)
          </Text>
        </View>
      )}

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
                const percent = v.progressPercent ??
                  Math.min(100, Math.round(((v.currentAmount || 0) / (v.targetAmount || 1)) * 100));
                const vaultColor = v.color || '#10B981';
                const eta = computeETA(v.currentAmount || 0, v.targetAmount, v.targetDate);
                const RING_SIZE = 72;
                const RING_THICKNESS = 7;

                return (
                  <View key={v.id} style={[styles.vaultCard, v.isCompleted && styles.vaultCardCompleted]}>
                    {/* Top Row: Ring + Info */}
                    <View style={styles.vaultCardTopRow}>
                      {/* Circular Progress Ring */}
                      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                        {/* Ring background */}
                        <View
                          style={[
                            styles.vaultRingBg,
                            {
                              width: RING_SIZE,
                              height: RING_SIZE,
                              borderRadius: RING_SIZE / 2,
                              borderWidth: RING_THICKNESS,
                              borderColor: Colors.border,
                            },
                          ]}
                        />
                        {/* Ring fill (using border color trick with rotation) */}
                        {percent > 0 && (
                          <View
                            style={[
                              styles.vaultRingFill,
                              {
                                width: RING_SIZE,
                                height: RING_SIZE,
                                borderRadius: RING_SIZE / 2,
                                borderWidth: RING_THICKNESS,
                                borderColor: vaultColor,
                                borderRightColor: percent < 25 ? 'transparent' : vaultColor,
                                borderBottomColor: percent < 50 ? 'transparent' : vaultColor,
                                borderLeftColor: percent < 75 ? 'transparent' : vaultColor,
                                transform: [{ rotate: `${(percent / 100) * 360 - 90}deg` }],
                                opacity: 0.9,
                              },
                            ]}
                          />
                        )}
                        {/* Center Icon + Percent */}
                        <View style={[styles.vaultRingCenter, { width: RING_SIZE - RING_THICKNESS * 2 - 4, height: RING_SIZE - RING_THICKNESS * 2 - 4, borderRadius: (RING_SIZE - RING_THICKNESS * 2 - 4) / 2 }]}>
                          <Ionicons name={getVaultIcon(v.icon)} size={16} color={vaultColor} />
                          <Text style={[styles.vaultRingPct, { color: vaultColor }]}>{percent}%</Text>
                        </View>
                      </View>

                      {/* Vault Info */}
                      <View style={styles.vaultCardInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.vaultCardName} numberOfLines={1}>{v.name}</Text>
                          {v.isLocked && (
                            <Ionicons name="lock-closed" size={11} color={Colors.textMuted} />
                          )}
                          {v.isCompleted && (
                            <Ionicons name="checkmark-circle" size={14} color={vaultColor} />
                          )}
                        </View>

                        <Text style={styles.vaultCardSaved}>
                          <Text style={[styles.vaultCardSavedAmt, { color: vaultColor }]}>
                            {currencySymbol}{Number(v.currentAmount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </Text>
                          <Text style={styles.vaultCardOf}> of </Text>
                          <Text style={styles.vaultCardTarget}>
                            {currencySymbol}{Number(v.targetAmount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </Text>
                        </Text>

                        {/* ETA */}
                        {eta && !v.isCompleted && (
                          <Text style={styles.vaultCardETA}>
                            🗓 Goal by {eta}
                          </Text>
                        )}
                        {v.isCompleted && (
                          <Text style={[styles.vaultCardETA, { color: vaultColor }]}>
                            ✅ Goal reached!
                          </Text>
                        )}
                      </View>

                      {/* Delete Button */}
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert('Delete Vault', `Remove "${v.name}" savings vault?`, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: async () => {
                                try {
                                  await api.delete(`/api/vaults/${v.id}`);
                                  fetchData();
                                } catch (err: any) {
                                  Alert.alert('Error', err.message || 'Failed to delete vault');
                                }
                              },
                            },
                          ]);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={14} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>

                    {/* Progress Track */}
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressBar, { width: `${percent}%`, backgroundColor: vaultColor }]} />
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
                        <Text style={styles.vaultActionTextDeposit}>Add Funds</Text>
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
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Savings Vault</Text>
              <TouchableOpacity onPress={() => setVaultModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Icon Picker */}
            <Text style={styles.modalLabel}>Choose an Icon</Text>
            <View style={styles.iconPickerRow}>
              {VAULT_ICONS.map((icon) => {
                const isSelected = selectedVaultIcon === icon.icon;
                return (
                  <TouchableOpacity
                    key={icon.icon}
                    style={[styles.iconPickerBtn, isSelected && { borderColor: selectedVaultColor, backgroundColor: `${selectedVaultColor}20` }]}
                    onPress={() => setSelectedVaultIcon(icon.icon)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.iconPickerEmoji}>{icon.emoji}</Text>
                    <Text style={[styles.iconPickerLabel, isSelected && { color: selectedVaultColor }]}>{icon.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Color Picker */}
            <Text style={styles.modalLabel}>Choose a Color</Text>
            <View style={styles.colorPickerRow}>
              {VAULT_COLORS.map((c) => {
                const isSelected = selectedVaultColor === c.hex;
                return (
                  <TouchableOpacity
                    key={c.hex}
                    style={[styles.colorPickerBtn, { backgroundColor: c.hex }, isSelected && styles.colorPickerBtnSelected]}
                    onPress={() => setSelectedVaultColor(c.hex)}
                    activeOpacity={0.8}
                  >
                    {isSelected && <Ionicons name="checkmark" size={16} color={Colors.white} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.modalLabel}>Goal / Vault Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Emergency Fund, New PC, Travel"
              placeholderTextColor={Colors.textMuted}
              value={vaultNameInput}
              onChangeText={setVaultNameInput}
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

            <Text style={styles.modalLabel}>Initial Deposit (Optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={vaultInitialInput}
              onChangeText={setVaultInitialInput}
            />

            <Text style={styles.modalLabel}>Target Date (Optional, YYYY-MM-DD)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 2026-12-31"
              placeholderTextColor={Colors.textMuted}
              value={vaultTargetDateInput}
              onChangeText={setVaultTargetDateInput}
            />

            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: selectedVaultColor }, savingVault && { opacity: 0.6 }]}
              onPress={handleSaveVault}
              disabled={savingVault}
            >
              {savingVault ? (
                <ActivityIndicator color={Colors.black} size="small" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Create Vault</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
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
    paddingBottom: 120,
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
  // ─── Upgraded Vault Card ────────────────────────────────────────────────
  vaultCard: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  vaultCardCompleted: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  vaultCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  vaultRingBg: {
    position: 'absolute',
  },
  vaultRingFill: {
    position: 'absolute',
  },
  vaultRingCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: Colors.surfaceCard,
  },
  vaultRingPct: {
    fontSize: 9,
    fontWeight: '700',
  },
  vaultCardInfo: {
    flex: 1,
    gap: 3,
  },
  vaultCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  vaultCardSaved: {
    fontSize: 13,
    fontWeight: '600',
  },
  vaultCardSavedAmt: {
    fontSize: 15,
    fontWeight: '700',
  },
  vaultCardOf: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  vaultCardTarget: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  vaultCardETA: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
    marginTop: 2,
  },
  // ─── Icon & Color Pickers ────────────────────────────────────────────────
  iconPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  iconPickerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '22%',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSubtle,
    gap: 2,
  },
  iconPickerEmoji: {
    fontSize: 20,
  },
  iconPickerLabel: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
  colorPickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 4,
  },
  colorPickerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPickerBtnSelected: {
    borderWidth: 3,
    borderColor: Colors.white,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E1B16',
    borderWidth: 1,
    borderColor: '#78350F',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  offlineBannerText: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '500',
  },
});
