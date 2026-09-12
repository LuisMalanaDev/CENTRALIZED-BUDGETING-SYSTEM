import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { DateRangeFilter } from '../types';
import { DateFilterModal } from './DateFilterModal';

interface DateFilterBarProps {
  filter: DateRangeFilter;
  onFilterChange: (filter: DateRangeFilter) => void;
}

export const DateFilterBar: React.FC<DateFilterBarProps> = ({
  filter,
  onFilterChange,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const stepDate = (direction: 'prev' | 'next') => {
    if (filter.type === 'day') {
      const currentDate = new Date(filter.year, filter.month, filter.day);
      currentDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));

      const y = currentDate.getFullYear();
      const m = currentDate.getMonth();
      const d = currentDate.getDate();
      const mStr = String(m + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      const dateStr = `${y}-${mStr}-${dStr}`;

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      onFilterChange({
        type: 'day',
        year: y,
        month: m,
        day: d,
        startDate: dateStr,
        endDate: dateStr,
        label: `Day: ${months[m]} ${d}, ${y}`,
      });
    } else if (filter.type === 'month') {
      let m = filter.month + (direction === 'next' ? 1 : -1);
      let y = filter.year;
      if (m > 11) {
        m = 0;
        y += 1;
      } else if (m < 0) {
        m = 11;
        y -= 1;
      }

      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const mStr = String(m + 1).padStart(2, '0');
      const lastDay = String(new Date(y, m + 1, 0).getDate()).padStart(2, '0');

      onFilterChange({
        type: 'month',
        year: y,
        month: m,
        day: 1,
        startDate: `${y}-${mStr}-01`,
        endDate: `${y}-${mStr}-${lastDay}`,
        label: `${months[m]} ${y}`,
      });
    }
  };

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.stepperButton}
          onPress={() => stepDate('prev')}
        >
          <Ionicons name="chevron-back" size={16} color={Colors.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pillButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="calendar-outline" size={16} color={Colors.white} />
          <Text style={styles.pillText} numberOfLines={1}>
            {filter.label}
          </Text>
          <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.stepperButton}
          onPress={() => stepDate('next')}
        >
          <Ionicons name="chevron-forward" size={16} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <DateFilterModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        currentFilter={filter}
        onSelectFilter={onFilterChange}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillButton: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
    maxWidth: '75%',
  },
});
