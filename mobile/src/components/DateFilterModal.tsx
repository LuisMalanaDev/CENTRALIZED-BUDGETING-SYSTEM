import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { DateRangeFilter } from '../types';

interface DateFilterModalProps {
  visible: boolean;
  onClose: () => void;
  currentFilter: DateRangeFilter;
  onSelectFilter: (filter: DateRangeFilter) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const YEARS = [2023, 2024, 2025, 2026, 2027, 2028];

export const DateFilterModal: React.FC<DateFilterModalProps> = ({
  visible,
  onClose,
  currentFilter,
  onSelectFilter,
}) => {
  const [activeYear, setActiveYear] = useState(currentFilter.year);
  const [activeMonth, setActiveMonth] = useState(currentFilter.month);

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfWeek = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(activeYear, activeMonth);
  const firstDay = getFirstDayOfWeek(activeYear, activeMonth);

  const handleDaySelect = (day: number) => {
    const monthStr = String(activeMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${activeYear}-${monthStr}-${dayStr}`;

    const monthName = MONTHS[activeMonth].slice(0, 3);
    const label = `${monthName} ${day}, ${activeYear}`;

    onSelectFilter({
      type: 'day',
      year: activeYear,
      month: activeMonth,
      day,
      startDate: dateStr,
      endDate: dateStr,
      label: `Day: ${label}`,
    });
    onClose();
  };

  const handleSelectEntireMonth = () => {
    const monthStr = String(activeMonth + 1).padStart(2, '0');
    const lastDay = String(daysInMonth).padStart(2, '0');
    const startDate = `${activeYear}-${monthStr}-01`;
    const endDate = `${activeYear}-${monthStr}-${lastDay}`;

    onSelectFilter({
      type: 'month',
      year: activeYear,
      month: activeMonth,
      day: 1,
      startDate,
      endDate,
      label: `${MONTHS[activeMonth]} ${activeYear}`,
    });
    onClose();
  };

  const handleSelectEntireYear = () => {
    const startDate = `${activeYear}-01-01`;
    const endDate = `${activeYear}-12-31`;

    onSelectFilter({
      type: 'year',
      year: activeYear,
      month: activeMonth,
      day: 1,
      startDate,
      endDate,
      label: `Year ${activeYear}`,
    });
    onClose();
  };

  const handleSelectToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    const monthStr = String(m + 1).padStart(2, '0');
    const dayStr = String(d).padStart(2, '0');
    const dateStr = `${y}-${monthStr}-${dayStr}`;

    onSelectFilter({
      type: 'day',
      year: y,
      month: m,
      day: d,
      startDate: dateStr,
      endDate: dateStr,
      label: `Today (${MONTHS[m].slice(0, 3)} ${d})`,
    });
    onClose();
  };

  const handleSelectAllTime = () => {
    onSelectFilter({
      type: 'all',
      year: activeYear,
      month: activeMonth,
      day: 1,
      label: 'All Time History',
    });
    onClose();
  };

  const prevMonth = () => {
    if (activeMonth === 0) {
      setActiveMonth(11);
      setActiveYear((y) => y - 1);
    } else {
      setActiveMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (activeMonth === 11) {
      setActiveMonth(0);
      setActiveYear((y) => y + 1);
    } else {
      setActiveMonth((m) => m + 1);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="calendar-outline" size={20} color={Colors.white} />
              <Text style={styles.headerTitle}>Select Calendar Date</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Month & Year Navigation Header */}
          <View style={styles.navRow}>
            <TouchableOpacity onPress={prevMonth} style={styles.navArrow}>
              <Ionicons name="chevron-back" size={18} color={Colors.white} />
            </TouchableOpacity>

            <View style={styles.pickerControls}>
              <Text style={styles.monthYearText}>
                {MONTHS[activeMonth]} {activeYear}
              </Text>
            </View>

            <TouchableOpacity onPress={nextMonth} style={styles.navArrow}>
              <Ionicons name="chevron-forward" size={18} color={Colors.white} />
            </TouchableOpacity>
          </View>

          {/* Days of Week Header */}
          <View style={styles.weekDaysRow}>
            {DAYS_OF_WEEK.map((d, i) => (
              <Text key={i} style={styles.weekDayText}>
                {d}
              </Text>
            ))}
          </View>

          {/* 31-Day Calendar Grid */}
          <View style={styles.grid}>
            {/* Empty slots for start of month */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.dayCell} />
            ))}

            {/* Actual Month Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected =
                currentFilter.type === 'day' &&
                currentFilter.year === activeYear &&
                currentFilter.month === activeMonth &&
                currentFilter.day === day;

              const today = new Date();
              const isToday =
                today.getFullYear() === activeYear &&
                today.getMonth() === activeMonth &&
                today.getDate() === day;

              return (
                <TouchableOpacity
                  key={`day-${day}`}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isToday && !isSelected && styles.dayCellToday,
                  ]}
                  onPress={() => handleDaySelect(day)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                      isToday && !isSelected && styles.dayTextToday,
                    ]}
                  >
                    {day}
                  </Text>
                  {isToday && !isSelected && <View style={styles.todayDot} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Shortcuts */}
          <View style={styles.shortcuts}>
            <TouchableOpacity
              style={styles.shortcutButton}
              onPress={handleSelectEntireMonth}
            >
              <Ionicons name="calendar" size={14} color={Colors.white} />
              <Text style={styles.shortcutText}>
                Entire Month ({MONTHS[activeMonth].slice(0, 3)})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shortcutButton}
              onPress={handleSelectEntireYear}
            >
              <Ionicons name="today-outline" size={14} color={Colors.white} />
              <Text style={styles.shortcutText}>
                Entire Year ({activeYear})
              </Text>
            </TouchableOpacity>

            <View style={styles.shortcutRow}>
              <TouchableOpacity
                style={[styles.shortcutButton, styles.flex1]}
                onPress={handleSelectToday}
              >
                <Text style={styles.shortcutText}>Jump to Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shortcutButton, styles.flex1]}
                onPress={handleSelectAllTime}
              >
                <Text style={styles.shortcutText}>All Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  closeButton: {
    padding: 4,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  navArrow: {
    padding: 4,
  },
  pickerControls: {
    alignItems: 'center',
  },
  monthYearText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  dayCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    position: 'relative',
  },
  dayCellSelected: {
    backgroundColor: Colors.white,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: Colors.borderFocus,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  dayTextSelected: {
    color: Colors.black,
    fontWeight: '700',
  },
  dayTextToday: {
    color: Colors.white,
    fontWeight: '600',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.white,
    position: 'absolute',
    bottom: 4,
  },
  shortcuts: {
    gap: 8,
    borderTopWidth: 1,
    borderColor: Colors.border,
    paddingTop: 14,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shortcutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  flex1: {
    flex: 1,
  },
  shortcutText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
});
