import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
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
  const [modalVisible, setModalVisible] = useState(false);

  // New parcel modal state
  const [platform, setPlatform] = useState<'SHOPEE' | 'LAZADA' | 'GROCERY' | 'OTHER'>('SHOPEE');
  const [merchant, setMerchant] = useState('');
  const [items, setItems] = useState('');
  const [amount, setAmount] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currencySymbol = user?.currency === 'USD' ? '$' : '₱';

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

  const handleAddOrder = async () => {
    const parsedAmount = parseFloat(amount.replace(/,/g, '')) || 0;
    setSubmitting(true);
    try {
      await api.post('/api/tracker', {
        platform,
        merchant: merchant.trim() || platform,
        items: items.trim() || 'Online Order',
        amount: parsedAmount,
        trackingNumber: trackingNumber.trim() || undefined,
        status: 'TO_SHIP',
        orderDate: new Date().toISOString(),
      });

      setMerchant('');
      setItems('');
      setAmount('');
      setTrackingNumber('');
      setModalVisible(false);
      fetchOrders();
    } catch (err) {
      console.warn('Failed to add order:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const totalSpent = orders.reduce((acc, o) => acc + (o.amount || 0), 0);
  const inTransitCount = orders.filter((o) => o.status === 'IN_TRANSIT' || o.status === 'TO_SHIP').length;

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
      <View style={styles.header}>
        <Text style={styles.title}>Shopee & Grocery Tracker</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={16} color={Colors.black} />
          <Text style={styles.addBtnText}>+ Parcel</Text>
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
            Tap "+ Parcel" to log incoming Shopee orders, Lazada deliveries, or groceries.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {orders.map((o) => (
            <View key={o.id} style={styles.orderCard}>
              <View style={styles.orderTop}>
                <View style={styles.platformBadge}>
                  <Ionicons
                    name={
                      o.platform === 'GROCERY'
                        ? 'basket-outline'
                        : 'bag-handle-outline'
                    }
                    size={13}
                    color={Colors.white}
                  />
                  <Text style={styles.platformText}>{o.platform}</Text>
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
                  Tracking: {o.trackingNumber}
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
            </View>
          ))}
        </View>
      )}

      {/* Add Parcel Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Package / Grocery</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              {/* Platform Selector */}
              <View style={styles.platformRow}>
                {(['SHOPEE', 'LAZADA', 'GROCERY', 'OTHER'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.platformPill,
                      platform === p && styles.platformPillActive,
                    ]}
                    onPress={() => setPlatform(p)}
                  >
                    <Text
                      style={[
                        styles.platformPillText,
                        platform === p && styles.platformPillTextActive,
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Items / Description (e.g. Wireless Mouse)"
                placeholderTextColor={Colors.textMuted}
                value={items}
                onChangeText={setItems}
              />

              <TextInput
                style={styles.input}
                placeholder="Merchant / Store Name"
                placeholderTextColor={Colors.textMuted}
                value={merchant}
                onChangeText={setMerchant}
              />

              <TextInput
                style={styles.input}
                placeholder="Amount (₱)"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
              />

              <TextInput
                style={styles.input}
                placeholder="Tracking # (Optional)"
                placeholderTextColor={Colors.textMuted}
                value={trackingNumber}
                onChangeText={setTrackingNumber}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleAddOrder}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={Colors.black} />
                ) : (
                  <Text style={styles.submitBtnText}>Add to Tracker</Text>
                )}
              </TouchableOpacity>
            </View>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  modalForm: {
    gap: 12,
  },
  platformRow: {
    flexDirection: 'row',
    gap: 6,
  },
  platformPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  platformPillActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
  },
  platformPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  platformPillTextActive: {
    color: Colors.black,
  },
  input: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.white,
  },
  submitBtn: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnText: {
    color: Colors.black,
    fontSize: 14,
    fontWeight: '700',
  },
});
