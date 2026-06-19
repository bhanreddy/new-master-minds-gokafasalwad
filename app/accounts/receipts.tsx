
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';

import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ScrollView, Pressable } from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { FeeCollector, FeeService } from '../../src/services/feeService';
import { generateReceiptPDF } from '../../src/utils/pdfGenerator';
import { useTheme } from '../../src/hooks/useTheme';
import { useAuth } from '../../src/hooks/useAuth';
import { useAccountsWebChrome } from '../../src/contexts/AccountsWebChromeContext';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const monthStart = () => {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
};

const todayInput = () => toDateInput(new Date());

const isAdminRole = (role?: string | null) => role === 'admin' || role === 'principal';

/** Map API fee_type label to Receipts filter chip (fee_types are school-defined names). */
function feeTypeToFilterCategory(feeType: string | undefined): 'Fees' | 'Uniform' | 'Transport' | 'Other' {
  const n = (feeType || '').toLowerCase().trim();
  if (!n) return 'Other';
  if (/\buniform\b|dress|apparel/.test(n)) return 'Uniform';
  if (/transport|conveyance|\bbus\b|\bvan\b/.test(n)) return 'Transport';
  if (
    /tuition|academic|examination|exam\b|admission|lab fee|library|development|activity|hostel|sports|magazine|stationery|calendar|computer|smart/.test(
      n
    )
  )
    return 'Fees';
  if (/\bfee\b/.test(n)) return 'Fees';
  return 'Other';
}

