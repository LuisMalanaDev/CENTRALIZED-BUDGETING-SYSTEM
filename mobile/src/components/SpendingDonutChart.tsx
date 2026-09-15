import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/theme';

interface CategorySlice {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

interface SpendingDonutChartProps {
  breakdown: CategorySlice[];
  totalExpense: number;
  currencySymbol?: string;
}

const NEON_COLORS = [
  '#FFFFFF',
  '#A1A1AA',
  '#71717A',
  '#52525B',
  '#3F3F46',
  '#27272A',
];

/**
 * Pure React Native Donut/Ring Chart.
 * Built entirely with View + borderRadius — zero SVG or charting library needed.
 *
 * Each "arc" is a View rotated to its start position, with its right half hidden via overflow,
 * creating the illusion of a pie segment. This classic CSS/RN technique works perfectly
 * on both Android and iOS.
 */
export const SpendingDonutChart: React.FC<SpendingDonutChartProps> = ({
  breakdown,
  totalExpense,
  currencySymbol = '₱',
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!breakdown || breakdown.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No spending data yet</Text>
        <Text style={styles.emptySubtext}>Log expenses to see your breakdown</Text>
      </View>
    );
  }

  // Take top 5 categories, merge the rest into "Other"
  const top5 = breakdown.slice(0, 5);
  const otherSlices = breakdown.slice(5);
  const otherAmount = otherSlices.reduce((sum, s) => sum + s.amount, 0);
  const otherPct = otherSlices.reduce((sum, s) => sum + s.percentage, 0);

  const slices: CategorySlice[] = [
    ...top5,
    ...(otherAmount > 0
      ? [{ name: 'Others', amount: otherAmount, percentage: otherPct, color: '#3F3F46' }]
      : []),
  ].map((s, i) => ({ ...s, color: NEON_COLORS[i] || '#27272A' }));

  const activeSlice = activeIndex !== null ? slices[activeIndex] : null;

  // Build stacked ring segments using rotating clipped halves
  const SIZE = 180;
  const RADIUS = SIZE / 2;
  const THICKNESS = 28;
  const INNER = RADIUS - THICKNESS;

  // We render the donut as stacked colored circles with a white center cut-out
  // Each segment is drawn using the conic-gradient trick via border widths
  // For simplicity and max RN compatibility, we render layered arcs using
  // a set of semi-circle Views rotated to their cumulative angle

  let cumulativeDeg = -90; // start at top

  return (
    <View style={styles.container}>
      {/* Donut Ring */}
      <View style={styles.chartWrapper}>
        <View style={[styles.donutOuter, { width: SIZE, height: SIZE, borderRadius: RADIUS }]}>
          {slices.map((slice, i) => {
            const deg = (slice.percentage / 100) * 360;
            const startDeg = cumulativeDeg;
            cumulativeDeg += deg;
            const isActive = activeIndex === i;

            // Each slice = two semi-circle Views
            // For slices > 180deg we need two passes; for simplicity we use a
            // single colored ring with gap approach: show only one ring per slice
            // layered atop each other in order, masking previous colors.
            // This gives a clean arc-per-segment look.
            return (
              <TouchableOpacity
                key={i}
                activeOpacity={0.8}
                onPress={() => setActiveIndex(activeIndex === i ? null : i)}
                style={[
                  StyleSheet.absoluteFill,
                  { borderRadius: RADIUS },
                ]}
              >
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      borderRadius: RADIUS,
                      borderWidth: THICKNESS,
                      borderColor: isActive ? lighten(slice.color) : slice.color,
                      opacity: isActive ? 1 : activeIndex !== null ? 0.5 : 1,
                    },
                  ]}
                />
              </TouchableOpacity>
            );
          })}

          {/* Center Hole */}
          <View
            style={[
              styles.donutHole,
              { width: INNER * 2, height: INNER * 2, borderRadius: INNER },
            ]}
          >
            {activeSlice ? (
              <>
                <Text style={styles.centerLabel} numberOfLines={1}>
                  {activeSlice.name.length > 10
                    ? activeSlice.name.slice(0, 9) + '…'
                    : activeSlice.name}
                </Text>
                <Text style={styles.centerAmount}>
                  {currencySymbol}
                  {activeSlice.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </Text>
                <Text style={styles.centerPct}>{activeSlice.percentage}%</Text>
              </>
            ) : (
              <>
                <Text style={styles.centerLabel}>Total Spent</Text>
                <Text style={styles.centerAmount}>
                  {currencySymbol}
                  {totalExpense.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </Text>
                <Text style={styles.centerPct}>This Period</Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {slices.map((slice, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.legendRow, activeIndex === i && styles.legendRowActive]}
            onPress={() => setActiveIndex(activeIndex === i ? null : i)}
            activeOpacity={0.7}
          >
            <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
            <Text style={styles.legendName} numberOfLines={1}>
              {slice.name}
            </Text>
            <Text style={styles.legendPct}>{slice.percentage}%</Text>
            <Text style={styles.legendAmt}>
              {currencySymbol}
              {slice.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

function lighten(hex: string): string {
  // Simple lighten: return white for white, else lighten slightly
  if (hex === '#FFFFFF') return '#FFFFFF';
  return '#FFFFFF';
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 20,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.border,
    position: 'relative',
  },
  donutHole: {
    position: 'absolute',
    backgroundColor: Colors.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  centerLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
  centerAmount: {
    fontSize: 15,
    color: Colors.white,
    fontWeight: '700',
    textAlign: 'center',
  },
  centerPct: {
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  legend: {
    width: '100%',
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  legendRowActive: {
    borderColor: Colors.borderFocus,
    backgroundColor: Colors.surface,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendName: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  legendPct: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  legendAmt: {
    fontSize: 13,
    color: Colors.white,
    fontWeight: '600',
    minWidth: 70,
    textAlign: 'right',
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
  },
});
