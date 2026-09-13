import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { User } from '../types';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: User | null;
  onLogout: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  visible,
  onClose,
  user,
  onLogout,
}) => {
  if (!user) return null;

  const initials = (user.name || user.email || 'WS')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const forwardingEmail = `orders+${user.id}@inbound.wealthsync.io`;

  const handleConfirmLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of WealthSync?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            onClose();
            onLogout();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="person-circle" size={22} color={Colors.white} />
              <Text style={styles.title}>Account Credentials</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* User Avatar & Name Card */}
            <View style={styles.avatarCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <Text style={styles.userName}>{user.name || 'WealthSync User'}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Cloud Active • Verified</Text>
              </View>
            </View>

            {/* Credentials Section */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>ACCOUNT CREDENTIALS</Text>

              {/* Full Name */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Display Name</Text>
                <Text style={styles.infoValue}>{user.name || 'Not set'}</Text>
              </View>

              {/* Email Address */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Login Email</Text>
                <Text style={styles.infoValue}>{user.email}</Text>
              </View>

              {/* Currency */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Primary Currency</Text>
                <Text style={styles.infoValue}>
                  {user.currency === 'USD' ? 'US Dollar ($)' : 'Philippine Peso (₱)'}
                </Text>
              </View>

              {/* User ID */}
              <View style={styles.tokenBox}>
                <View style={styles.tokenBoxHeader}>
                  <Text style={styles.infoLabel}>User UUID / Account ID</Text>
                  <Text style={styles.hintText}>Press & hold to copy</Text>
                </View>
                <TextInput
                  value={user.id}
                  editable={false}
                  selectTextOnFocus
                  style={styles.monoInput}
                />
              </View>
            </View>

            {/* Email Sync Forwarding Address */}
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>SYNC & FORWARDING TOKEN</Text>
              <Text style={styles.sectionSub}>
                Your dedicated inbound forwarding address for auto-logging receipts:
              </Text>
              <View style={styles.tokenBox}>
                <TextInput
                  value={forwardingEmail}
                  editable={false}
                  selectTextOnFocus
                  style={styles.monoInput}
                />
              </View>
            </View>

            {/* Logout Action */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleConfirmLogout}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
              <Text style={styles.logoutText}>Sign Out of WealthSync</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: Colors.border,
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  closeBtn: {
    padding: 6,
  },
  scroll: {
    maxHeight: 520,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarCard: {
    alignItems: 'center',
    paddingVertical: 18,
    backgroundColor: Colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 18,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34D399',
  },
  section: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    gap: 12,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  sectionSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  tokenBox: {
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  tokenBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hintText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  monoInput: {
    fontSize: 12,
    color: '#38BDF8',
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: '#0F172A',
    borderRadius: 6,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 6,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
});
