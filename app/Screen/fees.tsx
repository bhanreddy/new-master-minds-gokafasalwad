import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform, StatusBar, RefreshControl, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import * as Haptics from '@/src/utils/haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { StudentService } from '../../src/services/studentService';
import { FeeResponse, StudentFee } from '../../src/types/models';
import { useAuth } from '../../src/hooks/useAuth';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
import HtmlPreview from '../../src/components/HtmlPreview';
import { FeeService } from '../../src/services/feeService';
import { SchoolSettingsService, SchoolSettings } from '../../src/services/schoolSettingsService';
import { alertCompat } from '../../src/utils/crossPlatformAlert';

const FeesScreen = () => {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const {
    t
  } = useTranslation();
  const router = useRouter();
  const {
    user
  } = useAuth();
  const [feeData, setFeeData] = useState<FeeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [downloadingPreview, setDownloadingPreview] = useState(false);

  useEffect(() => {
    loadFees();
    loadSchoolSettings();
  }, [user?.userId]);

  const loadSchoolSettings = async () => {
    try {
      const data = await SchoolSettingsService.getSettings();
      setSchoolSettings(data);
    } catch (error) {
      // ignore
    }
  };
  const loadFees = async () => {
    if (!user) return;
    try {
      const data = await StudentService.getFees(user.userId);
      setFeeData(data);
    } catch (error) {

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadFees();
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'overdue':
        return '#ef4444';
      case 'partial':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const formatAdjustmentOption = (adj: { amount: number; created_at: string; adjustment_type?: string }) => {
    const isAdd = adj.adjustment_type === 'add';
    const sign = isAdd ? '+' : '−';
    const label = isAdd ? 'Added' : 'Waived';
    return `${label}: ${sign}₹${adj.amount.toLocaleString()} (${new Date(adj.created_at).toLocaleDateString()})`;
  };

  const openAdjustmentPreview = async (adj: { id: string }) => {
    try {
      setLoadingReceipts(true);
      const details = await FeeService.getAdjustment(adj.id);
      const { buildAdjustmentPDFHtml } = await import('../../src/utils/pdfGenerator');
      const html = buildAdjustmentPDFHtml(details, schoolSettings);
      setPreviewHtml(html);
      setPreviewVisible(true);
    } catch {
      alert('Failed to load receipt preview.');
    } finally {
      setLoadingReceipts(false);
    }
  };

  const closePreview = () => {
    if (downloadingPreview) return;
    setPreviewVisible(false);
    setPreviewHtml(null);
  };

  const handleDownloadFromPreview = async () => {
    if (!previewHtml) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setDownloadingPreview(true);
      const { shareHtmlAsPdf } = await import('../../src/utils/pdfGenerator');
      await shareHtmlAsPdf(previewHtml);
    } catch {
      alert('Failed to download adjustment receipt.');
    } finally {
      setDownloadingPreview(false);
    }
  };

  const handleDownloadAdjustmentReceipt = async (item: StudentFee) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLoadingReceipts(true);
      const res = await FeeService.getAdjustments({ student_fee_id: item.id });
      const adjustments = res?.data || [];

      if (adjustments.length === 0) {
        alert('No adjustment records found for this fee component.');
        setLoadingReceipts(false);
        return;
      }

      if (adjustments.length === 1) {
        // openAdjustmentPreview manages loadingReceipts
        await openAdjustmentPreview(adjustments[0]);
        return;
      }

      setLoadingReceipts(false);
      const options = adjustments.map((a: any) => ({
        text: formatAdjustmentOption(a),
        onPress: () => void openAdjustmentPreview(a)
      }));
      options.push({ text: 'Cancel', style: 'cancel' } as any);
      alertCompat(
        'Multiple Adjustments Found',
        'Please select which adjustment receipt to preview:',
        options
      );
    } catch (error) {
      alert('Failed to load adjustment receipt.');
      setLoadingReceipts(false);
    }
  };

  const renderFeeItem = ({
    item,
    index

  }: { item: StudentFee; index: number; }) => {
    const color = getStatusColor(item.status);
    const dueAmount = item.amount_due - item.discount;
    return <Animated.View entering={FadeInUp.delay(index * 100).duration(500)} style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.feeType}>{item.fee_type}</Text>
          <Text style={styles.date}>Due: {new Date(item.due_date).toLocaleDateString()}</Text>
        </View>
        <View style={[styles.statusBadge, {
          backgroundColor: color + '20'
        }]}>
          <Text style={[styles.statusText, {
            color: color
          }]}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.amountRow}>
        <View>
          <Text style={styles.amountLabel}>Total Due</Text>
          <Text style={styles.amountValue}>₹{dueAmount.toLocaleString()}</Text>
        </View>
        <View style={{
          alignItems: 'flex-end'
        }}>
          <Text style={styles.amountLabel}>Paid</Text>
          <Text style={[styles.amountValue, {
            color: '#10b981'
          }]}>₹{item.amount_paid.toLocaleString()}</Text>
        </View>
      </View>

      {(item.status === 'pending' || item.status === 'overdue' || item.status === 'partial') && <TouchableOpacity style={styles.payButton} onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Future: Integrate Payment Gateway
        alert("Payment gateway integration pending.");
      }}>
        <Text style={styles.payButtonText}>Pay Now</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </TouchableOpacity>}

      {((item.adjustment_count ?? 0) > 0 || item.discount > 0) && (
        <View>
          <View style={styles.divider} />
          <TouchableOpacity 
            style={[styles.downloadBtn, { backgroundColor: '#eef2ff', paddingVertical: 6 }]} 
            onPress={() => handleDownloadAdjustmentReceipt(item)}
            disabled={loadingReceipts}
          >
            <Ionicons name="eye-outline" size={14} color="#4F46E5" />
            <Text style={[styles.downloadText, { color: '#4F46E5', fontSize: 12 }]}>Preview Receipt</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>;
  };
  if (loading) {
    return <View style={styles.loadingContainer}>
      <LogoLoader size={60} color="#4F46E5" />
    </View>;
  }
  return <SafeAreaView style={styles.container}>
    <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />

    {/* Header */}
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Fees</Text>
        <View style={{
          width: 40
        }} />
      </View>

      {/* Summary Card */}
      {feeData && <Animated.View entering={FadeInDown.duration(600)} style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Total Due</Text>
            <Text style={styles.summaryValue}>₹{feeData.summary.total_due.toLocaleString()}</Text>
          </View>
          <View style={{
            height: 40,
            width: 1,
            backgroundColor: 'rgba(255,255,255,0.2)'
          }} />
          <View>
            <Text style={styles.summaryLabel}>Outstanding</Text>
            <Text style={[styles.summaryValue, {
              color: '#fca5a5'
            }]}>₹{feeData.summary.balance.toLocaleString()}</Text>
          </View>
        </View>
      </Animated.View>}
    </View>

    <FlatList contentContainerStyle={styles.list} data={feeData?.fees || []} renderItem={renderFeeItem} keyExtractor={(item) => item.id} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />} ListEmptyComponent={<View style={styles.emptyContainer}>
      <Ionicons name="wallet-outline" size={64} color="#ccc" />
      <Text style={styles.emptyText}>No fee records found.</Text>
    </View>} />

    {loadingReceipts && (
      <View style={styles.loadingOverlay} pointerEvents="auto">
        <LogoLoader size={48} color="#4F46E5" />
        <Text style={styles.loadingOverlayText}>Preparing preview…</Text>
      </View>
    )}

    <Modal
      visible={previewVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={closePreview}
    >
      <SafeAreaView style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          <TouchableOpacity
            onPress={closePreview}
            style={styles.previewCloseBtn}
            disabled={downloadingPreview}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
          >
            <Ionicons name="close" size={22} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.previewTitle}>Receipt Preview</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.previewBody}>
          {previewHtml ? <HtmlPreview html={previewHtml} style={styles.previewWebView} /> : null}
        </View>

        <View style={styles.previewFooter}>
          <TouchableOpacity
            style={styles.previewSecondaryBtn}
            onPress={closePreview}
            disabled={downloadingPreview}
          >
            <Text style={styles.previewSecondaryText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.previewPrimaryBtn, downloadingPreview && styles.previewPrimaryBtnDisabled]}
            onPress={handleDownloadFromPreview}
            disabled={downloadingPreview || !previewHtml}
          >
            {downloadingPreview ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="download-outline" size={18} color="#fff" />
            )}
            <Text style={styles.previewPrimaryText}>
              {downloadingPreview ? 'Downloading…' : 'Download PDF'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
};
export default FeesScreen;
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 0,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 10
    },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 10
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 20,
    height: 48
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.background
  },
  summaryCard: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginBottom: 4
  },
  summaryValue: {
    color: theme.colors.background,
    fontSize: 20,
    fontWeight: '700'
  },
  list: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 40
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  feeType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4
  },
  date: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700'
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.card,
    marginVertical: 12
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  amountLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 2
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937'
  },
  payButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8
  },
  payButtonText: {
    color: theme.colors.background,
    fontWeight: '600',
    fontSize: 14
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    marginTop: 8
  },
  downloadText: {
    fontSize: 14,
    fontWeight: '600'
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60
  },
  emptyText: {
    marginTop: 16,
    color: theme.colors.textTertiary,
    fontSize: 16
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    gap: 12
  },
  loadingOverlayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5'
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6'
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB'
  },
  previewCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937'
  },
  previewBody: {
    flex: 1,
    margin: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  previewWebView: {
    flex: 1,
    backgroundColor: '#fff'
  },
  previewWebLoading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  previewFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB'
  },
  previewSecondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center'
  },
  previewSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151'
  },
  previewPrimaryBtn: {
    flex: 1.4,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  previewPrimaryBtnDisabled: {
    opacity: 0.7
  },
  previewPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff'
  }
});
