import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/theme';
import { api } from '../api/client';
import { PaymentMethod, TransactionType } from '../types';

interface QuickLogModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currency: string;
}

const EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', icon: 'restaurant-outline' },
  { name: 'Shopee / Online', icon: 'cart-outline' },
  { name: 'Groceries', icon: 'basket-outline' },
  { name: 'Transportation', icon: 'car-outline' },
  { name: 'Bills & Utilities', icon: 'receipt-outline' },
  { name: 'Entertainment', icon: 'game-controller-outline' },
  { name: 'Personal Care', icon: 'heart-outline' },
  { name: 'Other Expense', icon: 'ellipsis-horizontal-outline' },
];

const INCOME_CATEGORIES = [
  { name: 'Salary / Wages', icon: 'cash-outline' },
  { name: 'Allowance', icon: 'wallet-outline' },
  { name: 'Side Hustle', icon: 'briefcase-outline' },
  { name: 'Gifts & Rewards', icon: 'gift-outline' },
  { name: 'Other Inflow', icon: 'arrow-down-circle-outline' },
];

const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'GCASH', label: 'GCash' },
  { id: 'MAYA', label: 'Maya' },
  { id: 'CASH', label: 'Physical Cash' },
  { id: 'BANK_TRANSFER', label: 'Bank' },
  { id: 'CREDIT_CARD', label: 'Card' },
];