export default function ReceiptsScreen() {
  const {
    theme
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const { shellActive } = useAccountsWebChrome();
  const { user, role } = useAuth();
  const {
    t
  } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectors, setCollectors] = useState<FeeCollector[]>([]);
  const [fromDate, setFromDate] = useState(monthStart());
  const [toDate, setToDate] = useState(todayInput());
  const [selectedCollectorId, setSelectedCollectorId] = useState<string | null>(null);
  const [collectionTotal, setCollectionTotal] = useState<number | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const filters = ['All', 'Fees', 'Uniform', 'Transport', 'Other'];
  const canPickCollector = isAdminRole(role);
  const currentUserId = user?.userId || user?.id || null;

  useEffect(() => {
    FeeService.getCollectors()
      .then(setCollectors)
      .catch(() => setCollectors([]));
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    if (!canPickCollector) {
      setSelectedCollectorId(currentUserId);
    }
  }, [canPickCollector, currentUserId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const receivedBy = selectedCollectorId || (canPickCollector ? undefined : currentUserId || undefined);
      const [txData, summaryData] = await Promise.all([
        FeeService.getTransactions({
          from_date: fromDate,
          to_date: `${toDate}T23:59:59`,
          received_by: receivedBy,
          limit: 200,
        }),
        FeeService.getCollectionSummary({
          from_date: fromDate,
          to_date: `${toDate}T23:59:59`,
          received_by: receivedBy,
        }),
      ]);

      const rows = Array.isArray(txData) ? txData : (txData as any)?.data ?? [];
      const formatted = rows.map((tx: any) => ({
        id: tx.id,
        student: tx.student_name,
        admission_no: tx.admission_no,
        amount: `₹${Number(tx.amount || 0).toLocaleString('en-IN')}`,
        date: new Date(tx.paid_at).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short'
        }),
        type: tx.payment_method,
        classLabel: [tx.class_name, tx.section_name].filter(Boolean).join(' — ') || '—',
        feeType: tx.fee_type,
        collector: tx.received_by || '—',
        raw: tx
      }));
      setReceipts(formatted);
      setCollectionTotal(Number(summaryData?.total_collected ?? 0));
    } catch (error) {

    } finally {
      setLoading(false);
    }
  }, [canPickCollector, currentUserId, fromDate, selectedCollectorId, toDate]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadData();
  }, [loadData, user]);

  const filteredReceipts = useMemo(() => {
    let list = receipts;
    if (selectedFilter !== 'All') {
      list = list.filter((r) => feeTypeToFilterCategory(r.raw?.fee_type) === selectedFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const name = (r.student || '').toLowerCase();
        const adm = String(r.admission_no ?? '').toLowerCase();
        const ref = String(r.raw?.transaction_ref ?? '').toLowerCase();
        const id = String(r.id ?? '').toLowerCase();
        return name.includes(q) || adm.includes(q) || ref.includes(q) || id.includes(q);
      });
    }
    return list;
  }, [receipts, selectedFilter, searchQuery]);

  const handlePrint = async (transaction: any) => {
    try {
      // Ensure academic_year is passed even if nested or named slightly differently
      const receiptData = {
        ...transaction,
        academic_year: transaction.academic_year || (transaction as any).academicYear
      };
      await generateReceiptPDF(receiptData);
    } catch (error) {
      alertCompat('Error', 'Failed to generate receipt PDF');
    }
  };
  const renderReceiptItem = ({
    item,
    index

  }: { item: any; index: number; }) => {
    return <Animated.View entering={FadeInDown.delay(index * 100).duration(500)} style={styles.receiptCard}>
      <View style={[styles.receiptLeft, {
        flex: 1
      }]}>
        <View style={[styles.iconBox, {
          backgroundColor: '#F3F4F6'
        }]}>
          <Ionicons name="receipt" size={20} color="#4B5563" />
        </View>
        <View style={{
          flex: 1
        }}>
          <Text style={styles.studentName} numberOfLines={1}>{item.student}</Text>
          <Text style={styles.receiptDetails}>{item.admission_no} • {item.classLabel}</Text>
          <Text style={styles.collectorText}>Collected by {item.collector}</Text>
        </View>
      </View>
      <View style={[styles.receiptRight, {
        flexShrink: 0,
        marginLeft: 10
      }]}>
        <Text style={styles.amount}>{item.amount}</Text>
        <Text style={styles.date}>{item.date}</Text>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          marginTop: 6
        }}>
          <Text style={styles.typeBadge}>{item.type}</Text>
          <TouchableOpacity onPress={() => handlePrint(item.raw)}>
            <Ionicons name="print-outline" size={18} color="#4B5563" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>;
  };
  return <View style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#fff" />
    {!shellActive && <AdminHeader title="Receipts" showBackButton={true} />}
    <View style={styles.content}>
      <Pressable style={styles.filterToggle} onPress={() => setFiltersExpanded((prev) => !prev)}>
        <View style={styles.filterToggleLeft}>
          <Ionicons name="calendar-outline" size={16} color="#4B5563" />
          <Text style={styles.filterToggleText}>
            {fromDate} → {toDate}
            {selectedCollectorId
              ? ` · ${collectors.find((c) => c.id === selectedCollectorId)?.name || 'Accountant'}`
              : canPickCollector ? ' · All accountants' : ''}
          </Text>
        </View>
        <Ionicons name={filtersExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#6B7280" />
      </Pressable>

      {filtersExpanded ? (
        <Animated.View entering={FadeIn.duration(250)} style={styles.filterPanel}>
          <View style={styles.dateRow}>
            <View style={styles.dateCell}>
              <Text style={styles.filterLabel}>FROM</Text>
              <AppTextInput
                style={[ds.inputInChrome, styles.dateInput]}
                value={fromDate}
                onChangeText={setFromDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={styles.dateCell}>
              <Text style={styles.filterLabel}>TO</Text>
              <AppTextInput
                style={[ds.inputInChrome, styles.dateInput]}
                value={toDate}
                onChangeText={setToDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>

          {canPickCollector ? (
            <>
              <Text style={styles.filterLabel}>ACCOUNTANT</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <TouchableOpacity
                  style={[styles.collectorChip, !selectedCollectorId && styles.collectorChipActive]}
                  onPress={() => setSelectedCollectorId(null)}
                >
                  <Text style={[styles.collectorChipText, !selectedCollectorId && styles.collectorChipTextActive]}>All</Text>
                </TouchableOpacity>
                {collectors.map((collector) => {
                  const active = selectedCollectorId === collector.id;
                  return (
                    <TouchableOpacity
                      key={collector.id}
                      style={[styles.collectorChip, active && styles.collectorChipActive]}
                      onPress={() => setSelectedCollectorId(active ? null : collector.id)}
                    >
                      <Text style={[styles.collectorChipText, active && styles.collectorChipTextActive]}>{collector.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            <Text style={styles.selfCollectorNote}>
              Showing collections recorded by you
            </Text>
          )}
        </Animated.View>
      ) : null}

      {collectionTotal !== null ? (
        <View style={styles.totalBanner}>
          <Text style={styles.totalLabel}>Collected in range</Text>
          <Text style={styles.totalValue}>₹{collectionTotal.toLocaleString('en-IN')}</Text>
        </View>
      ) : null}

      {/* Search Bar */}
      <View style={[styles.searchContainer, ds.searchBarWrapper]}>
        <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <AppTextInput style={[ds.inputInChrome, styles.searchInput]} placeholder="Search by transaction ID or Name" placeholderTextColor="#9CA3AF" value={searchQuery} onChangeText={setSearchQuery} />
      </View>
      {/* Filters */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{
          gap: 10
        }}>
          {filters.map((filter, index) => {
            return <TouchableOpacity key={index} onPress={() => setSelectedFilter(filter)} style={[styles.filterChip, selectedFilter === filter && styles.activeFilterChip]}>
              <Text style={[styles.filterText, selectedFilter === filter && styles.activeFilterText]}>{filter}</Text>
            </TouchableOpacity>;
          })}
        </ScrollView>
      </View>
      {loading ? <LogoLoader size={60} color="#6B7280" style={{
        marginTop: 20
      }} /> : <FlatList data={filteredReceipts} renderItem={renderReceiptItem} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false} contentContainerStyle={{
        paddingBottom: 20
      }} ListEmptyComponent={<Text style={styles.emptyText}>{receipts.length === 0 ? 'No receipts found' : 'No receipts match your filters'}</Text>} />}
    </View>
  </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  content: {
    flex: 1,
    paddingHorizontal: 20
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filterToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 },
  filterToggleText: { fontSize: 12, fontWeight: '700', color: '#374151', flexShrink: 1 },
  filterPanel: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: theme.colors.textSecondary,
  },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateCell: { flex: 1, gap: 6 },
  dateInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 14,
    color: '#111827',
  },
  chipRow: { gap: 8, paddingVertical: 4 },
  collectorChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  collectorChipActive: {
    backgroundColor: '#F3F4F6',
    borderColor: '#9CA3AF',
  },
  collectorChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  collectorChipTextActive: {
    color: '#111827',
  },
  selfCollectorNote: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  totalBanner: {
    marginTop: 12,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  searchIcon: {
    marginRight: 10
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937'
  },
  filterContainer: {
    marginTop: 15,
    marginBottom: 10
  },
  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  activeFilterChip: {
    backgroundColor: '#F3F4F6',
    borderColor: '#9CA3AF'
  },
  filterText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  activeFilterText: {
    color: '#111827'
  },
  receiptCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    marginTop: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 0
  },
  receiptLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  studentName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827'
  },
  receiptDetails: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2
  },
  collectorText: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    marginTop: 2,
    fontWeight: '600',
  },
  receiptRight: {
    alignItems: 'flex-end'
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827'
  },
  date: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    marginTop: 2
  },
  typeBadge: {
    fontSize: 10,
    backgroundColor: '#FFFFFF',
    color: theme.colors.textSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textTransform: 'uppercase',
    fontWeight: 'bold'
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: theme.colors.textSecondary,
    fontSize: 15
  },
  cancelBtnText: {
    color: theme.colors.textSecondary,
    fontWeight: '600'
  }
});