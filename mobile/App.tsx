import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { Colors } from './src/constants/theme';
import { AuthScreen } from './src/screens/AuthScreen';
import { OverviewScreen } from './src/screens/OverviewScreen';
import { LedgerScreen } from './src/screens/LedgerScreen';
import { TrackerScreen } from './src/screens/TrackerScreen';
import { BudgetsScreen } from './src/screens/BudgetsScreen';
import { BottomTabBar, TabScreen } from './src/components/BottomTabBar';
import { QuickLogModal } from './src/components/QuickLogModal';
import { DateRangeFilter } from './src/types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<TabScreen>('OVERVIEW');
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Initialize date filter to Current Month
  const now = new Date();
  const initY = now.getFullYear();
  const initM = now.getMonth();
  const lastDay = new Date(initY, initM + 1, 0).getDate();
  const mStr = String(initM + 1).padStart(2, '0');

  const [dateFilter, setDateFilter] = useState<DateRangeFilter>({
    type: 'month',
    year: initY,
    month: initM,
    day: now.getDate(),
    startDate: `${initY}-${mStr}-01`,
    endDate: `${initY}-${mStr}-${String(lastDay).padStart(2, '0')}`,
    label: `${MONTH_NAMES[initM]} ${initY}`,
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={Colors.white} />
          <Text style={styles.loadingText}>WealthSync Cloud...</Text>
        </View>
      </View>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const handleTransactionLogged = () => {
    // Increment refreshKey to trigger re-fetch across tabs
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />

      <View style={styles.mainContainer}>
        {currentTab === 'OVERVIEW' && (
          <OverviewScreen
            key={`overview-${refreshKey}`}
            onOpenQuickLog={() => setQuickLogOpen(true)}
            filter={dateFilter}
            onFilterChange={setDateFilter}
          />
        )}

        {currentTab === 'LEDGER' && (
          <LedgerScreen
            key={`ledger-${refreshKey}`}
            filter={dateFilter}
            onFilterChange={setDateFilter}
            onOpenQuickLog={() => setQuickLogOpen(true)}
          />
        )}

        {currentTab === 'TRACKER' && (
          <TrackerScreen
            key={`tracker-${refreshKey}`}
            filter={dateFilter}
            onFilterChange={setDateFilter}
          />
        )}

        {currentTab === 'BUDGETS' && (
          <BudgetsScreen key={`budgets-${refreshKey}`} />
        )}

        {/* Floating Bottom Tab Bar */}
        <BottomTabBar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onOpenQuickLog={() => setQuickLogOpen(true)}
        />

        {/* Global Quick Log Modal */}
        <QuickLogModal
          visible={quickLogOpen}
          onClose={() => setQuickLogOpen(false)}
          onSuccess={handleTransactionLogged}
          currency={user.currency || 'PHP'}
        />
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
