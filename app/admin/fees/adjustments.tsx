import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Platform } from 'react-native';
import KeyboardAwareScreen from '@/components/keyboard/KeyboardAwareScreen';
import AppTextInput from '@/src/components/AppTextInput';
import { alertCompat } from '../../../src/utils/crossPlatformAlert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../../src/components/AdminHeader';
import { ADMIN_THEME } from '../../../src/constants/adminTheme';
import { useAuth } from '../../../src/hooks/useAuth';
import { StudentService } from '../../../src/services/studentService';
import { FeeService } from '../../../src/services/feeService';
import { useTheme } from '../../../src/hooks/useTheme';
import { Theme } from '../../../src/theme/themes';
import LogoLoader from '../../../src/components/LogoLoader';
import { StudentFee, Student, FeeAdjustmentType } from '../../../src/types/models';

interface AdjustmentLog {
  id: string;
  amount: number;
  reason: string;
  receipt_no: string;
  fee_component: string;
  created_at: string;
  adjusted_by_name: string;
  student_name: string;
  admission_no: string;
  adjustment_type?: FeeAdjustmentType;
}

export default function FeeAdjustmentsScreen() {
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const router = useRouter();
  const { user } = useAuth();

  // Search & Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Student Fees & Form State
  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<FeeAdjustmentType>('waive');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // History State
  const [history, setHistory] = useState<AdjustmentLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  // Fetch adjustments history
  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await FeeService.getAdjustments();
      setHistory(res?.data || []);
    } catch (error) {
      console.error('Failed to load adjustments history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Perform student search
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    const query = text.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      setSearching(true);
      const results = await StudentService.search(query);
      setSearchResults(results || []);
    } catch (error) {
      console.error('Student search failed:', error);
    } finally {
      setSearching(false);
    }
  };

  // Select a student and load their fees
  const handleSelectStudent = async (student: Student) => {
    setSelectedStudent(student);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedFee(null);
    setAdjustAmount('');
    setReason('');

    try {
      setLoadingFees(true);
      const feeData = await FeeService.getStudentFees(student.id);
      // Filter out fully paid fees to keep it clean
      setStudentFees(feeData?.fees || []);
    } catch (error) {
      alertCompat('Error', 'Failed to load student fees');
    } finally {
      setLoadingFees(false);
    }
  };

  const handleSelectFee = (fee: StudentFee) => {
    setSelectedFee(fee);
    setAdjustAmount('');
  };

  const handleSubmit = async () => {
    if (!selectedStudent || !selectedFee || !adjustAmount || !reason.trim()) {
      alertCompat('Error', 'Please fill in all required fields');
      return;
    }

    const parsedAmount = Number(adjustAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      if (adjustmentType === 'add') {
        alertCompat('Error', 'Amount must be greater than zero');
      } else {
        alertCompat('Error', 'Adjustment amount must be a positive number');
      }
      return;
    }

    const remaining = selectedFee.amount_due - selectedFee.discount - selectedFee.amount_paid;
    if (adjustmentType === 'waive' && parsedAmount > remaining) {
      alertCompat('Error', `Cannot waive more than the outstanding amount (₹${remaining.toLocaleString()})`);
      return;
    }

    try {
      setSubmitting(true);
      await FeeService.adjustFee({
        student_fee_id: selectedFee.id,
        amount: parsedAmount,
        reason: reason.trim(),
        adjustment_type: adjustmentType,
      });

      alertCompat('Success', 'Adjustment applied successfully');
      
      // Refresh state
      setAdjustAmount('');
      setReason('');
      setSelectedFee(null);
      
      // Reload student fees
      const updatedFeeData = await FeeService.getStudentFees(selectedStudent.id);
      setStudentFees(updatedFeeData?.fees || []);

      // Reload global history
      loadHistory();
    } catch (error: any) {
      alertCompat('Error', error?.message || 'Failed to apply fee adjustment');
    } finally {
      setSubmitting(false);
    }
  };

  const renderHistoryItem = ({ item }: { item: AdjustmentLog }) => {
    const formattedDate = new Date(item.created_at).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(',', '');

    const isAdd = (item.adjustment_type ?? 'waive') === 'add';
    const typeBadgeStyle = isAdd ? styles.historyBadgeAdd : styles.historyBadgeWaive;
    const amountStyle = isAdd ? styles.historyAmountAdd : styles.historyAmountWaive;
    const amountText = `${isAdd ? '+' : '−'}₹${item.amount.toLocaleString()}`;

    return (
      <View style={styles.historyRow}>
        <View style={styles.historyMetaCol}>
          <Text style={styles.historyTimestamp}>{formattedDate}</Text>
          <Text style={styles.historyAdmin}>by Admin: {item.adjusted_by_name}</Text>
        </View>
        <View style={styles.historyInfoCol}>
          <View style={styles.historyBadgeRow}>
            <View style={[styles.historyBadge, typeBadgeStyle]}>
              <Text style={[styles.historyBadgeText, isAdd && styles.historyBadgeTextAdd]}>
                {isAdd ? 'Added' : 'Waived'}
              </Text>
            </View>
          </View>
          <Text style={styles.historyStudent}>{item.student_name} ({item.admission_no})</Text>
          <Text style={styles.historyFeeHead}>{item.fee_component}</Text>
          <Text style={styles.historyReason}>Reason: "{item.reason}"</Text>
        </View>
        <Text style={[styles.historyAmount, amountStyle]}>{amountText}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <AdminHeader title="Fee Adjustments" showBackButton />
      
      <KeyboardAwareScreen variant="scroll" contentContainerStyle={styles.scrollContent} bottomOffset={24}>
        {/* Adjustment Creation Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Apply Adjustment</Text>

          {/* Student Search */}
          <Text style={styles.label}>Search Student</Text>
          <View style={styles.searchContainer}>
            <AppTextInput
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="Search by student name or admission number..."
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
            />
            {searching && <LogoLoader size={20} color={ADMIN_THEME.colors.primary} style={styles.searchLoader} />}
          </View>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <View style={styles.dropdown}>
              {searchResults.map((student) => (
                <TouchableOpacity
                  key={student.id}
                  style={styles.dropdownItem}
                  onPress={() => handleSelectStudent(student)}
                >
                  <Ionicons name="person-outline" size={16} color="#64748B" style={{ marginRight: 8 }} />
                  <Text style={styles.dropdownText}>
                    {student.display_name} ({student.admission_no})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Selected Student Banner */}
          {selectedStudent && (
            <View style={styles.studentBanner}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(selectedStudent.display_name || 'S').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.studentName}>{selectedStudent.display_name}</Text>
                <Text style={styles.studentDetails}>Admission No: {selectedStudent.admission_no}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedStudent(null)} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* Fee Components Selector */}
          {selectedStudent && (
            <>
              <Text style={styles.label}>Select Fee Component</Text>
              {loadingFees ? (
                <LogoLoader size={30} color={ADMIN_THEME.colors.primary} style={{ marginVertical: 10 }} />
              ) : studentFees.length === 0 ? (
                <Text style={styles.emptyText}>No fee structures assigned to this student.</Text>
              ) : (
                <View style={styles.chipGrid}>
                  {studentFees.map((fee) => {
                    const remaining = fee.amount_due - fee.discount - fee.amount_paid;
                    const isSelected = selectedFee?.id === fee.id;
                    const isFullyPaid = remaining <= 0;
                    const chipDisabled = adjustmentType === 'waive' && isFullyPaid;

                    return (
                      <TouchableOpacity
                        key={fee.id}
                        disabled={chipDisabled}
                        style={[
                          styles.feeChip,
                          isSelected && styles.feeChipActive,
                          chipDisabled && styles.feeChipDisabled
                        ]}
                        onPress={() => handleSelectFee(fee)}
                      >
                        <Text style={[
                          styles.feeChipText,
                          isSelected && styles.feeChipTextActive,
                          chipDisabled && styles.feeChipTextDisabled
                        ]}>
                          {fee.fee_type}
                        </Text>
                        <Text style={[
                          styles.feeChipBalance,
                          isSelected && styles.feeChipBalanceActive,
                          chipDisabled && styles.feeChipBalanceDisabled
                        ]}>
                          {isFullyPaid ? 'PAID' : `₹${remaining.toLocaleString()} due`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* Form Fields once component is selected */}
          {selectedFee && (
            <View style={styles.formContainer}>
              <View style={styles.balanceInfoBox}>
                <Text style={styles.balanceTitle}>Component Details ({selectedFee.fee_type})</Text>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>Total Assigned:</Text>
                  <Text style={styles.balanceVal}>₹{selectedFee.amount_due.toLocaleString()}</Text>
                </View>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>Paid Amount:</Text>
                  <Text style={[styles.balanceVal, { color: '#10B981' }]}>₹{selectedFee.amount_paid.toLocaleString()}</Text>
                </View>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>Existing Waiver:</Text>
                  <Text style={[styles.balanceVal, { color: '#6366F1' }]}>₹{selectedFee.discount.toLocaleString()}</Text>
                </View>
                <View style={[styles.balanceRow, { borderTopWidth: 1, borderColor: '#E2E8F0', paddingTop: 6, marginTop: 4 }]}>
                  <Text style={[styles.balanceLabel, { fontWeight: '700' }]}>Remaining Balance:</Text>
                  <Text style={[styles.balanceVal, { fontWeight: '800', color: '#EF4444' }]}>
                    ₹{(selectedFee.amount_due - selectedFee.discount - selectedFee.amount_paid).toLocaleString()}
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>Adjustment Type</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeOption, adjustmentType === 'waive' && styles.typeOptionActive]}
                  onPress={() => setAdjustmentType('waive')}
                >
                  <Text style={[styles.typeOptionTitle, adjustmentType === 'waive' && styles.typeOptionTitleActive]}>
                    Waive Fee (Reduce)
                  </Text>
                  <Text style={styles.typeOptionDesc}>Reduces the amount the student owes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeOption, adjustmentType === 'add' && styles.typeOptionActiveAdd]}
                  onPress={() => setAdjustmentType('add')}
                >
                  <Text style={[styles.typeOptionTitle, adjustmentType === 'add' && styles.typeOptionTitleActiveAdd]}>
                    Add Fee (Increase)
                  </Text>
                  <Text style={styles.typeOptionDesc}>Increases the amount the student owes</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>
                {adjustmentType === 'add' ? 'Amount to Add (₹)' : 'Amount to Waive (₹)'}
              </Text>
              <AppTextInput
                value={adjustAmount}
                onChangeText={setAdjustAmount}
                placeholder={adjustmentType === 'add' ? 'Enter amount to add...' : 'Enter waiver amount...'}
                keyboardType="numeric"
                placeholderTextColor="#94A3B8"
                style={styles.formInput}
              />

              <Text style={styles.label}>Reason for Adjustment</Text>
              <AppTextInput
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Sibling concession, fee correction..."
                placeholderTextColor="#94A3B8"
                style={styles.formInput}
              />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <LogoLoader color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.submitBtnText}>Apply Adjustment</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Adjustments History Card */}
        <View style={[styles.card, { marginTop: 20 }]}>
          <Text style={styles.cardTitle}>Adjustments History Log</Text>
          {loadingHistory ? (
            <LogoLoader size={40} color={ADMIN_THEME.colors.primary} style={{ marginVertical: 30 }} />
          ) : history.length === 0 ? (
            <Text style={styles.emptyText}>No fee adjustments logged yet.</Text>
          ) : (
            <FlatList
              data={history}
              renderItem={renderHistoryItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>

        <View style={{ height: 40 }} />
      </KeyboardAwareScreen>
    </View>
  );
}

const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    scrollContent: {
      padding: 16,
    },
    card: {
      backgroundColor: isDark ? '#1E293B' : '#fff',
      borderRadius: 16,
      padding: 20,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
        android: { elevation: 3 },
      }),
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#1E293B',
      marginBottom: 16,
      letterSpacing: -0.3,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#94A3B8' : '#475569',
      marginBottom: 8,
      marginTop: 14,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      position: 'relative',
    },
    searchInput: {
      flex: 1,
      backgroundColor: isDark ? '#334155' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#475569' : '#E2E8F0',
      borderRadius: 10,
      padding: 12,
      paddingRight: 40,
      fontSize: 14,
      color: isDark ? '#F1F5F9' : '#1E293B',
    },
    searchLoader: {
      position: 'absolute',
      right: 12,
    },
    dropdown: {
      backgroundColor: isDark ? '#1E293B' : '#fff',
      borderWidth: 1,
      borderColor: isDark ? '#475569' : '#E2E8F0',
      borderRadius: 10,
      marginTop: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 5,
      zIndex: 10,
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#334155' : '#F1F5F9',
    },
    dropdownText: {
      fontSize: 14,
      color: isDark ? '#F1F5F9' : '#1E293B',
    },
    studentBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#334155' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#475569' : '#E2E8F0',
      borderRadius: 12,
      padding: 12,
      marginTop: 10,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: 'rgba(99,102,241,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    avatarText: {
      fontSize: 18,
      fontWeight: '800',
      color: ADMIN_THEME.colors.primary,
    },
    studentName: {
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? '#F1F5F9' : '#1E293B',
    },
    studentDetails: {
      fontSize: 12,
      color: '#64748B',
      marginTop: 2,
    },
    clearBtn: {
      padding: 4,
    },
    emptyText: {
      fontSize: 13,
      color: '#94A3B8',
      textAlign: 'center',
      marginVertical: 14,
    },
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginVertical: 6,
    },
    feeChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: isDark ? '#475569' : '#E2E8F0',
      backgroundColor: isDark ? '#334155' : '#F8FAFC',
      alignItems: 'flex-start',
    },
    feeChipActive: {
      borderColor: ADMIN_THEME.colors.primary,
      backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF',
    },
    feeChipDisabled: {
      opacity: 0.5,
      backgroundColor: isDark ? '#1E293B' : '#F3F4F6',
      borderColor: 'transparent',
    },
    feeChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#F1F5F9' : '#1E293B',
    },
    feeChipTextActive: {
      color: ADMIN_THEME.colors.primary,
    },
    feeChipTextDisabled: {
      color: '#94A3B8',
      textDecorationLine: 'line-through',
    },
    feeChipBalance: {
      fontSize: 10,
      color: '#64748B',
      marginTop: 2,
      fontWeight: '500',
    },
    feeChipBalanceActive: {
      color: ADMIN_THEME.colors.primary,
    },
    feeChipBalanceDisabled: {
      color: '#94A3B8',
    },
    formContainer: {
      marginTop: 14,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#334155' : '#F1F5F9',
      paddingTop: 14,
    },
    balanceInfoBox: {
      backgroundColor: isDark ? '#334155' : '#EEF2FF',
      borderWidth: 1,
      borderColor: isDark ? '#475569' : '#C7D2FE',
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    },
    balanceTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: ADMIN_THEME.colors.primary,
      marginBottom: 8,
    },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 2,
    },
    balanceLabel: {
      fontSize: 12,
      color: isDark ? '#CBD5E1' : '#475569',
      fontWeight: '500',
    },
    balanceVal: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? '#F1F5F9' : '#1E293B',
    },
    formInput: {
      backgroundColor: isDark ? '#334155' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#475569' : '#E2E8F0',
      borderRadius: 10,
      padding: 12,
      fontSize: 14,
      color: isDark ? '#F1F5F9' : '#1E293B',
      marginBottom: 12,
    },
    submitBtn: {
      flexDirection: 'row',
      backgroundColor: ADMIN_THEME.colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    submitBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
    separator: {
      height: 1,
      backgroundColor: isDark ? '#334155' : '#F1F5F9',
      marginVertical: 12,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    historyMetaCol: {
      width: 110,
      marginRight: 8,
    },
    historyTimestamp: {
      fontSize: 11,
      fontWeight: '600',
      color: isDark ? '#94A3B8' : '#64748B',
    },
    historyAdmin: {
      fontSize: 10,
      color: '#94A3B8',
      marginTop: 2,
    },
    historyInfoCol: {
      flex: 1,
      marginRight: 8,
    },
    historyStudent: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#F1F5F9' : '#1E293B',
    },
    historyFeeHead: {
      fontSize: 12,
      color: ADMIN_THEME.colors.primary,
      fontWeight: '600',
      marginTop: 2,
    },
    historyReason: {
      fontSize: 11,
      color: isDark ? '#94A3B8' : '#64748B',
      fontStyle: 'italic',
      marginTop: 4,
    },
    historyAmount: {
      fontSize: 14,
      fontWeight: '800',
    },
    historyAmountWaive: {
      color: '#EF4444',
    },
    historyAmountAdd: {
      color: '#D97706',
    },
    historyBadgeRow: {
      marginBottom: 4,
    },
    historyBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 20,
    },
    historyBadgeWaive: {
      backgroundColor: '#DCFCE7',
    },
    historyBadgeAdd: {
      backgroundColor: '#FFEDD5',
    },
    historyBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#166534',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    historyBadgeTextAdd: {
      color: '#C2410C',
    },
    typeSelector: {
      gap: 8,
      marginBottom: 4,
    },
    typeOption: {
      borderWidth: 1.5,
      borderColor: isDark ? '#475569' : '#E2E8F0',
      borderRadius: 10,
      padding: 12,
      backgroundColor: isDark ? '#334155' : '#F8FAFC',
    },
    typeOptionActive: {
      borderColor: '#22C55E',
      backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : '#F0FDF4',
    },
    typeOptionActiveAdd: {
      borderColor: '#F59E0B',
      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#FFFBEB',
    },
    typeOptionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#F1F5F9' : '#1E293B',
    },
    typeOptionTitleActive: {
      color: '#166534',
    },
    typeOptionTitleActiveAdd: {
      color: '#C2410C',
    },
    typeOptionDesc: {
      fontSize: 11,
      color: '#64748B',
      marginTop: 2,
    },
  });
