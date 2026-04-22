import React, { useState, useEffect } from 'react';
import AppTextInput from '@/src/components/AppTextInput';

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Platform } from 'react-native';
import { alertCompat } from '../../../src/utils/crossPlatformAlert';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../../src/components/AdminHeader';
import { ADMIN_THEME } from '../../../src/constants/adminTheme';
import { useAuth } from '../../../src/hooks/useAuth';
import { ClassService, AcademicYear } from '../../../src/services/classService';
import { FeeService, FeeType } from '../../../src/services/feeService';
import { api } from '../../../src/services/apiClient';
import { Class } from '../../../src/types/schema';
import { useTheme } from '../../../src/hooks/useTheme';
import { Theme } from '../../../src/theme/themes';
import LogoLoader from '../../../src/components/LogoLoader';

export default function SetClassFeeScreen() {
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [classes, setClasses] = useState<Class[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [amount, setAmount] = useState('');
  const [feeTypeId, setFeeTypeId] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedYearId, setSelectedYearId] = useState('');

  // Add Fee Type state
  const [showAddType, setShowAddType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeNameTe, setNewTypeNameTe] = useState('');
  const [addingType, setAddingType] = useState(false);

  useEffect(() => { loadInitialData(); }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [classesData, typesData, yearsData] = await Promise.all([
        ClassService.getClasses(),
        api.get<FeeType[]>('/fees/types'),
        ClassService.getAcademicYears(),
      ]);
      setClasses(classesData);
      setFeeTypes(typesData);
      setAcademicYears(yearsData);
      if (yearsData.length > 0) {
        const current = yearsData.find((y) => {
          const now = new Date();
          return new Date(y.start_date) <= now && new Date(y.end_date) >= now;
        });
        setSelectedYearId(current?.id || yearsData[0].id);
      }
    } catch (error) {
      alertCompat('Error', 'Failed to load configuration data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFeeType = async () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) { alertCompat('Error', 'Please enter a fee type name'); return; }
    try {
      setAddingType(true);
      const payload: any = { name: trimmed };
      if (newTypeNameTe.trim()) payload.name_te = newTypeNameTe.trim();
      const created = await api.post<FeeType>('/fees/types', payload);
      setFeeTypes(prev => [...prev, created]);
      setFeeTypeId(created.id);
      setNewTypeName('');
      setNewTypeNameTe('');
      setShowAddType(false);
    } catch (error: any) {
      alertCompat('Error', error.response?.data?.error || error.message || 'Failed to create fee type');
    } finally {
      setAddingType(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedClassId || !amount || !feeTypeId || !selectedYearId) {
      alertCompat('Error', 'Please fill all required fields');
      return;
    }
    try {
      setSubmitting(true);
      await FeeService.createStructure({
        class_id: selectedClassId,
        amount: Number(amount),
        fee_type_id: feeTypeId,
        due_date: dueDate,
        academic_year_id: selectedYearId,
      });
      alertCompat('Success', 'Class fee structure saved successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      alertCompat('Error', error.result?.error || error.message || 'Failed to save fee structure');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <AdminHeader title="Set Class Fee" showBackButton />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Fee Details</Text>

          {/* ── Class Selector ── */}
          <Text style={styles.label}>Select Class</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {classes.map((cls) => (
              <TouchableOpacity
                key={cls.id}
                style={[styles.chip, selectedClassId === cls.id && styles.chipActive]}
                onPress={() => setSelectedClassId(cls.id)}
              >
                <Text style={[styles.chipText, selectedClassId === cls.id && styles.chipTextActive]}>
                  {cls.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Fee Type Selector ── */}
          <Text style={styles.label}>Fee Type</Text>
          <View style={styles.typeGrid}>
            {feeTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[styles.typeChip, feeTypeId === type.id && styles.typeChipActive]}
                onPress={() => setFeeTypeId(type.id)}
              >
                <Text style={[styles.typeChipText, feeTypeId === type.id && styles.typeChipTextActive]}>
                  {type.name}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addTypeChip} onPress={() => setShowAddType(true)}>
              <Ionicons name="add" size={14} color={ADMIN_THEME.colors.primary} />
              <Text style={styles.addTypeChipText}>Add Type</Text>
            </TouchableOpacity>
          </View>

          {/* ── Add Fee Type Modal ── */}
          <Modal transparent visible={showAddType} onRequestClose={() => setShowAddType(false)} animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>New Fee Type</Text>
                  <TouchableOpacity onPress={() => { setShowAddType(false); setNewTypeName(''); setNewTypeNameTe(''); }} style={styles.modalClose}>
                    <Ionicons name="close" size={18} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalHint}>e.g. Tuition Fee, Lab Fee, Transport, Exam Fee</Text>
                <AppTextInput
                  style={styles.modalInput}
                  value={newTypeName}
                  onChangeText={setNewTypeName}
                  placeholder="Enter fee type name"
                  placeholderTextColor="#94A3B8"
                  autoFocus
                />
                <AppTextInput
                  style={styles.modalInput}
                  value={newTypeNameTe}
                  onChangeText={setNewTypeNameTe}
                  placeholder="Telugu Name (optional)"
                  placeholderTextColor="#94A3B8"
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowAddType(false); setNewTypeName(''); setNewTypeNameTe(''); }}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSaveBtn, !newTypeName.trim() && { opacity: 0.5 }]}
                    onPress={handleAddFeeType}
                    disabled={addingType || !newTypeName.trim()}
                  >
                    {addingType ? (
                      <LogoLoader color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="add-circle-outline" size={16} color="#fff" />
                        <Text style={styles.modalSaveText}>Create</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* ── Amount Input ── */}
          <Text style={styles.label}>Amount (₹)</Text>
          <AppTextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="Enter amount"
            keyboardType="numeric"
            placeholderTextColor="#94A3B8"
          />

          {/* ── Due Date ── */}
          <Text style={styles.label}>Due Date (YYYY-MM-DD)</Text>
          <AppTextInput
            style={styles.input}
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
          />

          {/* ── Academic Year ── */}
          <Text style={styles.label}>Academic Year</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {academicYears.map((ay) => (
              <TouchableOpacity
                key={ay.id}
                style={[styles.chip, selectedYearId === ay.id && styles.chipActive]}
                onPress={() => setSelectedYearId(ay.id)}
              >
                <Text style={[styles.chipText, selectedYearId === ay.id && styles.chipTextActive]}>
                  {ay.code}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Submit ── */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
            {submitting ? <LogoLoader color="#fff" /> : <Text style={styles.submitBtnText}>Save Fee Structure</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const getStyles = (theme: Theme, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0F172A' : '#F4F6FB',
    },
    content: {
      padding: 20,
    },
    card: {
      backgroundColor: isDark ? '#1E293B' : '#fff',
      borderRadius: 16,
      padding: 20,
      ...Platform.select({
        ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
        android: { elevation: 3 },
      }),
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#1E293B',
      marginBottom: 20,
      letterSpacing: -0.3,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? '#94A3B8' : '#475569',
      marginBottom: 8,
      marginTop: 16,
    },
    input: {
      backgroundColor: isDark ? '#334155' : '#F8FAFC',
      borderWidth: 1,
      borderColor: isDark ? '#475569' : '#E2E8F0',
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: isDark ? '#F1F5F9' : '#1E293B',
    },

    // Chips (Class, Year)
    chipScroll: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: isDark ? '#334155' : '#F1F5F9',
      marginRight: 8,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    chipActive: {
      backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF',
      borderColor: ADMIN_THEME.colors.primary,
    },
    chipText: {
      fontSize: 13,
      color: isDark ? '#94A3B8' : '#64748B',
      fontWeight: '600',
    },
    chipTextActive: {
      color: ADMIN_THEME.colors.primary,
      fontWeight: '700',
    },

    // Fee Type Chips
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    typeChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: isDark ? '#334155' : '#F8FAFC',
      borderWidth: 1.5,
      borderColor: isDark ? '#475569' : '#E2E8F0',
    },
    typeChipActive: {
      backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#EEF2FF',
      borderColor: ADMIN_THEME.colors.primary,
    },
    typeChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: isDark ? '#94A3B8' : '#64748B',
    },
    typeChipTextActive: {
      color: ADMIN_THEME.colors.primary,
      fontWeight: '700',
    },
    addTypeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: ADMIN_THEME.colors.primary,
      borderStyle: 'dashed',
      backgroundColor: isDark ? 'rgba(99,102,241,0.08)' : '#F5F3FF',
    },
    addTypeChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: ADMIN_THEME.colors.primary,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(10,14,30,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCard: {
      width: '85%',
      backgroundColor: isDark ? '#1E293B' : '#fff',
      borderRadius: 20,
      padding: 22,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: isDark ? '#F1F5F9' : '#1E293B',
      letterSpacing: -0.3,
    },
    modalClose: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: isDark ? '#334155' : '#F1F5F9',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalHint: {
      fontSize: 12,
      color: '#94A3B8',
      marginBottom: 14,
    },
    modalInput: {
      borderWidth: 1,
      borderColor: isDark ? '#475569' : '#E2E8F0',
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      color: isDark ? '#F1F5F9' : '#1E293B',
      backgroundColor: isDark ? '#334155' : '#F8FAFC',
      marginBottom: 16,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 8,
    },
    modalCancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingVertical: 12,
      backgroundColor: isDark ? '#334155' : '#F1F5F9',
      borderWidth: 1,
      borderColor: isDark ? '#475569' : '#E2E8F0',
    },
    modalCancelText: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#94A3B8' : '#64748B',
    },
    modalSaveBtn: {
      flex: 1.5,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: ADMIN_THEME.colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
    },
    modalSaveText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#fff',
    },

    // Submit
    submitBtn: {
      backgroundColor: ADMIN_THEME.colors.primary,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 26,
    },
    submitBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });