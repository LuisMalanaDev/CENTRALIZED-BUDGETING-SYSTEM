import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { Transaction, DateRangeFilter } from '../types';
import { getCategoryName } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

interface StatementModalProps {
  visible: boolean;
  onClose: () => void;
  filter: DateRangeFilter;
  transactions: Transaction[];
  metrics: {
    totalInflow: number;
    totalOutflow: number;
    netCashflow: number;
  };
}

export const StatementModal: React.FC<StatementModalProps> = ({
  visible,
  onClose,
  filter,
  transactions,
  metrics,
}) => {
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const currencySymbol = user?.currency === 'USD' ? '$' : '₱';

  const handleOpenVisualStatement = async () => {
    setDownloading(true);
    try {
      const baseUrl = await api.getBaseUrl();
      const token = await AsyncStorage.getItem('wealthsync_token');
      const start = filter.startDate || '';
      const end = filter.endDate || '';
      const label = filter.label || 'Statement';
      const url = `${baseUrl}/api/analytics/export-statement?token=${encodeURIComponent(token || '')}&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}&label=${encodeURIComponent(label)}&tz=Asia/Manila`;

      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not open visual statement.');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadCsv = async () => {
    setDownloading(true);
    try {
      const baseUrl = await api.getBaseUrl();
      const token = await AsyncStorage.getItem('wealthsync_token');
      const start = filter.startDate || '';
      const end = filter.endDate || '';
      const label = filter.label || 'Statement';
      const downloadUrl = `${baseUrl}/api/analytics/export-csv?token=${encodeURIComponent(token || '')}&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}&label=${encodeURIComponent(label)}&tz=Asia/Manila`;

      await Linking.openURL(downloadUrl);
    } catch (e: any) {
      Alert.alert('Download Error', e.message || 'Could not initiate CSV file download.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.docIcon}>
                <Ionicons name="receipt-outline" size={17} color={Colors.white} />
              </View>
              <View>
                <Text style={styles.title}>Monthly Statement</Text>
                <Text style={styles.subtitle}>{filter.label || 'Active Period'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Statement Content */}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Statement Summary Card */}
            <View style={styles.statementCard}>
              <View style={styles.statementMetaRow}>
                <View>
                  <Text style={styles.metaLabel}>ACCOUNT HOLDER</Text>
                  <Text style={styles.metaValue}>{user?.name || user?.email || 'WealthSync User'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.metaLabel}>PERIOD</Text>
                  <Text style={styles.metaValue}>{filter.label || 'All-Time'}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Inflow / Outflow / Net Grid */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricCol}>
                  <Text style={styles.metricLabel}>TOTAL INFLOW</Text>
                  <Text style={[styles.metricValue, { color: '#10B981' }]}>
                    +{currencySymbol}{metrics.totalInflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <View style={styles.metricCol}>
                  <Text style={styles.metricLabel}>TOTAL OUTFLOW</Text>
                  <Text style={[styles.metricValue, { color: '#EF4444' }]}>
                    −{currencySymbol}{metrics.totalOutflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <View style={styles.metricCol}>
                  <Text style={styles.metricLabel}>NET BALANCE</Text>
                  <Text style={[styles.metricValue, metrics.netCashflow >= 0 ? { color: Colors.white } : { color: '#EF4444' }]}>
                    {metrics.netCashflow >= 0 ? '+' : '−'}{currencySymbol}{Math.abs(metrics.netCashflow).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            </View>

            {/* Download Buttons: Visual Statement & CSV */}
            <View style={styles.downloadButtonsRow}>
              <TouchableOpacity
                style={styles.exportVisualBtn}
                onPress={handleOpenVisualStatement}
                activeOpacity={0.8}
                disabled={downloading}
              >
                <Ionicons name="document-text" size={17} color={Colors.black} />
                <Text style={styles.exportVisualBtnText}>
                  {downloading ? 'Loading...' : 'Executive Statement (PDF)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportCsvBtn}
                onPress={handleDownloadCsv}
                activeOpacity={0.8}
                disabled={downloading}
              >
                <Ionicons name="download-outline" size={16} color={Colors.white} />
                <Text style={styles.exportCsvBtnText}>Download Spreadsheet (.CSV)</Text>
              </TouchableOpacity>
            </View>

            {/* Itemized Transactions Table */}
            <View style={styles.tableHeaderRow}>
              <Text style={styles.tableHeading}>Itemized Ledger ({transactions.length})</Text>
              <Text style={styles.tableSub}>Date & Amount</Text>
            </View>

            {transactions.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="document-text-outline" size={28} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No transactions recorded for this period.</Text>
              </View>
            ) : (
              <View style={styles.txTable}>
                {transactions.slice(0, 50).map((tx) => {
                  const isIncome = tx.type === 'INCOME';
                  const dateStr = tx.date ? tx.date.split('T')[0] : '';
                  return (
                    <View key={tx.id} style={styles.tableRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowCat} numberOfLines={1}>
                          {getCategoryName(tx.category, 'Expense')}
                        </Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {dateStr} • {tx.description || tx.paymentMethod || 'Manual'}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.rowAmount,
                          isIncome ? styles.rowAmountIncome : styles.rowAmountExpense,
                        ]}
                      >
                        {isIncome ? '+' : '−'}{currencySymbol}
                        {Number(tx.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  );
                })}
                {transactions.length > 50 && (
                  <Text style={styles.tableNotice}>
                    Showing 50 of {transactions.length} items. Tap "Export & Share CSV" above to access the complete list.
                  </Text>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  docIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  statementCard: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  statementMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricCol: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
  },
  downloadButtonsRow: {
    gap: 10,
  },
  exportVisualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 14,
  },
  exportVisualBtnText: {
    color: Colors.black,
    fontSize: 14,
    fontWeight: '700',
  },
  exportCsvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 12,
  },
  exportCsvBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  tableHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  txTable: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  rowCat: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  rowMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  rowAmountIncome: {
    color: '#10B981',
  },
  rowAmountExpense: {
    color: Colors.white,
  },
  tableNotice: {
    fontSize: 11,
    color: Colors.textMuted,
    padding: 12,
    textAlign: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
