import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';

export type TabScreen = 'OVERVIEW' | 'LEDGER' | 'TRACKER' | 'BUDGETS';

interface BottomTabBarProps {
  currentTab: TabScreen;
  onSelectTab: (tab: TabScreen) => void;
  onOpenQuickLog: () => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  currentTab,
  onSelectTab,
  onOpenQuickLog,
}) => {
  return (
    <View style={styles.container}>
      {/* Overview Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('OVERVIEW')}
      >
        <Ionicons
          name={currentTab === 'OVERVIEW' ? 'home' : 'home-outline'}
          size={20}
          color={currentTab === 'OVERVIEW' ? Colors.white : Colors.textMuted}
        />
        <Text
          style={[
            styles.tabLabel,
            currentTab === 'OVERVIEW' && styles.tabLabelActive,
          ]}
        >
          Overview
        </Text>
      </TouchableOpacity>

      {/* Ledger Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('LEDGER')}
      >
        <Ionicons
          name={currentTab === 'LEDGER' ? 'receipt' : 'receipt-outline'}
          size={20}
          color={currentTab === 'LEDGER' ? Colors.white : Colors.textMuted}
        />
        <Text
          style={[
            styles.tabLabel,
            currentTab === 'LEDGER' && styles.tabLabelActive,
          ]}
        >
          Ledger
        </Text>
      </TouchableOpacity>

      {/* Center + Quick Log Button */}
      <TouchableOpacity
        style={styles.centerAddButton}
        onPress={onOpenQuickLog}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={24} color={Colors.black} />
      </TouchableOpacity>

      {/* Tracker Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('TRACKER')}
      >
        <Ionicons
          name={currentTab === 'TRACKER' ? 'cube' : 'cube-outline'}
          size={20}
          color={currentTab === 'TRACKER' ? Colors.white : Colors.textMuted}
        />
        <Text
          style={[
            styles.tabLabel,
            currentTab === 'TRACKER' && styles.tabLabelActive,
          ]}
        >
          Tracker
        </Text>
      </TouchableOpacity>

      {/* Budgets Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onSelectTab('BUDGETS')}
      >
        <Ionicons
          name={currentTab === 'BUDGETS' ? 'pie-chart' : 'pie-chart-outline'}
          size={20}
          color={currentTab === 'BUDGETS' ? Colors.white : Colors.textMuted}
        />
        <Text
          style={[
            styles.tabLabel,
            currentTab === 'BUDGETS' && styles.tabLabelActive,
          ]}
        >
          Budgets
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 78,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 16,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabLabelActive: {
    color: Colors.white,
  },
  centerAddButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
