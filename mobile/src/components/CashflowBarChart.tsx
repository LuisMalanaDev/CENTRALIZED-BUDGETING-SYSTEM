import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/theme';

interface MonthData {
  label: string;
  month: string;
  year: number;
  income: number;
  expense: number;
  net: number;
}

interface CashflowBarChartProps {
  cashflow: MonthData[];
  currencySymbol?: string;
}

/**
 * 6-Month Cashflow Bar Chart.
 * Pure React Native — uses dynamic-height Views as bars.
 * Inflow = white bar | Outflow = muted gray bar
 * Tap any month column to see exact ₱ values in a tooltip.
 */
export const CashflowBarChart: React.FC<CashflowBarChartProps> = ({
  cashflow,
  currencySymbol = '₱',
}) => {
  const [activeMonth, setActiveMonth] = useState<number | null>(null);

  if (!cashflow || cashflow.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Not enough data yet</Text>
        <Text style={styles.emptySubtext}>Log transactions across multiple months to see trends</Text>
      </View>
    );
  }

  const maxValue = Math.max(...cashflow.map((m) => Math.max(m.income, m.expense)), 1);
  const BAR_MAX_HEIGHT = 90;

  const activeData = activeMonth !== null ? cashflow[activeMonth] : null;

  return (
    <View style={styles.container}>
      {/* Tooltip */}
      {activeData && (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipTitle}>{activeData.label}</Text>
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: Colors.white }]} />
            <Text style={styles.tooltipLabel}>Inflow</Text>
            <Text style={styles.tooltipValue}>
              +{currencySymbol}
              {activeData.income.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: Colors.textMuted }]} />
            <Text style={styles.tooltipLabel}>Outflow</Text>
            <Text style={[styles.tooltipValue, { color: '#F87171' }]}>
              −{currencySymbol}
              {activeData.expense.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: activeData.net >= 0 ? '#10B981' : '#F87171' }]} />
            <Text style={styles.tooltipLabel}>Net</Text>
            <Text style={[styles.tooltipValue, { color: activeData.net >= 0 ? '#10B981' : '#F87171' }]}>
              {activeData.net >= 0 ? '+' : '−'}{currencySymbol}
              {Math.abs(activeData.net).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </View>
        </View>
      )}

      {/* Bar Chart */}
      <View style={styles.barsContainer}>
        {cashflow.map((month, i) => {
          const incomeH = maxValue > 0 ? (month.income / maxValue) * BAR_MAX_HEIGHT : 0;
          const expenseH = maxValue > 0 ? (month.expense / maxValue) * BAR_MAX_HEIGHT : 0;
          const isActive = activeMonth === i;

          return (
            <TouchableOpacity
              key={i}
              style={styles.monthCol}
              onPress={() => setActiveMonth(activeMonth === i ? null : i)}
              activeOpacity={0.7}
            >
              {/* Bars */}
              <View style={[styles.barsArea, { height: BAR_MAX_HEIGHT }]}>
                <View style={styles.barPair}>
                  {/* Inflow bar */}
                  <View
                    style={[
                      styles.bar,
                      styles.barInflow,
                      {
                        height: Math.max(3, incomeH),
                        opacity: isActive ? 1 : activeMonth !== null ? 0.4 : 1,
                      },
                    ]}
                  />
                  {/* Outflow bar */}
                  <View
                    style={[
                      styles.bar,
                      styles.barOutflow,
                      {
                        height: Math.max(3, expenseH),
                        opacity: isActive ? 1 : activeMonth !== null ? 0.4 : 1,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Month label */}
              <Text style={[styles.monthLabel, isActive && styles.monthLabelActive]}>
                {month.month.slice(0, 3)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBar, { backgroundColor: Colors.white }]} />
          <Text style={styles.legendText}>Inflow</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBar, { backgroundColor: Colors.textMuted }]} />
          <Text style={styles.legendText}>Outflow</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  tooltip: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  tooltipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 2,
  },
  tooltipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tooltipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tooltipLabel: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
  },
  tooltipValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  monthCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barsArea: {
    justifyContent: 'flex-end',
    width: '100%',
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  bar: {
    width: 10,
    borderRadius: 3,
    minHeight: 3,
  },
  barInflow: {
    backgroundColor: Colors.white,
  },
  barOutflow: {
    backgroundColor: Colors.textMuted,
  },
  monthLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  monthLabelActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBar: {
    width: 14,
    height: 4,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
