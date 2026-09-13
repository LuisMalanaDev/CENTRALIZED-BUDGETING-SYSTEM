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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../constants/theme';
import { api } from '../api/client';
import { DateFilterBar } from '../components/DateFilterBar';
import { DateRangeFilter, TrackerOrder } from '../types';

interface TrackerScreenProps {
  filter: DateRangeFilter;
  onFilterChange: (filter: DateRangeFilter) => void;
}

export const TrackerScreen: React.FC<TrackerScreenProps> = ({
  filter,
  onFilterChange,
}) => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<TrackerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<TrackerOrder | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const currencySymbol = user?.currency === 'USD' ? '$' : '₱';

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      await fetchOrders();
    } finally {
      setTimeout(() => setIsScanning(false), 600);
    }
  };

  const fetchOrders = useCallback(async () => {
    try {
      let query = '';
      if (filter.startDate && filter.endDate) {
        query = `?startDate=${filter.startDate}&endDate=${filter.endDate}`;
      }
      const res = await api.get<{ orders: TrackerOrder[] }>(`/api/tracker${query}`).catch(() => ({
        orders: [],
      }));
      setOrders(res.orders || []);
    } catch (e) {
      console.warn('Tracker fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const totalSpent = orders.reduce((acc, o) => acc + (o.amount || 0), 0);
  const inTransitCount = orders.filter((o) => o.status === 'IN_TRANSIT' || o.status === 'TO_SHIP').length;
  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const paginatedOrders = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
      {/* Title & Rescan Action */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Orders & Delivery</Text>
          <Text style={styles.headerSub}>Auto-synced from your emails</Text>
        </View>

        <TouchableOpacity
          style={styles.rescanBtn}
          onPress={handleRescan}
          disabled={isScanning}
          activeOpacity={0.8}
        >
          {isScanning ? (
            <ActivityIndicator size="small" color={Colors.black} />
          ) : (
            <Ionicons name="sync" size={13} color={Colors.black} />
          )}
          <Text style={styles.rescanBtnText}>
            {isScanning ? 'Syncing...' : 'Rescan'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hero Stats */}
      <View style={styles.heroRow}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>PARCEL SPEND</Text>
          <Text style={styles.heroValue}>
            {currencySymbol}
            {totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>ACTIVE DELIVERIES</Text>
          <Text style={styles.heroValue}>{inTransitCount} items</Text>
        </View>
      </View>

      {/* Date Filter Bar */}
      <DateFilterBar filter={filter} onFilterChange={onFilterChange} />

      {/* Orders List */}
      {loading ? (
        <ActivityIndicator color={Colors.white} style={{ marginVertical: 30 }} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="cube-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No packages tracked yet</Text>
          <Text style={styles.emptySubtext}>
            Incoming online orders (Shopee, Lazada, etc.) automatically sync from your connected email receipts.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {paginatedOrders.map((o) => {
            let platformIcon: any = 'bag-handle-outline';
            if (o.platform === 'GROCERY') platformIcon = 'basket-outline';
            else if (o.platform === 'GOOGLE_PLAY') platformIcon = 'logo-google-playstore';
            else if (o.platform === 'STEAM') platformIcon = 'game-controller-outline';
            else if (o.platform === 'ROBLOX') platformIcon = 'cube-outline';

            return (
              <TouchableOpacity
                key={o.id}
                style={styles.orderCard}
                activeOpacity={0.7}
                onPress={() => setSelectedOrder(o)}
              >
                <View style={styles.orderTop}>
                  <View style={styles.platformBadge}>
                    <Ionicons
                      name={platformIcon}
                      size={13}
                      color={Colors.white}
                    />
                    <Text style={styles.platformText}>
                      {o.platform === 'GOOGLE_PLAY' ? 'GOOGLE PLAY' : o.platform}
                    </Text>
                  </View>

                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{o.status}</Text>
                  </View>
                </View>

                <Text style={styles.itemsTitle} numberOfLines={2}>
                  {o.items || o.merchant || 'Package'}
                </Text>

                {o.trackingNumber ? (
                  <Text style={styles.trackingText}>
                    Tracking / Ref: {o.trackingNumber}
                  </Text>
                ) : null}

                <View style={styles.orderBottom}>
                  <Text style={styles.orderDate}>
                    {new Date(o.orderDate).toLocaleDateString()}
                  </Text>
                  <Text style={styles.orderAmount}>
                    {currencySymbol}
                    {o.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Pagination Controls */}
          {orders.length > PAGE_SIZE && (
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
                Page {page} of {totalPages} • {orders.length} items
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

    {/* Receipt Details Modal */}
    <Modal
      visible={!!selectedOrder}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedOrder(null)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons
                name={
                  selectedOrder?.platform === 'GROCERY'
                    ? 'basket'
                    : selectedOrder?.platform === 'GOOGLE_PLAY'
                    ? 'logo-google-playstore'
                    : selectedOrder?.platform === 'STEAM'
                    ? 'game-controller'
                    : selectedOrder?.platform === 'ROBLOX'
                    ? 'cube'
                    : 'bag-handle'
                }
                size={20}
                color={Colors.white}
              />
              <Text style={styles.modalTitle}>Receipt & Order Details</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {selectedOrder && (
            <View style={styles.modalBody}>
              <View style={styles.heroAmountBox}>
                <Text style={styles.heroAmountText}>
                  {currencySymbol}
                  {selectedOrder.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
                <View style={styles.heroStatusRow}>
                  <View style={styles.platformBadge}>
                    <Text style={styles.platformText}>
                      {selectedOrder.platform === 'GOOGLE_PLAY' ? 'GOOGLE PLAY' : selectedOrder.platform}
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{selectedOrder.status}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.modalDetailsList}>
                <View style={styles.modalDetailStacked}>
                  <Text style={styles.modalDetailLabel}>Item(s) / Merchant</Text>
                  <Text style={styles.modalItemValue}>
                    {selectedOrder.items || selectedOrder.merchant || 'Package'}
                  </Text>
                </View>

                {selectedOrder.trackingNumber || selectedOrder.orderId ? (
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Tracking / Order Ref</Text>
                    <Text selectable={true} style={styles.trackingNumberValue}>
                      {selectedOrder.trackingNumber || selectedOrder.orderId}
                    </Text>
                  </View>
                ) : null}

                {selectedOrder.paymentMethod ? (
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Payment Method</Text>
                    <Text style={styles.modalDetailValue}>{selectedOrder.paymentMethod}</Text>
                  </View>
                ) : null}

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalDetailLabel}>Order Date</Text>
                  <Text style={styles.modalDetailValue}>
                    {new Date(selectedOrder.orderDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>

                <View style={styles.syncBadgeRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                  <Text style={styles.syncBadgeText}>Verified & Auto-Synced via Email Receipt</Text>
                </View>

                {selectedOrder.notes ? (
                  <View style={styles.modalDetailStacked}>
                    <Text style={styles.modalDetailLabel}>Notes</Text>
                    <Text style={styles.modalDetailNote}>{selectedOrder.notes}</Text>
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.modalDoneBtn}
                onPress={() => setSelectedOrder(null)}
              >
                <Text style={styles.modalDoneBtnText}>Done</Text>
              </TouchableOpacity>
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
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  autoSyncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  autoSyncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  autoSyncText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  rescanBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.black,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  heroCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  heroValue: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
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
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  platformText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  statusBadge: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  itemsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  trackingText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  orderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  orderDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  orderAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
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
    gap: 8,
  },
  heroAmountText: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  heroStatusRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
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
  modalItemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
    lineHeight: 20,
  },
  trackingNumberValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38BDF8',
  },
  syncBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  modalDetailNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
    backgroundColor: Colors.surfaceSubtle,
    padding: 10,
    borderRadius: 8,
  },
  modalDoneBtn: {
    backgroundColor: Colors.white,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  modalDoneBtnText: {
    color: Colors.black,
    fontSize: 14,
    fontWeight: '700',
  },
});
