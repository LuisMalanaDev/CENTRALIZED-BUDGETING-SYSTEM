import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';
import { api } from '../api/client';
import { DateFilterBar } from '../components/DateFilterBar';
import { DateRangeFilter, Transaction } from '../types';
import { getCategoryName } from '../utils/format';
import { offlineStorage } from '../services/offlineStorage';

const CATEGORY_OPTIONS = [
  { id: 'ALL', label: 'All', icon: 'apps-outline' },
  { id: 'Transportation', label: 'Transpo', icon: 'car-outline' },
  { id: 'Food & Dining', label: 'Food & Dining', icon: 'restaurant-outline' },
  { id: 'Groceries', label: 'Groceries', icon: 'basket-outline' },
  { id: 'Bills & Utilities', label: 'Bills', icon: 'receipt-outline' },
  { id: 'Shopping', label: 'Shopping', icon: 'cart-outline' },
  { id: 'Entertainment', label: 'Entertainment', icon: 'game-controller-outline' },
  { id: 'Personal Care', label: 'Personal', icon: 'heart-outline' },
  { id: 'Other Expense', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

interface LedgerScreenProps {
  filter: DateRangeFilter;
  onFilterChange: (filter: DateRangeFilter) => void;
  onOpenQuickLog: () => void;
}

export const LedgerScreen: React.FC<LedgerScreenProps> = ({
  filter,
  onFilterChange,
  onOpenQuickLog,
}) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const currencySymbol = user?.currency === 'USD' ? '$' : '₱';

  // Instant Cache Hydration on startup (0.01s instant data rendering)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let cachedTxs: Transaction[] = [];
        const cachedLedger = await offlineStorage.getLedgerCache();
        if (cachedLedger && cachedLedger.transactions?.length > 0) {
          cachedTxs = cachedLedger.transactions;
        } else {
          const cachedOverview = await offlineStorage.getOverviewCache();
          if (cachedOverview && cachedOverview.transactions?.length > 0) {
            cachedTxs = cachedOverview.transactions;
          }
        }

        const offlineQueue = await offlineStorage.getOfflineQueue();
        const offlineTxs: Transaction[] = offlineQueue.map((item) => ({
          id: item.tempId,
          amount: item.amount,
          type: item.type,
          category: item.category,
          paymentMethod: item.paymentMethod,
          description: item.description,
          date: item.date,
          isOfflinePending: true,
        }));

        if (mounted) {
          const initialTxs = [...offlineTxs, ...cachedTxs];
          if (initialTxs.length > 0) {
            setTransactions(initialTxs);
            setLoading(false);
          }
        }
      } catch (e) {
        console.warn('Ledger cache hydration error:', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      let query = '';
      if (filter.startDate && filter.endDate) {
        query = `?startDate=${filter.startDate}&endDate=${filter.endDate}`;
      }
      // DO NOT catch and return fake empty arrays! Let network error throw to preserve cache!
      const res = await api.get<{ transactions: Transaction[] }>(`/api/transactions${query}`);

      const offlineQueue = await offlineStorage.getOfflineQueue();
      const offlineTxs: Transaction[] = offlineQueue.map((item) => ({
        id: item.tempId,
        amount: item.amount,
        type: item.type,
        category: item.category,
        paymentMethod: item.paymentMethod,
        description: item.description,
        date: item.date,
        isOfflinePending: true,
      }));

      const serverTxs = res.transactions || [];
      const combined = [...offlineTxs, ...serverTxs];
      setTransactions(combined);

      if (serverTxs.length > 0) {
        offlineStorage.saveLedgerCache(serverTxs);
      }
    } catch (e: any) {
      console.warn('Ledger fetch error (offline):', e?.message || e);
      // DEVICE IS OFFLINE: Restore and retain cached transactions + offline queue!
      try {
        const cached = await offlineStorage.getLedgerCache();
        const offlineQueue = await offlineStorage.getOfflineQueue();
        const offlineTxs: Transaction[] = offlineQueue.map((item) => ({
          id: item.tempId,
          amount: item.amount,
          type: item.type,
          category: item.category,
          paymentMethod: item.paymentMethod,
          description: item.description,
          date: item.date,
          isOfflinePending: true,
        }));
        const combined = [...offlineTxs, ...(cached?.transactions || [])];
        if (combined.length > 0) {
          setTransactions(combined);
        }
      } catch (cacheErr) {
        console.warn('Ledger cache restore error:', cacheErr);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const confirmDeleteTransaction = (tx: Transaction) => {
    Alert.alert(
      'Delete Transaction',
      `Are you sure you want to permanently delete this ${tx.type === 'INCOME' ? 'income' : 'expense'} entry of ${currencySymbol}${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteTransaction(tx.id),
        },
      ]
    );
  };

  const handleDeleteTransaction = async (txId: string) => {
    const previous = [...transactions];
    const updated = transactions.filter((t) => t.id !== txId);
    setTransactions(updated);

    try {
      await offlineStorage.saveLedgerCache(updated.filter((t) => !t.isOfflinePending));

      const queue = await offlineStorage.getOfflineQueue();
      const inQueue = queue.some((item) => item.tempId === txId);
      if (inQueue) {
        await offlineStorage.removeOfflineTransaction(txId);
        return;
      }

      await api.delete(`/api/transactions/${txId}`);
    } catch (err: any) {
      console.warn('Failed to delete transaction:', err);
      setTransactions(previous);
      Alert.alert('Error', err?.message || 'Could not delete transaction. Please try again.');
    }
  };

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, filter, selectedCategory]);

  const filteredTransactions = transactions.filter((tx) => {
    // 1. Exclude online orders and email-synced receipts (these belong exclusively in Tracker)
    const isOnlineReceipt =
      tx.isShopeeOrder ||
      tx.source?.toLowerCase().includes('email') ||
      tx.source?.toLowerCase().includes('sync') ||
      tx.source?.toLowerCase().includes('shopee') ||
      tx.source?.toLowerCase().includes('lazada') ||
      tx.source?.toLowerCase().includes('google play') ||
      tx.tags?.some((t) =>
        ['Shopee', 'Lazada', 'Google Play', 'Steam', 'Roblox', 'Parcel', 'Online Orders', 'Email Auto-Forward'].includes(t)
      );

    if (isOnlineReceipt) return false;

    // 2. Type filter (+Log Inflow vs Expense)
    if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;

    // 3. Category filter (Transportation, Food, Groceries, etc.)
    if (selectedCategory !== 'ALL') {
      const catName = getCategoryName(tx.category, '').toLowerCase();
      const target = selectedCategory.toLowerCase();

      const isMatch =
        catName.includes(target) ||
        (target.includes('transpo') && (catName.includes('transpo') || catName.includes('commute') || catName.includes('gas'))) ||
        (target.includes('food') && (catName.includes('food') || catName.includes('dining') || catName.includes('restaurant'))) ||
        (target.includes('grocer') && (catName.includes('grocer') || catName.includes('supermarket'))) ||
        (target.includes('bill') && (catName.includes('bill') || catName.includes('utility'))) ||
        (target.includes('shop') && (catName.includes('shop') || catName.includes('retail')));

      if (!isMatch) return false;
    }

    // 4. Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchCat = getCategoryName(tx.category, '').toLowerCase().includes(q);
      const matchDesc = tx.description?.toLowerCase().includes(q);
      const matchMethod = tx.paymentMethod?.toLowerCase().includes(q);
      return matchCat || matchDesc || matchMethod;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const paginatedTransactions = filteredTransactions.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  return (
    <View style={styles.root}>
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
      {/* Title Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Transaction Ledger</Text>
        <TouchableOpacity
          style={styles.quickLogHeaderBtn}
          onPress={onOpenQuickLog}
        >
          <Ionicons name="add" size={16} color={Colors.black} />
          <Text style={styles.quickLogHeaderText}>Log</Text>
        </TouchableOpacity>
      </View>

      {/* Date Filter Bar */}
      <DateFilterBar filter={filter} onFilterChange={onFilterChange} />

      {/* Category Filter Horizontal Scroll */}
      <View style={styles.categoryFilterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORY_OPTIONS.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryPill,
                  isSelected && styles.categoryPillActive,
                ]}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={12}
                  color={isSelected ? Colors.black : Colors.textMuted}
                />
                <Text
                  style={[
                    styles.categoryPillText,
                    isSelected && styles.categoryPillTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search merchant, category, or note..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Type Toggle Pills */}
      <View style={styles.pillsRow}>
        {(['ALL', 'EXPENSE', 'INCOME'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.filterPill,
              typeFilter === t && styles.filterPillActive,
            ]}
            onPress={() => setTypeFilter(t)}
          >
            <Text
              style={[
                styles.filterPillText,
                typeFilter === t && styles.filterPillTextActive,
              ]}
            >
              {t === 'ALL' ? 'All' : t === 'EXPENSE' ? 'Expenses (−)' : 'Inflows (+)'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions List */}
      {loading ? (
        <ActivityIndicator color={Colors.white} style={{ marginVertical: 30 }} />
      ) : filteredTransactions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="receipt-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No matching transactions</Text>
          <Text style={styles.emptySubtext}>
            Try clearing search filters or pick another date from the calendar.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {paginatedTransactions.map((tx) => {
            const isIncome = tx.type === 'INCOME';
            const dateObj = new Date(tx.date);
            const dateFormatted = dateObj.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <TouchableOpacity
                key={tx.id}
                style={styles.txCard}
                activeOpacity={0.7}
                onPress={() => setSelectedTx(tx)}
              >
                <View style={styles.txCardTop}>
                  <View style={styles.txCategoryBox}>
                    <Ionicons
                      name={isIncome ? 'arrow-down' : 'arrow-up'}
                      size={14}
                      color={Colors.white}
                    />
                    <Text style={styles.txCategoryText} numberOfLines={1}>
                      {getCategoryName(tx.category)}
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

                {tx.description ? (
                  <Text style={styles.txDescription} numberOfLines={2}>
                    {tx.description}
                  </Text>
                ) : null}

                <View style={styles.txMetaRow}>
                  <View style={styles.txMetaLeft}>
                    <View style={styles.pmBadge}>
                      <Text style={styles.pmBadgeText}>{tx.paymentMethod}</Text>
                    </View>
                    {tx.isOfflinePending && (
                      <View style={styles.offlineBadge}>
                        <Ionicons name="cloud-offline-outline" size={10} color="#F59E0B" />
                        <Text style={styles.offlineBadgeText}>Offline</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.txMetaRight}>
                    <Text style={styles.txDateText}>{dateFormatted}</Text>
                    <TouchableOpacity
                      style={styles.cardDeleteBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        confirmDeleteTransaction(tx);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Pagination Controls */}
          {filteredTransactions.length > PAGE_SIZE && (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
                disabled={page === 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Ionicons
                  name="chevron-back"
                  size={16}
                  color={page === 1 ? Colors.textMuted : Colors.white}
                />
                <Text
                  style={[
                    styles.pageBtnText,
                    page === 1 && styles.pageBtnTextDisabled,
                  ]}
                >
                  Prev
                </Text>
              </TouchableOpacity>

              <Text style={styles.pageInfoText}>
                Page {page} of {totalPages} • {filteredTransactions.length} items
              </Text>

              <TouchableOpacity
                style={[
                  styles.pageBtn,
                  page === totalPages && styles.pageBtnDisabled,
                ]}
                disabled={page === totalPages}
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <Text
                  style={[
                    styles.pageBtnText,
                    page === totalPages && styles.pageBtnTextDisabled,
                  ]}
                >
                  Next
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={page === totalPages ? Colors.textMuted : Colors.white}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>

    {/* Transaction Details Modal */}
    <Modal
      visible={!!selectedTx}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedTx(null)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons
                name={selectedTx?.type === 'INCOME' ? 'arrow-down-circle' : 'arrow-up-circle'}
                size={22}
                color={Colors.white}
              />
              <Text style={styles.modalTitle}>Transaction Details</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedTx(null)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {selectedTx && (
            <View style={styles.modalBody}>
              <View style={styles.heroAmountBox}>
                <Text
                  style={[
                    styles.heroAmountText,
                    selectedTx.type === 'INCOME' ? styles.txAmountIncome : styles.txAmountExpense,
                  ]}
                >
                  {selectedTx.type === 'INCOME' ? '+' : '−'}
                  {currencySymbol}
                  {selectedTx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>
                    {selectedTx.type === 'INCOME' ? 'Custom Cash Inflow' : 'Custom Expense'}
                  </Text>
                </View>
              </View>

              <View style={styles.modalDetailsList}>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Category</Text>
                  <Text style={styles.modalDetailValue}>{getCategoryName(selectedTx.category)}</Text>
                </View>

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Payment Method</Text>
                  <Text style={styles.modalDetailValue}>{selectedTx.paymentMethod}</Text>
                </View>

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Date & Time</Text>
                  <Text style={styles.modalDetailValue}>
                    {new Date(selectedTx.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                {selectedTx.description ? (
                  <View style={styles.modalDetailStacked}>
                    <Text style={styles.modalDetailLabel}>Description / Notes</Text>
                    <Text style={styles.modalDetailNote}>{selectedTx.description}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.modalDeleteBtn}
                  onPress={() => {
                    const toDelete = selectedTx;
                    setSelectedTx(null);
                    confirmDeleteTransaction(toDelete);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text style={styles.modalDeleteBtnText}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalDoneBtn}
                  onPress={() => setSelectedTx(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalDoneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.4,
  },
  quickLogHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  quickLogHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.black,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.white,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: Colors.black,
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
  list: {
    gap: 10,
  },
  txCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },
  txCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txCategoryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  txCategoryText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  txAmountIncome: {
    color: Colors.white,
  },
  txAmountExpense: {
    color: Colors.textSecondary,
  },
  txDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  txMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  pmBadge: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pmBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  txDateText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  txMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  txMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardDeleteBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 22,
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    gap: 16,
  },
  heroAmountBox: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroAmountText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  heroBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalDetailsList: {
    gap: 12,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalDetailStacked: {
    gap: 4,
    paddingTop: 4,
  },
  modalDetailLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  modalDetailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  modalDetailNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    backgroundColor: Colors.surfaceSubtle,
    padding: 10,
    borderRadius: 8,
  },
  modalActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  modalDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalDeleteBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  modalDoneBtn: {
    flex: 2,
    backgroundColor: Colors.white,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalDoneBtnText: {
    color: Colors.black,
    fontSize: 14,
    fontWeight: '700',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  offlineBadgeText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  categoryFilterWrapper: {
    marginBottom: 12,
  },
  categoryScroll: {
    gap: 8,
    paddingRight: 10,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryPillActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryPillTextActive: {
    color: Colors.black,
    fontWeight: '700',
  },
});
