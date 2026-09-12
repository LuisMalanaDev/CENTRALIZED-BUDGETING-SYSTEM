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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

  const categories = type === 'EXPENSE' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

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
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Quick Log Transaction</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
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
});
