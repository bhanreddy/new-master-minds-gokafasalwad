import React, { useState, useEffect } from 'react';
import AppTextInput from '@/src/components/AppTextInput';

import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Modal, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { alertCompat } from '../../src/utils/crossPlatformAlert';
import { Ionicons } from '@expo/vector-icons';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ComplaintService, Complaint } from '../../src/services/commonServices';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import LogoLoader from '../../src/components/LogoLoader';
import { StudentService } from '../../src/services/studentService';
import { Student } from '../../src/types/models';
import { useTranslation } from 'react-i18next';
import { t_field } from '../../src/utils/lang';
export default function AdminComplaints() {
  useTranslation(); // Subscribe so list rows re-render when language changes (t_field).
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'OPEN' | 'IN PROGRESS' | 'CLOSED'>('ALL');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [newComplaint, setNewComplaint] = useState({
    title: '',
    description: '',
    category: 'Facility',
    priority: 'medium',
    raised_for_student_id: ''
  });
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    fetchComplaints();
  }, []);
  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const data = await ComplaintService.getAll();
      setComplaints(data);
    } catch (error) {

      alertCompat('Error', 'Failed to load complaints');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateComplaint = async () => {
    if (!newComplaint.title || !newComplaint.description) {
      alertCompat('Error', 'Please fill in required fields');
      return;
    }
    try {
      setIsSubmitting(true);
      await ComplaintService.create({
        title: newComplaint.title,
        description: newComplaint.description,
        category: newComplaint.category.toLowerCase(),
        priority: newComplaint.priority.toLowerCase(),
        raised_for_student_id: newComplaint.raised_for_student_id || undefined
      });
      alertCompat('Success', 'Complaint created successfully');
      setModalVisible(false);
      setNewComplaint({ title: '', description: '', category: 'Facility', priority: 'medium', raised_for_student_id: '' });
      setStudentSearch('');
      setSearchResults([]);
      fetchComplaints();
    } catch (error) {
      alertCompat('Error', 'Failed to create complaint');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudentSearch = async (text: string) => {
    setStudentSearch(text);
    if (text.length > 2) {
      setIsSearching(true);
      try {
        const results = await StudentService.search(text);
        setSearchResults(results);
      } catch (error) {
        console.error(error);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSearchResults([]);
      setNewComplaint((prev) => ({ ...prev, raised_for_student_id: '' }));
    }
  };
  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'resolved':
        return {
          bg: '#D1FAE5',
          text: '#065F46'
        };
      case 'escalated':
        return {
          bg: '#FEE2E2',
          text: '#991B1B'
        };
      case 'closed':
        return {
          bg: '#F3F4F6',
          text: '#374151'
        };
      default:
        return {
          bg: '#FEF3C7',
          text: '#92400E'
        };
      // Pending/Open
    }
  };
  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'disciplinary':
        return '#EF4444';
      case 'facility':
        return '#3B82F6';
      case 'academic':
        return '#8B5CF6';
      default:
        return '#6B7280';
    }
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  const filteredData = complaints.filter((item) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'IN PROGRESS') return item.status?.toLowerCase() === 'in progress';
    return (item.status || 'open').toUpperCase() === filterType;
  });
  const handleResolve = async (id: string) => {
    try {
      setLoading(true);
      await ComplaintService.update(id, { status: 'resolved' });
      alertCompat('Success', 'Complaint resolved successfully');
      fetchComplaints();
    } catch (error) {

      alertCompat('Error', 'Failed to resolve complaint');
      setLoading(false);
    }
  };

  const handleAssign = () => {
    // Placeholder for Assignment Modal/Logic
    alertCompat('Assign', 'Assignment functionality coming soon.');
  };

  const renderItem = ({
    item,
    index

  }: { item: Complaint; index: number; }) => {
    const category = item.category || 'General';
    const statusStyle = getStatusStyle(item.status);
    const color = getCategoryColor(category);
    return <Animated.View entering={FadeInDown.delay(index * 100).duration(500)}>
      <View style={styles.card}>
        <View style={[styles.accentBar, {
          backgroundColor: color
        }]} />

        <View style={styles.headerRow}>
          <View style={styles.typeBadge}>
            <Ionicons name={category.toLowerCase() === 'disciplinary' ? 'person-circle-outline' : 'business-outline'} size={14} color="#6B7280" />
            <Text style={styles.category}>{category.toUpperCase()}</Text>
          </View>
          <View style={[styles.statusBadge, {
            backgroundColor: statusStyle.bg
          }]}>
            <Text style={[styles.statusText, {
              color: statusStyle.text
            }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.titleRow}>
          <View style={[styles.iconBox, {
            backgroundColor: `${color}15`
          }]}>
            <Ionicons name="alert-circle" size={20} color={color} />
          </View>
          <View style={{
            flex: 1
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.title}>{t_field(item.title, item.title_te)}</Text>
              {item.priority?.toLowerCase() === 'high' &&
                <View style={[styles.priorityBadge, { backgroundColor: '#FEF2F2' }]}>
                  <Text style={{ fontSize: 10, color: '#EF4444', fontWeight: 'bold' }}>HIGH</Text>
                </View>
              }
            </View>
            <Text style={styles.targetText}>Ticket: <Text style={{
              fontWeight: '700'
            }}>#{item.id?.substring(0, 6) || item.ticket_no}</Text></Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.metaInfo}>
            <Ionicons name="person-outline" size={12} color="#6B7280" />
            <Text style={styles.fromText}>Filed by: {item.raised_by_name || item.raised_by || 'Anonymous'}</Text>
          </View>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: '#10B981' }]} onPress={() => handleResolve(item.id)}>
            <Text style={[styles.actionBtnText, { color: '#10B981' }]}>Resolve</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { borderColor: '#3B82F6', marginLeft: 8 }]} onPress={() => handleAssign()}>
            <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>Assign</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>;
  };
  return <View style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#fff" />
    <AdminHeader title="Complaints Box" showBackButton={true} />

    <View style={styles.filterSection}>
      <View style={styles.tabContainer}>
        {['ALL', 'OPEN', 'IN PROGRESS', 'CLOSED'].map((type) => {
          return <TouchableOpacity key={type} style={[styles.tab, filterType === type && styles.activeTab]} onPress={() => setFilterType(type as any)}>
            <Text style={[styles.tabText, filterType === type && styles.activeTabText]}>
              {type}
            </Text>
          </TouchableOpacity>;
        })}
      </View>
    </View>

    {loading ? <View style={styles.centerContainer}>
      <LogoLoader size={60} color="#6366F1" />
    </View> : <FlatList data={filteredData} keyExtractor={(item) => item.id} renderItem={renderItem} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} ListHeaderComponent={() => {
      return <Text style={styles.listHeader}>Recent Reports ({filteredData.length})</Text>;
    }} ListEmptyComponent={<Text style={styles.emptyText}>No complaints found</Text>} refreshing={loading} onRefresh={fetchComplaints} />}
    
    <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
      <Ionicons name="add" size={24} color="#fff" />
    </TouchableOpacity>

    <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Complaint</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.inputLabel}>Title *</Text>
            <AppTextInput style={styles.input} placeholder="Brief summary" placeholderTextColor="#9CA3AF" value={newComplaint.title} onChangeText={(text) => setNewComplaint((prev) => ({ ...prev, title: text }))} />

            <Text style={styles.inputLabel}>Description *</Text>
            <AppTextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} placeholder="Detailed description" placeholderTextColor="#9CA3AF" multiline value={newComplaint.description} onChangeText={(text) => setNewComplaint((prev) => ({ ...prev, description: text }))} />

            <Text style={styles.inputLabel}>Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
              {['Facility', 'Disciplinary', 'Academic', 'General'].map(cat => (
                <TouchableOpacity key={cat} style={[styles.pill, newComplaint.category === cat && styles.activePill]} onPress={() => setNewComplaint((prev) => ({ ...prev, category: cat }))}>
                  <Text style={[styles.pillText, newComplaint.category === cat && styles.activePillText]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Priority</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
              {['low', 'medium', 'high'].map(prio => (
                <TouchableOpacity key={prio} style={[styles.pill, newComplaint.priority === prio && styles.activePill]} onPress={() => setNewComplaint((prev) => ({ ...prev, priority: prio }))}>
                  <Text style={[styles.pillText, newComplaint.priority === prio && styles.activePillText]}>{prio.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Related Student (Optional)</Text>
            <AppTextInput style={styles.input} placeholder="Search student name or admission no..." placeholderTextColor="#9CA3AF" value={studentSearch} onChangeText={handleStudentSearch} />
            {isSearching && <ActivityIndicator size="small" color="#6366F1" style={{ marginTop: 8 }} />}
            {searchResults.length > 0 && !newComplaint.raised_for_student_id && (
              <View style={styles.searchResults}>
                {searchResults.map((student) => (
                  <TouchableOpacity key={student.id} style={styles.searchItem} onPress={() => {
                    setNewComplaint((prev) => ({ ...prev, raised_for_student_id: student.id }));
                    setStudentSearch(`${student.first_name} ${student.last_name} (${student.admission_no})`);
                    setSearchResults([]);
                  }}>
                    <Text style={styles.searchItemText}>{student.first_name} {student.last_name}</Text>
                    <Text style={styles.searchItemSub}>{student.admission_no}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateComplaint} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Complaint</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}
const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  filterSection: {
    paddingVertical: 15,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 20
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 4
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 12
  },
  activeTab: {
    backgroundColor: theme.colors.background,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 1
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary
  },
  activeTabText: {
    color: '#111827',
    fontWeight: '700'
  },
  listContent: {
    padding: 20
  },
  listHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 15,
    letterSpacing: -0.5
  },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    overflow: 'hidden'
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingLeft: 10
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  category: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.5
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  titleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    paddingLeft: 10
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  targetText: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.card,
    paddingLeft: 10
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  fromText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  dateText: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    fontWeight: '500'
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: theme.colors.textTertiary,
    fontSize: 16
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    justifyContent: 'flex-end'
  },
  actionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700'
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary || '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary || '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937'
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 8,
    marginTop: 12
  },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  activePill: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1'
  },
  pillText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  activePillText: {
    color: '#6366F1',
    fontWeight: '700'
  },
  searchResults: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 150
  },
  searchItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  searchItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text
  },
  searchItemSub: {
    fontSize: 12,
    color: theme.colors.textSecondary
  },
  submitBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  }
});