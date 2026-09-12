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
        <View>
          <Text style={styles.title}>Orders & Delivery Tracker</Text>
          <Text style={styles.headerSub}>Auto-synced from your emails</Text>
        </View>
        <View style={styles.autoSyncPill}>
          <View style={styles.autoSyncDot} />
          <Text style={styles.autoSyncText}>Auto-Sync Live</Text>
        </View>
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
});
