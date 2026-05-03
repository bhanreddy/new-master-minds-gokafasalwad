
import React, { useState, useEffect, useMemo } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';

import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { FeeService } from '../../src/services/feeService';
import { generateReceiptPDF } from '../../src/utils/pdfGenerator';
import { useTheme } from '../../src/hooks/useTheme';
import { useAccountsWebChrome } from '../../src/contexts/AccountsWebChromeContext';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';

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
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const { shellActive } = useAccountsWebChrome();
  const {
    t
  } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const filters = ['All', 'Fees', 'Uniform', 'Transport', 'Other'];
  useEffect(() => {
    loadData();
  }, []);
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await FeeService.getTransactions();
      const formatted = data.map((tx) => ({
        id: tx.id,
        student: tx.student_name,
        admission_no: tx.admission_no,
        amount: `₹${tx.amount.toLocaleString()}`,
        date: new Date(tx.paid_at).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short'
        }),
        type: tx.payment_method,
        class: tx.fee_type,
        raw: tx
      }));
      setReceipts(formatted);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  };

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
          backgroundColor: '#E0F2FE'
        }]}>
          <Ionicons name="receipt" size={20} color="#0284C7" />
        </View>
        <View style={{
          flex: 1
        }}>
          <Text style={styles.studentName} numberOfLines={1}>{item.student}</Text>
          <Text style={styles.receiptDetails}>{item.admission_no} • {item.class}</Text>
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
            <Ionicons name="print-outline" size={18} color="#6366F1" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>;
  };
  return <View style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#fff" />
    {!shellActive && <AdminHeader title="Receipts" showBackButton={true} />}
    <View style={styles.content}>
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
      {loading ? <LogoLoader size={60} color="#6366F1" style={{
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
    backgroundColor: 'transparent'
  },
  content: {
    flex: 1,
    paddingHorizontal: 20
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
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
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  activeFilterChip: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1'
  },
  filterText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  activeFilterText: {
    color: theme.colors.background
  },
  receiptCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 15,
    marginTop: 15,
    elevation: 1
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
  receiptRight: {
    alignItems: 'flex-end'
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669'
  },
  date: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    marginTop: 2
  },
  typeBadge: {
    fontSize: 10,
    backgroundColor: theme.colors.card,
    color: theme.colors.textSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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