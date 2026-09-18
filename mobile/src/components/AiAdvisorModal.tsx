import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { api } from '../api/client';
import { DateRangeFilter } from '../types';

interface AiInsightItem {
  title: string;
  tip: string;
  icon: string;
}

interface CategoryWarning {
  category: string;
  amount: number;
  percentage: number;
  status: 'danger' | 'warning' | 'info';
  message: string;
  tip: string;
}

interface AiPacing {
  safeDailySpend: number;
  daysRemaining: number;
  status: 'comfortable' | 'tight' | 'critical';
  message: string;
}

interface AiReport {
  mode: 'coach';
  score: number;
  headline: string;
  pacing?: AiPacing;
  categoryWarnings?: CategoryWarning[];
  insights: AiInsightItem[];
  actionItem: string;
  generatedAt: string;
}

interface AiAdvisorModalProps {
  visible: boolean;
  onClose: () => void;
  filter: DateRangeFilter;
}

export const AiAdvisorModal: React.FC<AiAdvisorModalProps> = ({
  visible,
  onClose,
  filter,
}) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AiReport | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      let query = `?mode=coach`;
      if (filter.startDate && filter.endDate) {
        query += `&startDate=${filter.startDate}&endDate=${filter.endDate}`;
      }
      const data = await api.get<AiReport>(`/api/analytics/insights${query}`);
      setReport(data);
    } catch (e) {
      console.warn('Failed to load AI insights:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchInsights();
    }
  }, [visible, filter]);

  const getScoreColor = (score: number) => {
    if (score >= 75) return '#10B981';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  const getIconName = (iconName: string): keyof typeof Ionicons.glyphMap => {
    switch (iconName) {
      case 'flame':
        return 'flame';
      case 'alert-circle':
        return 'alert-circle';
      case 'shield-checkmark':
        return 'shield-checkmark';
      case 'trophy':
        return 'trophy';
      case 'trending-up':
      default:
        return 'trending-up';
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
              <View style={styles.sparkleIcon}>
                <Ionicons name="sparkles" size={16} color="#A78BFA" />
              </View>
              <View>
                <Text style={styles.title}>Personal Financial Coach</Text>
                <Text style={styles.subtitle}>{filter.label || 'Active Period'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={Colors.white} />
                <Text style={styles.loadingText}>
                  Analyzing financial health...
                </Text>
              </View>
            ) : report ? (
              <>
                {/* Score & Headline Hero */}
                <View style={styles.scoreHeroCard}>
                  <View style={styles.scoreRow}>
                    <View style={styles.scoreBadge}>
                      <Text style={[styles.scoreNumber, { color: getScoreColor(report.score) }]}>
                        {report.score}
                      </Text>
                      <Text style={styles.scoreLabel}>HEALTH SCORE</Text>
                    </View>
                    <View style={styles.headlineBox}>
                      <Text style={styles.headlineText}>"{report.headline}"</Text>
                    </View>
                  </View>
                </View>

                {/* Smooth Spending Pacer */}
                {report.pacing && (
                  <View
                    style={[
                      styles.pacerCard,
                      report.pacing.status === 'critical'
                        ? styles.pacerCritical
                        : report.pacing.status === 'tight'
                        ? styles.pacerTight
                        : styles.pacerComfortable,
                    ]}
                  >
                    <View style={styles.pacerHeader}>
                      <View style={styles.pacerBadge}>
                        <Ionicons
                          name={report.pacing.status === 'critical' ? 'alert-circle' : 'time-outline'}
                          size={13}
                          color={
                            report.pacing.status === 'critical'
                              ? '#EF4444'
                              : report.pacing.status === 'tight'
                              ? '#F59E0B'
                              : '#10B981'
                          }
                        />
                        <Text
                          style={[
                            styles.pacerBadgeText,
                            {
                              color:
                                report.pacing.status === 'critical'
                                  ? '#EF4444'
                                  : report.pacing.status === 'tight'
                                  ? '#F59E0B'
                                  : '#10B981',
                            },
                          ]}
                        >
                          SMOOTH SPENDING PACER
                        </Text>
                      </View>
                      <Text style={styles.pacerDaysText}>
                        {report.pacing.daysRemaining} days left in cycle
                      </Text>
                    </View>

                    <View style={styles.pacerBody}>
                      <Text style={styles.pacerSpendAmount}>
                        ₱{report.pacing.safeDailySpend.toLocaleString()}
                        <Text style={styles.pacerSpendUnit}> / day</Text>
                      </Text>
                      <Text style={styles.pacerSpendLabel}>Safe Daily Spending Allowance</Text>
                    </View>

                    <Text style={styles.pacerMessage}>{report.pacing.message}</Text>
                  </View>
                )}

                {/* Category Spending Alerts */}
                {report.categoryWarnings && report.categoryWarnings.length > 0 && (
                  <View style={styles.warningsSection}>
                    <Text style={styles.sectionHeader}>Category Spending Alerts</Text>
                    <View style={styles.warningsList}>
                      {report.categoryWarnings.map((warn, wIdx) => {
                        const isDanger = warn.status === 'danger';
                        return (
                          <View
                            key={wIdx}
                            style={[
                              styles.warningCard,
                              isDanger ? styles.warningCardDanger : styles.warningCardWarning,
                            ]}
                          >
                            <View style={styles.warningCardHeader}>
                              <View style={styles.warningTitleRow}>
                                <Ionicons
                                  name={isDanger ? 'alert-circle' : 'warning-outline'}
                                  size={16}
                                  color={isDanger ? '#EF4444' : '#F59E0B'}
                                />
                                <Text style={styles.warningCategoryText}>{warn.category}</Text>
                              </View>
                              <View
                                style={[
                                  styles.warningBadge,
                                  isDanger ? styles.warningBadgeDanger : styles.warningBadgeWarning,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.warningBadgeText,
                                    { color: isDanger ? '#EF4444' : '#F59E0B' },
                                  ]}
                                >
                                  {warn.percentage}% OF EXPENSES
                                </Text>
                              </View>
                            </View>

                            <Text style={styles.warningMessage}>{warn.message}</Text>

                            <View style={styles.warningTipBox}>
                              <Ionicons name="bulb-outline" size={13} color="#94A3B8" />
                              <Text style={styles.warningTipText}>{warn.tip}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Key Insights List */}
                <Text style={styles.sectionHeader}>Key Financial Insights</Text>
                <View style={styles.insightsList}>
                  {report.insights.map((item, idx) => (
                    <View key={idx} style={styles.insightCard}>
                      <View style={styles.insightIconBox}>
                        <Ionicons
                          name={getIconName(item.icon)}
                          size={18}
                          color={Colors.white}
                        />
                      </View>
                      <View style={styles.insightContent}>
                        <Text style={styles.insightTitle}>{item.title}</Text>
                        <Text style={styles.insightTip}>{item.tip}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Action Item */}
                <View style={styles.actionCard}>
                  <View style={styles.actionHeader}>
                    <Ionicons name="checkmark-done-circle" size={18} color="#10B981" />
                    <Text style={styles.actionTitle}>HIGH-IMPACT ACTION</Text>
                  </View>
                  <Text style={styles.actionText}>{report.actionItem}</Text>
                </View>

                {/* Re-analyze button */}
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={() => fetchInsights()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={14} color={Colors.textSecondary} />
                  <Text style={styles.refreshBtnText}>Re-analyze with Latest Data</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons name="alert-circle-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Unable to generate insights right now.</Text>
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
    maxHeight: '88%',
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
  sparkleIcon: {
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
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  scoreHeroCard: {
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  scoreBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    minWidth: 72,
  },
  scoreNumber: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 30,
  },
  scoreLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  headlineBox: {
    flex: 1,
  },
  headlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  // Smooth Spending Pacer
  pacerCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  pacerComfortable: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  pacerTight: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  pacerCritical: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  pacerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pacerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pacerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pacerDaysText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  pacerBody: {
    gap: 2,
  },
  pacerSpendAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.white,
  },
  pacerSpendUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  pacerSpendLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  pacerMessage: {
    fontSize: 13,
    color: Colors.white,
    lineHeight: 18,
    fontWeight: '500',
  },

  // Category Warnings
  warningsSection: {
    gap: 10,
  },
  warningsList: {
    gap: 10,
  },
  warningCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  warningCardWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  warningCardDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  warningCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  warningTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningCategoryText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  warningBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  warningBadgeWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  warningBadgeDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  warningBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  warningMessage: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  warningTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  warningTipText: {
    fontSize: 11,
    color: '#CBD5E1',
    flex: 1,
    lineHeight: 16,
  },

  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insightsList: {
    gap: 10,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: Colors.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  insightIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  insightContent: {
    flex: 1,
    gap: 3,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  insightTip: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actionCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
    lineHeight: 18,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 4,
  },
  refreshBtnText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
