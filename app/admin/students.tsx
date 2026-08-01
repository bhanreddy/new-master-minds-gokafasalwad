import React, { useState, useEffect } from 'react';
import AppTextInput from '@/src/components/AppTextInput';
import { styles as ds } from '@/src/theme/styles';

import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Platform, ScrollView, Modal, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';
import AdminHeader from '../../src/components/AdminHeader';
import Animated, { FadeInUp, useSharedValue, useAnimatedScrollHandler } from 'react-native-reanimated';
import { StudentService } from '../../src/services/studentService';
import { ClassService, ClassInfo, Section } from '../../src/services/classService';
import { useLocalSearchParams, useRouter } from 'expo-router';
import LogoLoader from '../../src/components/LogoLoader';
import { exportStudentCsv } from '../../src/utils/studentExport';
import { SCHOOL_NAME } from '../../src/constants/school';
import HardDeleteStudentModal from '../../src/components/accounts/HardDeleteStudentModal';
import { alertCompat } from '../../src/utils/crossPlatformAlert';

export default function AdminStudentsScreen() {
  const { theme, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(theme), [theme]);
  const { t } = useTranslation();
  const router = useRouter();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const isArchive = view === 'archive';

  // List & Pagination State
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 });

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'roll_number' | 'admission_no'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Reference Data
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [statuses, setStatuses] = useState<{ id: number; name: string; code: string; }[]>([]);

  // UI State
  const [filterModal, setFilterModal] = useState<{ visible: boolean; type: 'class' | 'section' | 'status' | 'sort' | null; }>({
    visible: false,
    type: null
  });

  // Export State
  const [exportModal, setExportModal] = useState(false);
  const [exportClass, setExportClass] = useState<string | null>(null);
  const [exportSection, setExportSection] = useState<string | null>(null);
  const [exportPicker, setExportPicker] = useState<'class' | 'section' | null>(null);
  const [exporting, setExporting] = useState(false);

  // Permanent-delete State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; subtitle: string } | null>(null);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    }
  });

  // Initial load: Reference data
  useEffect(() => {
    const loadRefs = async () => {
      try {
        const [cls, sec, sts] = await Promise.all([
          ClassService.getClasses(),
          ClassService.getSections(),
          StudentService.getStatuses()]
        );
        setClasses(cls);
        setSections(sec);
        setStatuses(sts);
      } catch (err) {

      }
    };
    loadRefs();
  }, []);

  // Main data fetching
  const fetchStudents = async (isRefreshing = false) => {
    try {
      if (!isRefreshing) setLoading(true);

      const params = {
        page,
        limit: 15,
        search: searchQuery || undefined,
        class_id: selectedClass || undefined,
        section_id: selectedSection || undefined,
        status_id: selectedStatus || undefined,
        lifecycle: selectedStatus ? undefined : (isArchive ? 'archived' as const : 'active' as const),
        sort_by: sortBy,
        sort_order: sortOrder
      };

      const response = await StudentService.getAll(params);
      setStudents(response.data || []);
      if (response.meta) {
        setPagination({
          total: response.meta.total,
          total_pages: response.meta.total_pages
        });
      }
    } catch (error) {

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Effect for filtering/pagination
  useEffect(() => {
    fetchStudents();
  }, [page, selectedClass, selectedSection, selectedStatus, sortBy, sortOrder, isArchive]);

  useEffect(() => {
    setSelectedStatus(null);
    setPage(1);
  }, [isArchive]);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) fetchStudents(); else
        setPage(1); // Setting page 1 will trigger fetch
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents(true);
  };

  const handleOpenFilter = (type: 'class' | 'section' | 'status' | 'sort') => {
    setFilterModal({ visible: true, type });
  };

  const handleSelectFilter = (value: any) => {
    if (filterModal.type === 'class') {
      setSelectedClass(value === selectedClass ? null : value);
    } else if (filterModal.type === 'section') {
      setSelectedSection(value === selectedSection ? null : value);
    } else if (filterModal.type === 'status') {
      setSelectedStatus(value === selectedStatus ? null : value);
    } else if (filterModal.type === 'sort') {
      if (sortBy === value) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(value);
        setSortOrder('asc');
      }
    }
    setPage(1);
    setFilterModal({ visible: false, type: null });
  };

  const openExportModal = () => {
    // Seed the export dialog with any filters already applied on the list.
    setExportClass(selectedClass);
    setExportSection(selectedSection);
    setExportModal(true);
  };

  const handleExport = async () => {
    if (exporting) return;
    try {
      setExporting(true);

      const rows = await StudentService.getAllPages<any>({
        search: searchQuery || undefined,
        class_id: exportClass || undefined,
        section_id: exportSection || undefined,
        status_id: selectedStatus || undefined,
        lifecycle: selectedStatus ? undefined : (isArchive ? 'archived' : 'active'),
        sort_by: sortBy,
        sort_order: sortOrder
      });

      if (!rows || rows.length === 0) {
        Alert.alert('No students', 'No students match the selected filters.');
        return;
      }

      const classLabel = exportClass ? classes.find((c) => c.id === exportClass)?.name : null;
      const sectionLabel = exportSection ? sections.find((s) => s.id === exportSection)?.name : null;
      const filterNote = [
        classLabel ? `Class ${classLabel}` : null,
        sectionLabel ? `Section ${sectionLabel}` : null].
        filter(Boolean).join(' · ') || 'All classes';

      const fileName = await exportStudentCsv(rows, {
        schoolName: SCHOOL_NAME,
        filterNote,
        dateIso: new Date().toISOString().slice(0, 10)
      });

      setExportModal(false);
      if (Platform.OS !== 'web') {
        Alert.alert('Export ready', `Exported ${rows.length} students to ${fileName}.`);
      }
    } catch (err: any) {
      Alert.alert('Export failed', err?.message || 'Could not export students. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = (item: any) => {
    const name = item.display_name || [item.first_name, item.last_name].filter(Boolean).join(' ') || 'Student';
    const e = item.current_enrollment || {};
    const subtitle = [
      e.class_name || e.class_code,
      e.section_name,
      e.roll_number ? `Roll ${e.roll_number}` : null].
      filter(Boolean).join(' · ');
    setDeleteTarget({ id: item.id, name, subtitle });
  };

  const renderItem = ({ item, index }: any) => {
    const fullName = item.display_name || [item.first_name, item.last_name].filter(Boolean).join(' ');
    const enrollment = item.current_enrollment || {};
    const isActive = item.status === 'active' || item.status_id === 1;
    const statusLabel = item.status === 'graduated'
      ? 'Passed Out'
      : item.status === 'withdrawn'
        ? 'Withdrawn'
        : item.status?.charAt(0).toUpperCase() + item.status?.slice(1) || 'Unknown';

    return (
      <Animated.View entering={FadeInUp.delay(index * 50).springify().damping(12)} style={styles.card}>
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => router.push({ pathname: '/admin/addStudent', params: { id: item.id } })}>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.first_name?.charAt(0) || '?'}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{fullName}</Text>
            <Text style={styles.details}>
              {enrollment.class_name || enrollment.class_code || 'N/A'} - {enrollment.section_name || 'N/A'}
              {enrollment.roll_number ? ` • Roll ${enrollment.roll_number}` : ''}
            </Text>
            <Text style={styles.subDetails}>
              {item.admission_no}
              {(isArchive ? item.exit_academic_year : enrollment.academic_year)
                ? ` • ${isArchive ? item.exit_academic_year : enrollment.academic_year}`
                : ''}
            </Text>
          </View>
          <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusInactive]}>
            <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextInactive]}>
              {statusLabel}
            </Text>
          </View>
          {!isArchive ? (
            <TouchableOpacity
              style={styles.deleteBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => handleDelete(item)}>

              <Ionicons name="trash-outline" size={20} color="#DC2626" />
            </TouchableOpacity>
          ) : (
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} style={{ marginLeft: 10 }} />
          )}
        </TouchableOpacity>
      </Animated.View>);

  };

  const currentFilterLabel = () => {
    if (filterModal.type === 'class') return 'Class';
    if (filterModal.type === 'section') return 'Section';
    if (filterModal.type === 'status') return 'Status';
    if (filterModal.type === 'sort') return 'Sort By';
    return '';
  };

  const currentFilterOptions = (): any[] => {
    if (filterModal.type === 'class') return [{ id: null, name: 'All Classes' }, ...classes];
    if (filterModal.type === 'section') return [{ id: null, name: 'All Sections' }, ...sections];
    if (filterModal.type === 'status') {
      const availableStatuses = isArchive
        ? statuses.filter((status) => status.code === 'graduated' || status.code === 'withdrawn')
        : statuses.filter((status) => status.code === 'active');
      return [{ id: null, name: isArchive ? 'Passed Out & Withdrawn' : 'Active Students' }, ...availableStatuses];
    }
    if (filterModal.type === 'sort') return [
      { id: 'name', name: 'Name' },
      { id: 'roll_number', name: 'Roll Number' },
      { id: 'admission_no', name: 'Admission No' }];

    return [];
  };

  const getSelectedValue = () => {
    if (filterModal.type === 'class') return selectedClass;
    if (filterModal.type === 'section') return selectedSection;
    if (filterModal.type === 'status') return selectedStatus;
    if (filterModal.type === 'sort') return sortBy;
    return null;
  };

  const selectedClassName = selectedClass
    ? classes.find((c) => c.id === selectedClass)?.name
    : null;
  const selectedSectionName = selectedSection
    ? sections.find((s) => s.id === selectedSection)?.name
    : null;
  const showClassCountCard = Boolean(selectedClass && selectedSection);

  return (
    <View style={styles.container}>
      <AdminHeader
        title={isArchive ? 'Student Archive' : 'Students'}
        showNotification={!isArchive}
        showBackButton={isArchive}
        scrollY={scrollY}
      />
      <View style={styles.headerArea}>
        <TouchableOpacity
          style={[styles.archiveCard, isArchive && styles.activeRosterCard]}
          activeOpacity={0.85}
          onPress={() => {
            if (isArchive) router.replace('/admin/students');
            else router.push({ pathname: '/admin/students', params: { view: 'archive' } });
          }}>
          <View style={[styles.archiveIcon, isArchive && styles.activeRosterIcon]}>
            <Ionicons name={isArchive ? 'people-outline' : 'archive-outline'} size={23} color={isArchive ? '#2563EB' : '#9A3412'} />
          </View>
          <View style={styles.archiveInfo}>
            <Text style={styles.archiveTitle}>{isArchive ? 'Back to Active Students' : 'Passed Out & Withdrawn'}</Text>
            <Text style={styles.archiveSubtitle}>
              {isArchive
                ? 'Return to the current student roster'
                : 'View retained student records and their exit academic year'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
        <View style={[styles.searchBox, ds.searchBarWrapper]}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
          <AppTextInput
            style={[ds.inputInChrome, styles.searchInput]}
            placeholder={isArchive ? 'Search archived students...' : 'Search by name or admission no...'}
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery} />

          {searchQuery ?
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity> :
            null}
        </View>
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterChip, selectedClass && styles.filterChipActive]}
              onPress={() => handleOpenFilter('class')}>

              <Text style={[styles.filterChipText, selectedClass && styles.filterChipTextActive]}>
                {selectedClass ? classes.find((c) => c.id === selectedClass)?.name : 'Class'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={selectedClass ? theme.colors.primary : theme.colors.textSecondary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, selectedSection && styles.filterChipActive]}
              onPress={() => handleOpenFilter('section')}>

              <Text style={[styles.filterChipText, selectedSection && styles.filterChipTextActive]}>
                {selectedSection ? sections.find((s) => s.id === selectedSection)?.name : 'Section'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={selectedSection ? theme.colors.primary : theme.colors.textSecondary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            {isArchive && <TouchableOpacity
              style={[styles.filterChip, selectedStatus && styles.filterChipActive]}
              onPress={() => handleOpenFilter('status')}>

              <Text style={[styles.filterChipText, selectedStatus && styles.filterChipTextActive]}>
                {selectedStatus ? statuses.find((s) => String(s.id) === String(selectedStatus))?.name : 'Status'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={selectedStatus ? theme.colors.primary : theme.colors.textSecondary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>}
            <TouchableOpacity
              style={[styles.filterChip, sortBy !== 'name' && styles.filterChipActive]}
              onPress={() => handleOpenFilter('sort')}>

              <Ionicons name="swap-vertical" size={14} color={sortBy !== 'name' ? theme.colors.primary : theme.colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={[styles.filterChipText, sortBy !== 'name' && styles.filterChipTextActive]}>
                {sortBy === 'name' ? 'Sort' : currentFilterOptions().find((o) => o.id === sortBy)?.name}
              </Text>
              <Ionicons name={sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'} size={14} color={sortBy !== 'name' ? theme.colors.primary : theme.colors.textSecondary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, styles.exportChip]}
              onPress={openExportModal}>

              <Ionicons name="download-outline" size={15} color={theme.colors.primary} style={{ marginRight: 5 }} />
              <Text style={[styles.filterChipText, styles.filterChipTextActive]}>Export</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
        {showClassCountCard ? (
          <Animated.View entering={FadeInUp.springify().damping(14)} style={styles.countCardWrap}>
            <LinearGradient
              colors={['#4F46E5', '#6366F1', '#7C3AED']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.countCard}
            >
              <View style={styles.countOrbLg} />
              <View style={styles.countOrbSm} />

              <View style={styles.countHero}>
                <View style={styles.countIconRing}>
                  <Ionicons name="people" size={18} color="#fff" />
                </View>
                {loading && !refreshing ? (
                  <ActivityIndicator size="small" color="#fff" style={{ marginLeft: 12 }} />
                ) : (
                  <View style={styles.countValueBlock}>
                    <Text style={styles.countNumber}>{pagination.total}</Text>
                    <Text style={styles.countUnit}>
                      {pagination.total === 1 ? 'Student' : 'Students'}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.countDivider} />

              <View style={styles.countMeta}>
                <Text style={styles.countEyebrow}>
                  {isArchive ? 'ARCHIVE ROSTER' : 'CLASS STRENGTH'}
                </Text>
                <Text style={styles.countTitle} numberOfLines={1}>
                  {selectedClassName} — Section {selectedSectionName}
                </Text>
                <Text style={styles.countSubtitle} numberOfLines={1}>
                  {isArchive
                    ? 'Passed out & withdrawn in this section'
                    : 'Currently enrolled in this section'}
                </Text>
              </View>
            </LinearGradient>
          </Animated.View>
        ) : null}
      </View>
      {loading && !refreshing ?
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <LogoLoader size={60} color={theme.colors.primary} />
          <Text style={{ marginTop: 12, color: theme.colors.textSecondary }}>Fetching students...</Text>
        </View> :

        <Animated.FlatList
          onScroll={onScroll}
          scrollEventThrottle={16}
          data={students}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Ionicons name="people-outline" size={60} color={theme.colors.border} />
              <Text style={{ marginTop: 12, color: theme.colors.textSecondary }}>
                {isArchive ? 'No passed-out or withdrawn students found.' : 'No active students found matching your criteria.'}
              </Text>
            </View>
          }
          ListFooterComponent={students.length > 0 ? () =>
            <View style={styles.pagination}>
              <TouchableOpacity
                disabled={page === 1}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                style={[styles.pageButton, page === 1 && { opacity: 0.5 }]}>

                <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={styles.pageInfo}>{page} of {pagination.total_pages || 1}</Text>
              <TouchableOpacity
                disabled={page >= pagination.total_pages}
                onPress={() => setPage((p) => p + 1)}
                style={[styles.pageButton, page >= pagination.total_pages && { opacity: 0.5 }]}>

                <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View> :
            null} />

      }
      {/* Filter Modal */}
      <Modal
        visible={filterModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModal({ visible: false, type: null })}>

        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModal({ visible: false, type: null })}>

          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select {currentFilterLabel()}</Text>
              <TouchableOpacity onPress={() => setFilterModal({ visible: false, type: null })}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={currentFilterOptions()}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) =>
                <TouchableOpacity
                  style={[
                    styles.optionItem,
                    String(getSelectedValue()) === String(item.id) && styles.optionItemSelected]
                  }
                  onPress={() => handleSelectFilter(item.id)}>

                  <Text style={[
                    styles.optionText,
                    String(getSelectedValue()) === String(item.id) && styles.optionTextSelected]
                  }>
                    {item.name}
                  </Text>
                  {String(getSelectedValue()) === String(item.id) &&
                    <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                  }
                </TouchableOpacity>
              } />

          </View>
        </TouchableOpacity>
      </Modal>
      {/* Export Modal */}
      <Modal
        visible={exportModal}
        transparent
        animationType="fade"
        onRequestClose={() => !exporting && setExportModal(false)}>

        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => !exporting && setExportModal(false)}>

          <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Export to Excel</Text>
              <TouchableOpacity onPress={() => !exporting && setExportModal(false)}>
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.exportHint}>
              Choose a class and section to filter, or leave as “All” to export every student.
            </Text>

            <Text style={styles.exportLabel}>Class</Text>
            <TouchableOpacity
              style={styles.exportSelect}
              onPress={() => setExportPicker(exportPicker === 'class' ? null : 'class')}>

              <Text style={styles.exportSelectText}>
                {exportClass ? classes.find((c) => c.id === exportClass)?.name : 'All Classes'}
              </Text>
              <Ionicons name={exportPicker === 'class' ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            {exportPicker === 'class' &&
              <View style={styles.exportDropdown}>
                <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                  {[{ id: null, name: 'All Classes' }, ...classes].map((c) =>
                    <TouchableOpacity
                      key={String(c.id)}
                      style={styles.exportOption}
                      onPress={() => {
                        setExportClass(c.id as string | null);
                        setExportPicker(null);
                      }}>

                      <Text style={[styles.optionText, String(exportClass) === String(c.id) && styles.optionTextSelected]}>{c.name}</Text>
                      {String(exportClass) === String(c.id) &&
                        <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
                      }
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            }

            <Text style={styles.exportLabel}>Section</Text>
            <TouchableOpacity
              style={styles.exportSelect}
              onPress={() => setExportPicker(exportPicker === 'section' ? null : 'section')}>

              <Text style={styles.exportSelectText}>
                {exportSection ? sections.find((s) => s.id === exportSection)?.name : 'All Sections'}
              </Text>
              <Ionicons name={exportPicker === 'section' ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            {exportPicker === 'section' &&
              <View style={styles.exportDropdown}>
                <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                  {[{ id: null, name: 'All Sections' }, ...sections].map((s) =>
                    <TouchableOpacity
                      key={String(s.id)}
                      style={styles.exportOption}
                      onPress={() => {
                        setExportSection(s.id as string | null);
                        setExportPicker(null);
                      }}>

                      <Text style={[styles.optionText, String(exportSection) === String(s.id) && styles.optionTextSelected]}>{s.name}</Text>
                      {String(exportSection) === String(s.id) &&
                        <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
                      }
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            }

            <TouchableOpacity
              style={[styles.exportButton, exporting && { opacity: 0.7 }]}
              onPress={handleExport}
              disabled={exporting}>

              {exporting ?
                <ActivityIndicator color="#fff" /> :
                <>
                  <Ionicons name="download-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.exportButtonText}>Download Excel</Text>
                </>
              }
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      {/* Permanent Delete Modal (same 3-step flow as the accounts dept) */}
      <HardDeleteStudentModal
        visible={!!deleteTarget}
        studentId={deleteTarget?.id ?? null}
        studentName={deleteTarget?.name ?? ''}
        studentSubtitle={deleteTarget?.subtitle}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          const nm = deleteTarget?.name;
          setDeleteTarget(null);
          fetchStudents();
          alertCompat('Deleted', `${nm ?? 'Student'} and all associated data were permanently deleted.`);
        }} />

      {!isArchive && <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/admin/addStudent')}>

        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>}
    </View>);

}

const getStyles = (theme: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  headerArea: {
    paddingHorizontal: 20,
    paddingTop: 110,
    paddingBottom: 10
  },
  archiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 14,
    marginBottom: 14
  },
  activeRosterCard: {
    borderColor: '#BFDBFE'
  },
  archiveIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    marginRight: 12
  },
  activeRosterIcon: {
    backgroundColor: '#EFF6FF'
  },
  archiveInfo: {
    flex: 1
  },
  archiveTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3
  },
  archiveSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: theme.colors.text,
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto'
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 8
  },
  countCardWrap: {
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.22,
        shadowRadius: 14
      },
      android: {
        elevation: 5
      }
    })
  },
  countCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 16,
    overflow: 'hidden'
  },
  countOrbLg: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.1)',
    top: -34,
    right: -18
  },
  countOrbSm: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.07)',
    bottom: -22,
    left: 72
  },
  countHero: {
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1
  },
  countIconRing: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  countValueBlock: {
    marginLeft: 10
  },
  countNumber: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 34,
    letterSpacing: -0.8
  },
  countUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1
  },
  countDivider: {
    width: 1,
    height: 42,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginHorizontal: 14,
    zIndex: 1
  },
  countMeta: {
    flex: 1,
    zIndex: 1,
    minWidth: 0
  },
  countEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.8,
    marginBottom: 3
  },
  countTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2
  },
  countSubtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500'
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  filterChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10'
  },
  filterChipText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  filterChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '600'
  },
  exportChip: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary + '10'
  },
  exportHint: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18
  },
  exportLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
    marginTop: 4
  },
  exportSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12
  },
  exportSelectText: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '500'
  },
  exportDropdown: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    marginTop: -6,
    marginBottom: 12,
    backgroundColor: theme.colors.background,
    overflow: 'hidden'
  },
  exportOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 8
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10
      },
      android: {
        elevation: 3
      }
    }),
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.primary
  },
  info: {
    flex: 1
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2
  },
  details: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 2
  },
  subDetails: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    opacity: 0.7
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10
  },
  deleteBtn: {
    marginLeft: 10,
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#FEF2F2'
  },
  statusActive: {
    backgroundColor: '#ECFDF5'
  },
  statusInactive: {
    backgroundColor: '#FEF2F2'
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700'
  },
  statusTextActive: {
    color: '#059669'
  },
  statusTextInactive: {
    color: '#DC2626'
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    paddingBottom: 20
  },
  pageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center'
  },
  pageInfo: {
    marginHorizontal: 20,
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'center'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: 20,
    width: '100%',
    maxHeight: '70%',
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20
      },
      android: {
        elevation: 10
      }
    })
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12
  },
  optionItemSelected: {
    backgroundColor: theme.colors.primary + '10'
  },
  optionText: {
    fontSize: 16,
    color: theme.colors.textSecondary
  },
  optionTextSelected: {
    color: theme.colors.primary,
    fontWeight: '600'
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 25,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8
  }
});
