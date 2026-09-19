import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { DateRangeFilter, TrackerOrder } from '../types';
import { offlineStorage } from '../services/offlineStorage';

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

  // Edit Order State
  const [isEditing, setIsEditing] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editItems, setEditItems] = useState('');
  const [editStatus, setEditStatus] = useState<TrackerOrder['status']>('IN_TRANSIT');
  const [editPaymentMethod, setEditPaymentMethod] = useState('GCASH');
  const [editTrackingNumber, setEditTrackingNumber] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const currencySymbol = user?.currency === 'USD' ? '$' : '₱';

  // Instant Cache Hydration on startup (0.01s instant data rendering)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cached = await offlineStorage.getTrackerCache();
        if (cached && mounted && cached.orders?.length) {
          setOrders(cached.orders);
          setLoading(false);
        }
      } catch (e) {
        console.warn('Tracker cache hydration error:', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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
      // DO NOT catch with empty array. Let network error throw to preserve cache!
      const res = await api.get<{ orders: TrackerOrder[] }>(`/api/tracker${query}`);
      const serverOrders = res.orders || [];
      setOrders(serverOrders);

      if (serverOrders.length > 0) {
        offlineStorage.saveTrackerCache(serverOrders);
      }
    } catch (e: any) {
      console.warn('Tracker fetch error (offline):', e?.message || e);
      // DEVICE IS OFFLINE: Restore and retain cached orders!
      try {
        const cached = await offlineStorage.getTrackerCache();
        if (cached && cached.orders?.length) {
          setOrders(cached.orders);
        }
      } catch (cacheErr) {
        console.warn('Tracker cache restore error:', cacheErr);
      }
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

  const confirmDeleteOrder = (order: TrackerOrder) => {
    const itemName = order.items || order.merchant || 'this order';
    Alert.alert(
      'Delete Tracked Order',
      `Are you sure you want to permanently delete "${itemName}" (${currencySymbol}${order.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })})? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteOrder(order.id),
        },
      ]
    );
  };

  const handleDeleteOrder = async (orderId: string) => {
    const target = orders.find((o) => o.id === orderId);
    const previous = [...orders];
    const updated = orders.filter((o) => o.id !== orderId);
    setOrders(updated);

    try {
      await offlineStorage.saveTrackerCache(updated);
      if (target) {
        await offlineStorage.removeTransactionFromOverviewCache(
          target.id,
          target.amount,
          'EXPENSE',
          target.paymentMethod
        );
      }
      await api.delete(`/api/tracker/${orderId}`);
    } catch (err: any) {
      console.warn('Failed to delete order:', err);
      setOrders(previous);
      Alert.alert('Error', err?.message || 'Could not delete order. Please try again.');
    }
  };

  const STATUS_OPTIONS: { id: TrackerOrder['status']; label: string; icon: string }[] = [
    { id: 'PENDING', label: 'Pending', icon: 'hourglass-outline' },
    { id: 'TO_SHIP', label: 'To Ship', icon: 'time-outline' },
    { id: 'IN_TRANSIT', label: 'In Transit', icon: 'airplane-outline' },
    { id: 'DELIVERED', label: 'Delivered', icon: 'checkmark-circle-outline' },
    { id: 'COMPLETED', label: 'Completed', icon: 'shield-checkmark-outline' },
    { id: 'CANCELLED', label: 'Cancelled', icon: 'close-circle-outline' },
  ];

  const PAYMENT_METHOD_OPTIONS = [
    { id: 'COD', label: 'COD', icon: 'cash-outline' },
    { id: 'GCASH', label: 'GCash', icon: 'wallet-outline' },
    { id: 'MAYA', label: 'Maya', icon: 'card-outline' },
    { id: 'SPAYLATER', label: 'SPayLater', icon: 'phone-portrait-outline' },
    { id: 'CREDIT_CARD', label: 'Credit Card', icon: 'card-outline' },
    { id: 'DEBIT_CARD', label: 'Debit Card', icon: 'card-outline' },
    { id: 'CASH', label: 'Cash', icon: 'cash-outline' },
  ];

  const handleStartEdit = () => {
    if (!selectedOrder) return;
    setEditAmount(String(selectedOrder.amount || ''));
    setEditItems(selectedOrder.items || selectedOrder.merchant || '');
    setEditStatus(selectedOrder.status || 'IN_TRANSIT');
    setEditPaymentMethod(selectedOrder.paymentMethod || 'GCASH');
    setEditTrackingNumber(selectedOrder.trackingNumber || selectedOrder.orderId || '');
    setEditNotes(selectedOrder.notes || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedOrder) return;
    const num = parseFloat(editAmount.replace(/,/g, ''));
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive amount.');
      return;
    }

    setSavingEdit(true);
    try {
      const oldAmount = selectedOrder.amount;
      const updatedOrderData: TrackerOrder = {
        ...selectedOrder,
        amount: num,
        items: editItems.trim() || selectedOrder.items || selectedOrder.merchant || 'Package',
        merchant: editItems.trim() || selectedOrder.merchant || 'Package',
        status: editStatus,
        paymentMethod: editPaymentMethod,
        trackingNumber: editTrackingNumber.trim() || undefined,
        orderId: editTrackingNumber.trim() || selectedOrder.orderId,
        notes: editNotes.trim() || undefined,
      };

      // 1. Send update to Backend API
      await api.put(`/api/tracker/${selectedOrder.id}`, {
        amount: num,
        items: editItems.trim() || selectedOrder.items || selectedOrder.merchant || 'Package',
        status: editStatus,
        paymentMethod: editPaymentMethod,
        trackingNumber: editTrackingNumber.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });

      // 2. Update local state immediately
      const updatedOrders = orders.map((o) =>
        o.id === selectedOrder.id ? updatedOrderData : o
      );
      setOrders(updatedOrders);

      // 3. Update offline caches immediately
      await offlineStorage.saveTrackerCache(updatedOrders);
      await offlineStorage.updateTransactionInOverviewCache(
        selectedOrder.id,
        oldAmount,
        num,
        'EXPENSE',
        editPaymentMethod,
        updatedOrderData.items
      );

      // 4. Update selectedOrder in modal and exit edit mode
      setSelectedOrder(updatedOrderData);
      setIsEditing(false);
      Alert.alert('Saved', 'Order details have been successfully updated.');
    } catch (err: any) {
      console.warn('Failed to update order:', err);
      Alert.alert('Update Failed', err?.message || 'Could not update order. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Platform / Store Filter State
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');

  const PLATFORM_PRESETS = [
    { id: 'ALL', label: 'All Stores', icon: 'apps-outline' },
    { id: 'SHOPEE', label: 'Shopee', icon: 'bag-handle-outline', color: '#EE4D2D' },
    { id: 'GOOGLE_PLAY', label: 'Google Play', icon: 'logo-google-playstore', color: '#01875F' },
    { id: 'LAZADA', label: 'Lazada', icon: 'cart-outline', color: '#3B82F6' },
    { id: 'OTHER', label: 'Other', icon: 'cube-outline', color: Colors.textMuted },
  ];

  // Price Range Filter State
  const [selectedPriceId, setSelectedPriceId] = useState<string>('ALL');
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customMin, setCustomMin] = useState('');
  const [customMax, setCustomMax] = useState('');
  const [appliedMin, setAppliedMin] = useState<number | null>(null);
  const [appliedMax, setAppliedMax] = useState<number | null>(null);

  const PRICE_PRESETS = [
    { id: 'ALL', label: 'All Amounts' },
    { id: 'UNDER_100', label: `< ${currencySymbol}100` },
    { id: '100_500', label: `${currencySymbol}100 - 500` },
    { id: '500_1000', label: `${currencySymbol}500 - 1K` },
    { id: 'OVER_1000', label: `> ${currencySymbol}1,000` },
  ];

  const handleSelectPreset = (id: string) => {
    setSelectedPriceId(id);
    setAppliedMin(null);
    setAppliedMax(null);
  };

  const handleApplyCustom = () => {
    const minVal = customMin.trim() ? parseFloat(customMin) : null;
    const maxVal = customMax.trim() ? parseFloat(customMax) : null;
    setAppliedMin(minVal);
    setAppliedMax(maxVal);
    setSelectedPriceId('CUSTOM');
    setCustomModalVisible(false);
  };

  const handleResetPriceFilter = () => {
    setSelectedPriceId('ALL');
    setCustomMin('');
    setCustomMax('');
    setAppliedMin(null);
    setAppliedMax(null);
    setCustomModalVisible(false);
  };

  let customLabel = 'Custom Range';
  if (appliedMin !== null && appliedMax !== null) {
    customLabel = `${currencySymbol}${appliedMin} - ${currencySymbol}${appliedMax}`;
  } else if (appliedMin !== null) {
    customLabel = `≥ ${currencySymbol}${appliedMin}`;
  } else if (appliedMax !== null) {
    customLabel = `≤ ${currencySymbol}${appliedMax}`;
  }

  const filteredOrders = orders.filter((o) => {
    // 1. Platform / Store Filter (Shopee, Google Play, Lazada, etc.)
    if (selectedPlatform !== 'ALL') {
      const plat = (o.platform || '').toUpperCase();
      const merch = (o.merchant || '').toUpperCase();
      const src = (o.source || '').toUpperCase();
      const notes = (o.notes || '').toUpperCase();
      const items = (o.items || '').toUpperCase();
      const combined = `${plat} ${merch} ${src} ${notes} ${items}`;

      if (selectedPlatform === 'SHOPEE') {
        if (!combined.includes('SHOPEE')) return false;
      } else if (selectedPlatform === 'GOOGLE_PLAY') {
        if (!combined.includes('GOOGLE') && !combined.includes('PLAY')) return false;
      } else if (selectedPlatform === 'LAZADA') {
        if (!combined.includes('LAZADA')) return false;
      } else if (selectedPlatform === 'OTHER') {
        if (combined.includes('SHOPEE') || combined.includes('GOOGLE') || combined.includes('PLAY') || combined.includes('LAZADA')) return false;
      }
    }

    // 2. Price Range Filter
    const amt = Number(o.amount) || 0;
    if (selectedPriceId === 'ALL') return true;
    if (selectedPriceId === 'UNDER_100') return amt < 100;
    if (selectedPriceId === '100_500') return amt >= 100 && amt <= 500;
    if (selectedPriceId === '500_1000') return amt >= 500 && amt <= 1000;
    if (selectedPriceId === 'OVER_1000') return amt > 1000;
    if (selectedPriceId === 'CUSTOM') {
      if (appliedMin !== null && amt < appliedMin) return false;
      if (appliedMax !== null && amt > appliedMax) return false;
      return true;
    }
    return true;
  });

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  useEffect(() => {
    setPage(1);
  }, [filter, selectedPlatform, selectedPriceId, appliedMin, appliedMax]);

  const getOrderPlatformKey = (o: TrackerOrder): 'SHOPEE' | 'GOOGLE_PLAY' | 'LAZADA' | 'OTHER' => {
    const combined = `${o.platform || ''} ${o.merchant || ''} ${o.source || ''} ${o.notes || ''} ${o.items || ''}`.toUpperCase();
    if (combined.includes('SHOPEE')) return 'SHOPEE';
    if (combined.includes('GOOGLE') || combined.includes('PLAY')) return 'GOOGLE_PLAY';
    if (combined.includes('LAZADA')) return 'LAZADA';
    return 'OTHER';
  };

  const totalSpent = filteredOrders.reduce((acc, o) => acc + (Number(o.amount) || 0), 0);
  const inTransitCount = filteredOrders.filter(
    (o) => o.status === 'IN_TRANSIT' || o.status === 'TO_SHIP' || o.status === 'PENDING'
  ).length;
  const deliveredCount = filteredOrders.filter(
    (o) => o.status === 'DELIVERED' || o.status === 'COMPLETED'
  ).length;

  const platformBreakdown = useMemo(() => {
    const map: Record<'SHOPEE' | 'GOOGLE_PLAY' | 'LAZADA' | 'OTHER', { label: string; color: string; amount: number; count: number }> = {
      SHOPEE: { label: 'Shopee', color: '#EE4D2D', amount: 0, count: 0 },
      GOOGLE_PLAY: { label: 'Google Play', color: '#01875F', amount: 0, count: 0 },
      LAZADA: { label: 'Lazada', color: '#3B82F6', amount: 0, count: 0 },
      OTHER: { label: 'Other', color: '#8B5CF6', amount: 0, count: 0 },
    };

    filteredOrders.forEach((o) => {
      const key = getOrderPlatformKey(o);
      const amt = Number(o.amount) || 0;
      map[key].amount += amt;
      map[key].count += 1;
    });

    return (['SHOPEE', 'GOOGLE_PLAY', 'LAZADA', 'OTHER'] as const)
      .filter((key) => map[key].amount > 0 || map[key].count > 0)
      .map((key) => ({
        key,
        ...map[key],
        percent: totalSpent > 0 ? (map[key].amount / totalSpent) * 100 : 0,
      }));
  }, [filteredOrders, totalSpent]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const paginatedOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

      {/* Online Spend & Parcel Counter Hero Card */}
      <View style={styles.trackerHeroCard}>
        <View style={styles.trackerHeroTop}>
          <View>
            <View style={styles.trackerHeroLabelRow}>
              <Ionicons name="cart-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.trackerHeroLabel}>ONLINE & PARCEL SPEND</Text>
            </View>
            <Text style={styles.trackerHeroAmount}>
              {currencySymbol}
              {totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>

          <View
            style={[
              styles.parcelStatusBadge,
              inTransitCount > 0 ? styles.parcelBadgeTransit : styles.parcelBadgeDelivered,
            ]}
          >
            <Ionicons
              name={inTransitCount > 0 ? 'cube' : 'checkmark-circle'}
              size={12}
              color={inTransitCount > 0 ? '#F59E0B' : '#10B981'}
            />
            <Text
              style={[
                styles.parcelStatusText,
                inTransitCount > 0 ? styles.parcelTextTransit : styles.parcelTextDelivered,
              ]}
            >
              {inTransitCount > 0
                ? `${inTransitCount} ON THE WAY`
                : filteredOrders.length > 0
                ? 'ALL DELIVERED'
                : 'NO ORDERS'}
            </Text>
          </View>
        </View>

        {totalSpent > 0 && platformBreakdown.length > 0 && (
          <View style={styles.platformBarSection}>
            <View style={styles.multiProgressBar}>
              {platformBreakdown.map((item) => (
                <View
                  key={item.key}
                  style={[
                    styles.progressBarSegment,
                    {
                      width: `${Math.max(item.percent, 3)}%`,
                      backgroundColor: item.color,
                    },
                  ]}
                />
              ))}
            </View>

            <View style={styles.platformLegendRow}>
              {platformBreakdown.map((item) => (
                <View key={item.key} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.legendLabel}>{item.label}</Text>
                  <Text style={styles.legendPercent}>{item.percent.toFixed(0)}%</Text>
                  <Text style={styles.legendAmount}>
                    ({currencySymbol}{item.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })})
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.trackerHeroMetaRow}>
          <Text style={styles.trackerHeroMetaText}>
            {filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'} tracked
          </Text>
          {deliveredCount > 0 && (
            <Text style={styles.trackerHeroMetaSub}>
              {deliveredCount} delivered / completed
            </Text>
          )}
        </View>
      </View>

      {/* Date Filter Bar */}
      <DateFilterBar filter={filter} onFilterChange={onFilterChange} />

      {/* Store / Platform Filter Pills */}
      <View style={styles.platformFilterContainer}>
        <View style={styles.priceFilterHeader}>
          <View style={styles.priceFilterLabelRow}>
            <Ionicons name="storefront-outline" size={11} color={Colors.textMuted} />
            <Text style={styles.priceFilterLabel}>STORE / PLATFORM</Text>
          </View>
          {selectedPlatform !== 'ALL' && (
            <TouchableOpacity onPress={() => setSelectedPlatform('ALL')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.priceResetBtn}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.platformScroll}
        >
          {PLATFORM_PRESETS.map((p) => {
            const isSelected = selectedPlatform === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.platformPill,
                  isSelected && styles.platformPillActive,
                ]}
                onPress={() => setSelectedPlatform(p.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={p.icon as any}
                  size={12}
                  color={isSelected ? Colors.black : p.color || Colors.textMuted}
                />
                <Text
                  style={[
                    styles.platformPillText,
                    isSelected && styles.platformPillTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Price Range Filter Pills */}
      <View style={styles.priceFilterContainer}>
        <View style={styles.priceFilterHeader}>
          <View style={styles.priceFilterLabelRow}>
            <Ionicons name="pricetag-outline" size={11} color={Colors.textMuted} />
            <Text style={styles.priceFilterLabel}>PRICE RANGE</Text>
          </View>
          {selectedPriceId !== 'ALL' && (
            <TouchableOpacity onPress={handleResetPriceFilter} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.priceResetBtn}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.priceChipsRow}
        >
          {PRICE_PRESETS.map((p) => {
            const isActive = selectedPriceId === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.priceChip, isActive && styles.priceChipActive]}
                onPress={() => handleSelectPreset(p.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.priceChipText, isActive && styles.priceChipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={[styles.priceChip, selectedPriceId === 'CUSTOM' && styles.priceChipActive]}
            onPress={() => setCustomModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="options-outline"
              size={12}
              color={selectedPriceId === 'CUSTOM' ? Colors.black : Colors.textSecondary}
            />
            <Text style={[styles.priceChipText, selectedPriceId === 'CUSTOM' && styles.priceChipTextActive]}>
              {selectedPriceId === 'CUSTOM' ? customLabel : 'Custom'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

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
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="filter-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No packages in this price range</Text>
          <Text style={styles.emptySubtext}>
            None of your tracked packages fall between the selected price limits.
          </Text>
          <TouchableOpacity
            style={[styles.rescanBtn, { marginTop: 14 }]}
            onPress={handleResetPriceFilter}
          >
            <Ionicons name="refresh" size={13} color={Colors.black} />
            <Text style={styles.rescanBtnText}>Show All Prices</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.list}>
          {paginatedOrders.map((o) => {
            let platformIcon: any = 'bag-handle-outline';
            if (o.platform === 'GROCERY') platformIcon = 'basket-outline';
            else if (o.platform === 'GOOGLE_PLAY') platformIcon = 'logo-google-playstore';
            else if (o.platform === 'ROBLOX') platformIcon = 'cube-outline';
            else if (o.platform === 'FOODPANDA') platformIcon = 'fast-food-outline';

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
                  <View style={styles.orderBottomRight}>
                    <Text style={styles.orderAmount}>
                      {currencySymbol}
                      {o.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                    <TouchableOpacity
                      style={styles.cardDeleteBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        confirmDeleteOrder(o);
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
      onRequestClose={() => {
        if (isEditing) {
          setIsEditing(false);
        } else {
          setSelectedOrder(null);
        }
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons
                name={
                  isEditing
                    ? 'create-outline'
                    : selectedOrder?.platform === 'GROCERY'
                    ? 'basket'
                    : selectedOrder?.platform === 'GOOGLE_PLAY'
                    ? 'logo-google-playstore'
                    : selectedOrder?.platform === 'ROBLOX'
                    ? 'cube'
                    : selectedOrder?.platform === 'FOODPANDA'
                    ? 'fast-food'
                    : 'bag-handle'
                }
                size={20}
                color={Colors.white}
              />
              <Text style={styles.modalTitle}>
                {isEditing ? 'Edit Tracked Order' : 'Receipt & Order Details'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                if (isEditing) {
                  setIsEditing(false);
                } else {
                  setSelectedOrder(null);
                }
              }}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {selectedOrder && isEditing ? (
            <ScrollView style={styles.editModalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.modalBody}>
                {/* Edit Amount */}
                <Text style={styles.editInputLabel}>TOTAL AMOUNT ({currencySymbol})</Text>
                <View style={styles.editAmountRow}>
                  <Text style={styles.editCurrencyPrefix}>{currencySymbol}</Text>
                  <TextInput
                    style={styles.editAmountInput}
                    value={editAmount}
                    onChangeText={setEditAmount}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {/* Edit Item / Merchant Description */}
                <Text style={styles.editInputLabel}>ITEM(S) / ORDER DESCRIPTION</Text>
                <TextInput
                  style={styles.editDescInput}
                  value={editItems}
                  onChangeText={setEditItems}
                  placeholder="e.g. Shoes, Sneakers, Mouse..."
                  placeholderTextColor={Colors.textMuted}
                />

                {/* Edit Status */}
                <Text style={styles.editInputLabel}>ORDER STATUS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.editChipsRow}>
                  {STATUS_OPTIONS.map((st) => {
                    const isSel = editStatus === st.id;
                    return (
                      <TouchableOpacity
                        key={st.id}
                        style={[styles.editChip, isSel && styles.editChipActive]}
                        onPress={() => setEditStatus(st.id)}
                      >
                        <Ionicons name={st.icon as any} size={12} color={isSel ? Colors.black : Colors.textMuted} />
                        <Text style={[styles.editChipText, isSel && styles.editChipTextActive]}>{st.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Edit Payment Method */}
                <Text style={styles.editInputLabel}>PAYMENT METHOD</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.editChipsRow}>
                  {PAYMENT_METHOD_OPTIONS.map((pm) => {
                    const isSel = editPaymentMethod.toUpperCase() === pm.id;
                    return (
                      <TouchableOpacity
                        key={pm.id}
                        style={[styles.editChip, isSel && styles.editChipActive]}
                        onPress={() => setEditPaymentMethod(pm.id)}
                      >
                        <Ionicons name={pm.icon as any} size={12} color={isSel ? Colors.black : Colors.textMuted} />
                        <Text style={[styles.editChipText, isSel && styles.editChipTextActive]}>{pm.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Edit Tracking / Order Number */}
                <Text style={styles.editInputLabel}>TRACKING / ORDER NUMBER</Text>
                <TextInput
                  style={styles.editDescInput}
                  value={editTrackingNumber}
                  onChangeText={setEditTrackingNumber}
                  placeholder="e.g. 260919E3SVERB3..."
                  placeholderTextColor={Colors.textMuted}
                />

                {/* Edit Notes */}
                <Text style={styles.editInputLabel}>NOTES</Text>
                <TextInput
                  style={styles.editDescInput}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="Add optional notes..."
                  placeholderTextColor={Colors.textMuted}
                />

                {/* Edit Action Buttons */}
                <View style={styles.modalActionsRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setIsEditing(false)}
                    disabled={savingEdit}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalSaveBtn}
                    onPress={handleSaveEdit}
                    disabled={savingEdit}
                    activeOpacity={0.8}
                  >
                    {savingEdit ? (
                      <ActivityIndicator size="small" color={Colors.black} />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={16} color={Colors.black} />
                        <Text style={styles.modalSaveBtnText}>Save</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          ) : selectedOrder ? (
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

              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.modalDeleteBtn}
                  onPress={() => {
                    const toDelete = selectedOrder;
                    setSelectedOrder(null);
                    confirmDeleteOrder(toDelete);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  <Text style={styles.modalDeleteBtnText}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalEditBtn}
                  onPress={handleStartEdit}
                  activeOpacity={0.8}
                >
                  <Ionicons name="pencil" size={15} color={Colors.white} />
                  <Text style={styles.modalEditBtnText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalDoneBtn}
                  onPress={() => setSelectedOrder(null)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalDoneBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          </View>
        </View>
      </Modal>

      {/* Custom Price Range Modal */}
      <Modal
        visible={customModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.customPriceModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Custom Price Range</Text>
              <TouchableOpacity onPress={() => setCustomModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.priceModalSub}>
              Filter packages and digital orders between specific price limits.
            </Text>

            <View style={styles.priceInputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Min Price ({currencySymbol})</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                  value={customMin}
                  onChangeText={setCustomMin}
                  autoFocus
                />
              </View>

              <View style={styles.priceDivider}>
                <Text style={{ color: Colors.textMuted, fontSize: 16 }}>—</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Max Price ({currencySymbol})</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="e.g. 1500"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                  value={customMax}
                  onChangeText={setCustomMax}
                />
              </View>
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={handleResetPriceFilter}
                activeOpacity={0.8}
              >
                <Text style={styles.clearBtnText}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyBtn}
                onPress={handleApplyCustom}
                activeOpacity={0.8}
              >
                <Text style={styles.applyBtnText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
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
  trackerHeroCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  trackerHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  trackerHeroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  trackerHeroLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.6,
  },
  trackerHeroAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  parcelStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  parcelBadgeTransit: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  parcelBadgeDelivered: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  parcelStatusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  parcelTextTransit: {
    color: '#F59E0B',
  },
  parcelTextDelivered: {
    color: '#10B981',
  },
  platformBarSection: {
    gap: 8,
  },
  multiProgressBar: {
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.surfaceSubtle,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressBarSegment: {
    height: '100%',
  },
  platformLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  legendPercent: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
  legendAmount: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  trackerHeroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  trackerHeroMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  trackerHeroMetaSub: {
    fontSize: 11,
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
  orderBottomRight: {
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
    padding: 20,
    maxWidth: 400,
    maxHeight: '90%',
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
    flex: 1,
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
  modalEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalEditBtnText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  editModalScroll: {
    maxHeight: 460,
  },
  editInputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 4,
  },
  editAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  editCurrencyPrefix: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textMuted,
    marginRight: 6,
  },
  editAmountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    paddingVertical: 6,
  },
  editChipsRow: {
    gap: 6,
    paddingVertical: 4,
  },
  editChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editChipActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
  },
  editChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  editChipTextActive: {
    color: Colors.black,
    fontWeight: '700',
  },
  editDescInput: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.white,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalSaveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.white,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalSaveBtnText: {
    color: Colors.black,
    fontSize: 14,
    fontWeight: '700',
  },
  platformFilterContainer: {
    marginBottom: 12,
    gap: 8,
  },
  platformScroll: {
    gap: 8,
    paddingRight: 10,
  },
  platformPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  platformPillActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
  },
  platformPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  platformPillTextActive: {
    color: Colors.black,
    fontWeight: '700',
  },
  priceFilterContainer: {
    marginBottom: 14,
    gap: 8,
  },
  priceFilterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceFilterLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  priceFilterLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.6,
  },
  priceResetBtn: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  priceChipsRow: {
    gap: 8,
  },
  priceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  priceChipActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
  },
  priceChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  priceChipTextActive: {
    color: Colors.black,
    fontWeight: '700',
  },
  customPriceModalContent: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    maxWidth: 380,
    gap: 14,
  },
  priceModalSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  priceInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  priceInput: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  priceDivider: {
    paddingTop: 18,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  clearBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  applyBtn: {
    flex: 2,
    backgroundColor: Colors.white,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.black,
  },
});
