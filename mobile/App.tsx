import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Platform } from 'react-native';
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

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('WealthSync Unhandled Crash caught:', error, errorInfo);
  }

  handleReset = async () => {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.multiRemove(['wealthsync_token', 'wealthsync_user']);
    } catch {}
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.errorContainer}>
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>WealthSync Recovery</Text>
            <Text style={styles.errorSubtitle}>
              An unexpected error occurred while loading your session.
            </Text>
            <Text style={styles.errorDetails}>
              {this.state.error?.message || 'Unknown runtime error'}
            </Text>
            <TouchableOpacity
              style={styles.errorResetBtn}
              onPress={this.handleReset}
            >
              <Text style={styles.errorResetBtnText}>Reset & Return to Sign In</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <MainApp />
        </AuthProvider>
      </ErrorBoundary>
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
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    maxWidth: 340,
    width: '100%',
  },
  errorTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  errorSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  errorDetails: {
    color: '#F87171',
    fontSize: 12,
    backgroundColor: '#1C1917',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorResetBtn: {
    backgroundColor: Colors.white,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 8,
  },
  errorResetBtnText: {
    color: Colors.black,
    fontWeight: '700',
    fontSize: 14,
  },
});