export const QuickLogModal: React.FC<QuickLogModalProps> = ({
  visible,
  onClose,
  onSuccess,
  currency,
}) => {
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0].name);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('GCASH');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);

  const categories = type === 'EXPENSE' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleClose = () => {
    setScanFeedback(null);
    setError(null);
    onClose();
  };

  const processReceiptScan = async (source: 'camera' | 'gallery') => {
    setError(null);
    setScanFeedback(null);

    try {
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Camera Permission Needed',
            'Please grant camera permission to scan physical receipts.'
          );
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Gallery Permission Needed',
            'Please grant gallery permission to select a receipt image.'
          );
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.6,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              quality: 0.6,
              base64: true,
            });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        setError('Unable to read receipt image data. Please try another photo.');
        return;
      }

      setScanning(true);

      const res = await api.post<{
        success: boolean;
        amount: number | null;
        merchant: string | null;
        category: string;
        paymentMethod: PaymentMethod;
        notes?: string;
      }>('/api/ocr/scan-receipt', {
        imageBase64: asset.base64,
      });

      // Always switch to EXPENSE for paper receipts
      setType('EXPENSE');

      if (res.amount) {
        setAmount(res.amount.toFixed(2));
      }

      if (res.merchant) {
        setDescription(res.merchant);
      }

      // Match category
      const catLower = (res.category || '').toLowerCase();
      if (catLower.includes('food') || catLower.includes('dining')) {
        setCategory('Food & Dining');
      } else if (catLower.includes('grocer') || catLower.includes('supermarket')) {
        setCategory('Groceries');
      } else if (
        catLower.includes('transport') ||
        catLower.includes('petron') ||
        catLower.includes('shell') ||
        catLower.includes('gas') ||
        catLower.includes('fuel')
      ) {
        setCategory('Transportation');
      } else if (catLower.includes('shopee') || catLower.includes('online')) {
        setCategory('Shopee / Online');
      } else if (catLower.includes('bill') || catLower.includes('utilit')) {
        setCategory('Bills & Utilities');
      } else if (catLower.includes('entertain') || catLower.includes('game')) {
        setCategory('Entertainment');
      }

      // Match payment method
      if (
        res.paymentMethod &&
        ['GCASH', 'MAYA', 'CASH', 'CREDIT_CARD', 'BANK_TRANSFER'].includes(res.paymentMethod)
      ) {
        setPaymentMethod(res.paymentMethod as PaymentMethod);
      }

      // Feedback display
      if (res.success && res.amount && res.merchant) {
        setScanFeedback({
          type: 'success',
          message: `Scanned: ${res.merchant} · ₱${res.amount.toFixed(2)} · ${res.paymentMethod || 'Cash'}`,
        });
      } else if (res.amount) {
        setScanFeedback({
          type: 'success',
          message: `Amount detected: ₱${res.amount.toFixed(2)}. Verify merchant below.`,
        });
      } else if (res.merchant) {
        setScanFeedback({
          type: 'info',
          message: `Merchant detected: ${res.merchant}. Please enter the total amount.`,
        });
      } else {
        setScanFeedback({
          type: 'warning',
          message: 'Receipt text was unclear. Please check or fill in details below.',
        });
      }
    } catch (err: any) {
      console.warn('Receipt scan error:', err);
      setScanFeedback({
        type: 'warning',
        message: 'Could not scan receipt. Please enter details manually.',
      });
    } finally {
      setScanning(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    const parsedAmount = parseFloat(amount.replace(/,/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/transactions', {
        amount: parsedAmount,
        type,
        category,
        paymentMethod,
        description: description.trim() || `${category} log`,
        date: new Date().toISOString(),
      });

      // Reset form
      setAmount('');
      setDescription('');
      setScanFeedback(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Quick Log Transaction</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
          >
            {/* Type Switcher */}
            <View style={styles.typeSwitcher}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'EXPENSE' && styles.typeButtonActive,
                ]}
                onPress={() => {
                  setType('EXPENSE');
                  setCategory(EXPENSE_CATEGORIES[0].name);
                }}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    type === 'EXPENSE' && styles.typeButtonTextActive,
                  ]}
                >
                  Expense (−)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  type === 'INCOME' && styles.typeButtonActive,
                ]}
                onPress={() => {
                  setType('INCOME');
                  setCategory(INCOME_CATEGORIES[0].name);
                }}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    type === 'INCOME' && styles.typeButtonTextActive,
                  ]}
                >
                  Inflow (+)
                </Text>
              </TouchableOpacity>
            </View>

            {/* AI Receipt Scanner Card (Expense Only) */}
            {type === 'EXPENSE' && (
              <View style={styles.ocrCard}>
                <View style={styles.ocrHeader}>
                  <View style={styles.ocrHeaderLeft}>
                    <View style={styles.ocrIconCircle}>
                      <Ionicons name="scan" size={15} color={Colors.white} />
                    </View>
                    <View>
                      <Text style={styles.ocrTitle}>Scan Paper Receipt</Text>
                      <Text style={styles.ocrSubtitle}>Auto-fills merchant, total & category</Text>
                    </View>
                  </View>
                  <View style={styles.aiBadge}>
                    <Text style={styles.aiBadgeText}>AI OCR</Text>
                  </View>
                </View>

                {scanning ? (
                  <View style={styles.ocrLoadingRow}>
                    <ActivityIndicator size="small" color={Colors.white} />
                    <Text style={styles.ocrLoadingText}>Scanning receipt with OCR...</Text>
                  </View>
                ) : (
                  <View style={styles.ocrActionsRow}>
                    <TouchableOpacity
                      style={styles.ocrBtn}
                      onPress={() => processReceiptScan('camera')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="camera" size={16} color={Colors.white} />
                      <Text style={styles.ocrBtnText}>Camera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.ocrBtnSecondary}
                      onPress={() => processReceiptScan('gallery')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="images" size={16} color={Colors.textSecondary} />
                      <Text style={styles.ocrBtnSecondaryText}>Upload</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {scanFeedback && (
                  <View
                    style={[
                      styles.ocrFeedbackBox,
                      scanFeedback.type === 'success' && styles.ocrFeedbackSuccess,
                      scanFeedback.type === 'warning' && styles.ocrFeedbackWarning,
                    ]}
                  >
                    <Ionicons
                      name={
                        scanFeedback.type === 'success'
                          ? 'checkmark-circle'
                          : 'alert-circle'
                      }
                      size={16}
                      color={scanFeedback.type === 'success' ? '#4ADE80' : '#FBBF24'}
                    />
                    <Text
                      style={[
                        styles.ocrFeedbackText,
                        scanFeedback.type === 'success' && { color: '#4ADE80' },
                        scanFeedback.type === 'warning' && { color: '#FBBF24' },
                      ]}
                    >
                      {scanFeedback.message}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Error Message */}
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Amount Input */}
            <View style={styles.amountContainer}>
              <Text style={styles.currencyPrefix}>
                {currency === 'PHP' ? '₱' : '$'}
              </Text>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
            </View>

            {/* Category Chips */}
            <Text style={styles.sectionLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {categories.map((cat) => {
                const isSelected = category === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    style={[
                      styles.chip,
                      isSelected && styles.chipActive,
                    ]}
                    onPress={() => setCategory(cat.name)}
                  >
                    <Ionicons
                      name={cat.icon as any}
                      size={14}
                      color={isSelected ? Colors.black : Colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Payment Method Chips */}
            <Text style={styles.sectionLabel}>Payment / Wallet Source</Text>
            <View style={styles.paymentMethodsGrid}>
              {PAYMENT_METHODS.map((pm) => {
                const isSelected = paymentMethod === pm.id;
                return (
                  <TouchableOpacity
                    key={pm.id}
                    style={[
                      styles.pmChip,
                      isSelected && styles.pmChipActive,
                    ]}
                    onPress={() => setPaymentMethod(pm.id)}
                  >
                    <Text
                      style={[
                        styles.pmChipText,
                        isSelected && styles.pmChipTextActive,
                      ]}
                    >
                      {pm.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Note / Description */}
            <Text style={styles.sectionLabel}>Description (Optional)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. McDo burger, Shopee mousepad"
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.black} size="small" />
              ) : (
                <Text style={styles.submitText}>
                  {type === 'EXPENSE' ? 'Record Expense' : 'Record Inflow'}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: '90%',
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
  closeButton: {
    padding: 4,
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 14,
  },
  typeSwitcher: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  typeButtonActive: {
    backgroundColor: Colors.white,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  typeButtonTextActive: {
    color: Colors.black,
  },
  errorBox: {
    backgroundColor: '#271212',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  currencyPrefix: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.white,
    marginRight: 6,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.white,
    minWidth: 140,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  chipActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
  },
  chipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.black,
    fontWeight: '700',
  },
  paymentMethodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pmChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pmChipActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
  },
  pmChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  pmChipTextActive: {
    color: Colors.black,
  },
  noteInput: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.white,
  },
  submitButton: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: Colors.black,
    fontSize: 16,
    fontWeight: '700',
  },
  ocrCard: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
  },
  ocrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ocrHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  ocrIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.badgeBg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ocrTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  ocrSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  aiBadge: {
    backgroundColor: Colors.badgeBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  ocrActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ocrBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.badgeBg,
    borderWidth: 1,
    borderColor: Colors.borderFocus,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 8,
  },
  ocrBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  ocrBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 8,
  },
  ocrBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  ocrLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 10,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 10,
  },
  ocrLoadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  ocrFeedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.surfaceSubtle,
  },
  ocrFeedbackSuccess: {
    backgroundColor: '#052e16',
    borderWidth: 1,
    borderColor: '#14532d',
  },
  ocrFeedbackWarning: {
    backgroundColor: '#2e1c05',
    borderWidth: 1,
    borderColor: '#533814',
  },
  ocrFeedbackText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
});
