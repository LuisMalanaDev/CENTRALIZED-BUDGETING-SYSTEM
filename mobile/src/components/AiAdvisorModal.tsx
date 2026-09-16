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

interface AiReport {
  mode: 'coach' | 'roast';
  score: number;
  headline: string;
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
  const [mode, setMode] = useState<'coach' | 'roast'>('coach');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AiReport | null>(null);

  const fetchInsights = async (targetMode: 'coach' | 'roast') => {
    setLoading(true);
    try {
      let query = `?mode=${targetMode}`;
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
      fetchInsights(mode);
    }
  }, [visible, mode, filter]);

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
                <Ionicons name="sparkles" size={16} color={mode === 'roast' ? '#F43F5E' : '#A78BFA'} />
              </View>
              <View>
                <Text style={styles.title}>WealthSync AI Advisor</Text>
                <Text style={styles.subtitle}>{filter.label || 'Active Period'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Mode Switcher */}
          <View style={styles.modeTabs}>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'coach' && styles.modeTabActive]}
              onPress={() => setMode('coach')}
              activeOpacity={0.8}
            >
              <Ionicons name="briefcase-outline" size={14} color={mode === 'coach' ? Colors.black : Colors.textMuted} />
              <Text style={[styles.modeTabText, mode === 'coach' && styles.modeTabTextActive]}>
                Financial Coach
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeTab, mode === 'roast' && styles.modeTabRoastActive]}
              onPress={() => setMode('roast')}
              activeOpacity={0.8}
            >
              <Ionicons name="flame" size={14} color={mode === 'roast' ? Colors.white : '#F43F5E'} />
              <Text style={[styles.modeTabText, mode === 'roast' && styles.modeTabRoastTextActive]}>
                Roast My Spending
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={mode === 'roast' ? '#F43F5E' : Colors.white} />
                <Text style={styles.loadingText}>
                  {mode === 'roast' ? 'Cooking up your spending roast...' : 'Analyzing financial health with Gemini...'}
                </Text>
              </View>
            ) : report ? (
              <>
                {/* Score & Headline Hero */}
                <View style={[styles.scoreHeroCard, mode === 'roast' && styles.scoreHeroRoast]}>
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

                {/* Key Insights List */}
                <Text style={styles.sectionHeader}>Key Financial Insights</Text>
                <View style={styles.insightsList}>
                  {report.insights.map((item, idx) => (
                    <View key={idx} style={styles.insightCard}>
                      <View style={styles.insightIconBox}>
                        <Ionicons
                          name={getIconName(item.icon)}
                          size={18}
                          color={mode === 'roast' ? '#FB7185' : Colors.white}
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
                <View style={[styles.actionCard, mode === 'roast' && styles.actionCardRoast]}>
                  <View style={styles.actionHeader}>
                    <Ionicons name="checkmark-done-circle" size={18} color={mode === 'roast' ? '#FB7185' : '#10B981'} />
                    <Text style={styles.actionTitle}>HIGH-IMPACT ACTION</Text>
                  </View>
                  <Text style={styles.actionText}>{report.actionItem}</Text>
                </View>

                {/* Re-analyze button */}
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={() => fetchInsights(mode)}
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
  modeTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeTabActive: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
  },
  modeTabRoastActive: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modeTabTextActive: {
    color: Colors.black,
    fontWeight: '700',
  },
  modeTabRoastTextActive: {
    color: Colors.white,
    fontWeight: '700',
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
  scoreHeroRoast: {
    borderColor: 'rgba(244, 63, 94, 0.4)',
    backgroundColor: 'rgba(244, 63, 94, 0.05)',
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
  actionCardRoast: {
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
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
