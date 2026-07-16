import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import AdminHeader from '../../../src/components/AdminHeader';
import AppDatePicker, { toYMD } from '../../../src/components/AppDatePicker';
import AppTextInput from '../../../src/components/AppTextInput';
import LogoLoader from '../../../src/components/LogoLoader';
import { schoolColorWithAlpha } from '../../../src/constants/schoolConfig';
import { useTheme, type SchoolTheme } from '../../../src/hooks/useTheme';
import { api } from '../../../src/services/apiClient';
import { alertCompat } from '../../../src/utils/crossPlatformAlert';

type DiaryMode = 'class' | 'subject';

interface DiarySubject {
  id: string;
  name: string;
  name_te?: string;
}

interface DiaryClassOption {
  class_section_id: string;
  class_id: string;
  class_name: string;
  class_sort_order?: number;
  section_id: string;
  section_name: string;
  academic_year_id: string;
  academic_year: string;
  subjects: DiarySubject[];
}

interface DiaryEntry {
  id: string;
  class_section_id: string;
  class_id: string;
  class_name: string;
  section_id: string;
  section_name: string;
  entry_date: string;
  subject_id?: string | null;
  subject_name?: string | null;
  title?: string | null;
  title_te?: string | null;
  content: string;
  content_te?: string | null;
  homework_due_date?: string | null;
  created_by: string;
  created_at: string;
  updated_at?: string;
  teacher_name?: string | null;
}

function relativeLuminance(hex: string) {
  const normalized = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return 0;
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(colorA: string, colorB: string) {
  const lighter = Math.max(relativeLuminance(colorA), relativeLuminance(colorB));
  const darker = Math.min(relativeLuminance(colorA), relativeLuminance(colorB));
  return (lighter + 0.05) / (darker + 0.05);
}

function themeTextOn(background: string, theme: SchoolTheme) {
  const candidates = [theme.colors.surface, theme.colors.background, theme.colors.textStrong];
  return candidates.reduce((best, candidate) =>
    contrastRatio(background, candidate) > contrastRatio(background, best) ? candidate : best,
  );
}

function entryTitle(entry: DiaryEntry) {
  return entry.title || entry.title_te || (entry.subject_name ? `${entry.subject_name} diary` : 'Class diary');
}

export default function AdminDiaryViewerScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const today = useMemo(() => toYMD(new Date()), []);

  const pageBg = theme.colors.background;
  const cardBg = theme.colors.card;
  const cardBorder = theme.colors.border;
  const titleColor = theme.colors.textStrong;
  const subColor = theme.colors.textSecondary;
  const inputBg = theme.colors.navPill;
  const primary = theme.colors.primary;
  const onPrimary = themeTextOn(primary, theme);
  const primaryTint = schoolColorWithAlpha(primary, isDark ? 0.18 : 0.10);

  const [options, setOptions] = useState<DiaryClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedClassSectionId, setSelectedClassSectionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [formClassSectionId, setFormClassSectionId] = useState('');
  const [formMode, setFormMode] = useState<DiaryMode>('class');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formDueDate, setFormDueDate] = useState(today);
  const [saving, setSaving] = useState(false);

  const classes = useMemo(() => {
    const seen = new Set<string>();
    return options.filter((option) => {
      if (seen.has(option.class_id)) return false;
      seen.add(option.class_id);
      return true;
    });
  }, [options]);

  const filteredSections = useMemo(
    () => selectedClassId ? options.filter((option) => option.class_id === selectedClassId) : [],
    [options, selectedClassId],
  );

  const filteredSubjects = useMemo(() => {
    const relevantOptions = selectedClassSectionId
      ? options.filter((option) => option.class_section_id === selectedClassSectionId)
      : selectedClassId
        ? options.filter((option) => option.class_id === selectedClassId)
        : [];
    const subjects = new Map<string, DiarySubject>();
    relevantOptions.forEach((option) => {
      option.subjects.forEach((subject) => subjects.set(subject.id, subject));
    });
    return [...subjects.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [options, selectedClassId, selectedClassSectionId]);

  const selectedFormOption = useMemo(
    () => options.find((option) => option.class_section_id === formClassSectionId),
    [formClassSectionId, options],
  );

  const loadOptions = useCallback(async () => {
    try {
      const data = await api.get<DiaryClassOption[]>('/admin/diary/options');
      setOptions(Array.isArray(data) ? data : []);
    } catch (error: any) {
      alertCompat('Error', error.message || 'Failed to load class diary options');
    }
  }, []);

  const fetchEntries = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedClassSectionId) params.class_section_id = selectedClassSectionId;
      else if (selectedClassId) params.class_id = selectedClassId;
      if (selectedSubjectId) params.subject_id = selectedSubjectId;
      const data = await api.get<DiaryEntry[]>('/admin/diary/today', params);
      setEntries(Array.isArray(data) ? data : []);
    } catch (error: any) {
      alertCompat('Error', error.message || 'Failed to fetch diary entries');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedClassId, selectedClassSectionId, selectedSubjectId]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    setLoading(true);
    fetchEntries();
  }, [fetchEntries]);

  const onRefresh = () => {
    setRefreshing(true);
    Promise.all([loadOptions(), fetchEntries()]);
  };

  const resetComposer = () => {
    setEditingEntry(null);
    setFormClassSectionId('');
    setFormMode('class');
    setFormSubjectId('');
    setFormTitle('');
    setFormContent('');
    setFormDueDate(today);
  };

  const closeComposer = () => {
    if (saving) return;
    setComposerOpen(false);
    resetComposer();
  };

  const openCreate = () => {
    const preferred =
      options.find(
        (option) =>
          option.class_section_id === selectedClassSectionId &&
          (!selectedSubjectId || option.subjects.some((subject) => subject.id === selectedSubjectId)),
      ) ||
      options.find(
        (option) =>
          option.class_id === selectedClassId &&
          (!selectedSubjectId || option.subjects.some((subject) => subject.id === selectedSubjectId)),
      ) ||
      options[0];
    resetComposer();
    setFormClassSectionId(preferred?.class_section_id || '');
    if (selectedSubjectId) {
      setFormMode('subject');
      setFormSubjectId(selectedSubjectId);
    }
    setComposerOpen(true);
  };

  const openEdit = (entry: DiaryEntry) => {
    setEditingEntry(entry);
    setFormClassSectionId(entry.class_section_id);
    setFormMode(entry.subject_id ? 'subject' : 'class');
    setFormSubjectId(entry.subject_id || '');
    setFormTitle(entry.title || entry.title_te || '');
    setFormContent(entry.content || entry.content_te || '');
    setFormDueDate(entry.homework_due_date || entry.entry_date);
    setComposerOpen(true);
  };

  const chooseFormClass = (classSectionId: string) => {
    if (editingEntry) return;
    setFormClassSectionId(classSectionId);
    setFormSubjectId('');
  };

  const chooseMode = (mode: DiaryMode) => {
    setFormMode(mode);
    if (mode === 'class') setFormSubjectId('');
  };

  const saveDiary = async () => {
    if (!formClassSectionId) {
      alertCompat('Class required', 'Select a class and section.');
      return;
    }
    if (formMode === 'subject' && !formSubjectId) {
      alertCompat('Subject required', 'Select a subject for this diary entry.');
      return;
    }
    if (!formContent.trim()) {
      alertCompat('Details required', 'Enter the diary details or homework.');
      return;
    }

    const subject = selectedFormOption?.subjects.find((item) => item.id === formSubjectId);
    const payload = {
      class_section_id: formClassSectionId,
      entry_date: editingEntry?.entry_date || today,
      subject_id: formMode === 'subject' ? formSubjectId : null,
      title: formTitle.trim() || (formMode === 'subject' ? `${subject?.name || 'Subject'} diary` : 'Class diary'),
      content: formContent.trim(),
      homework_due_date: formDueDate || null,
      input_language: 'en' as const,
    };

    try {
      setSaving(true);
      if (editingEntry) {
        await api.put(`/diary/${editingEntry.id}`, payload);
      } else {
        await api.post('/diary', payload);
      }
      setComposerOpen(false);
      resetComposer();
      await fetchEntries();
      alertCompat('Success', editingEntry ? 'Diary entry updated.' : 'Diary entry added.');
    } catch (error: any) {
      alertCompat('Could not save diary', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <AdminHeader
        title="Class Diary"
        showBackButton
        rightAction={{ icon: 'calendar-outline', onPress: () => router.push('/admin/diary/history') }}
      />

      <View style={[styles.filterContainer, { borderBottomColor: cardBorder }]}>
        <FilterRow label="CLASS" subColor={subColor}>
          <FilterChip
            label="All"
            selected={!selectedClassId}
            theme={theme}
            onPress={() => {
              setSelectedClassId('');
              setSelectedClassSectionId('');
              setSelectedSubjectId('');
            }}
          />
          {classes.map((item) => (
            <FilterChip
              key={item.class_id}
              label={item.class_name}
              selected={selectedClassId === item.class_id}
              theme={theme}
              onPress={() => {
                setSelectedClassId(item.class_id);
                setSelectedClassSectionId('');
                setSelectedSubjectId('');
              }}
            />
          ))}
        </FilterRow>

        <FilterRow label="SECTION" subColor={subColor}>
          <FilterChip
            label="All"
            selected={!selectedClassSectionId}
            theme={theme}
            onPress={() => {
              setSelectedClassSectionId('');
              setSelectedSubjectId('');
            }}
          />
          {filteredSections.map((item) => (
            <FilterChip
              key={item.class_section_id}
              label={item.section_name}
              selected={selectedClassSectionId === item.class_section_id}
              theme={theme}
              onPress={() => {
                setSelectedClassId(item.class_id);
                setSelectedClassSectionId(item.class_section_id);
                setSelectedSubjectId('');
              }}
            />
          ))}
        </FilterRow>

        <FilterRow label="SUBJECT" subColor={subColor}>
          {!selectedClassId ? (
            <Text style={[styles.filterHint, { color: subColor }]}>Select a class to view its subjects</Text>
          ) : (
            <>
              <FilterChip
                label="All"
                selected={!selectedSubjectId}
                theme={theme}
                onPress={() => setSelectedSubjectId('')}
              />
              {filteredSubjects.map((subject) => (
                <FilterChip
                  key={subject.id}
                  label={subject.name}
                  selected={selectedSubjectId === subject.id}
                  theme={theme}
                  onPress={() => setSelectedSubjectId(subject.id)}
                />
              ))}
              {filteredSubjects.length === 0 ? (
                <Text style={[styles.filterHint, { color: subColor }]}>No subjects assigned</Text>
              ) : null}
            </>
          )}
        </FilterRow>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        <View style={styles.listHeading}>
          <View>
            <Text style={[styles.listTitle, { color: titleColor }]}>Today&apos;s entries</Text>
            <Text style={[styles.listSubtitle, { color: subColor }]}>
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'} posted
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addButton, theme.shadows.sm, { backgroundColor: primary, shadowColor: primary }, options.length === 0 && styles.disabledButton]}
            onPress={openCreate}
            disabled={options.length === 0}
          >
            <Ionicons name="add" size={19} color={onPrimary} />
            <Text style={[styles.addButtonText, { color: onPrimary }]}>Add diary</Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.centerBox}>
            <LogoLoader size={40} color={primary} />
          </View>
        ) : entries.length === 0 ? (
          <Animated.View entering={ZoomIn} style={styles.emptyBox}>
            <View style={[styles.emptyIcon, { backgroundColor: primaryTint }]}>
              <Ionicons name="book-outline" size={34} color={primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: titleColor }]}>No diary entries</Text>
            <Text style={[styles.emptySub, { color: subColor }]}>Add a class-wide update or subject homework for today.</Text>
            {options.length > 0 ? (
              <TouchableOpacity style={[styles.emptyAction, { backgroundColor: primary }]} onPress={openCreate}>
                <Text style={[styles.emptyActionText, { color: onPrimary }]}>Create first entry</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.setupHint, { color: subColor }]}>Create a current class-section mapping in Academic Structure first.</Text>
            )}
          </Animated.View>
        ) : (
          entries.map((entry, index) => (
            <Animated.View
              key={entry.id}
              entering={FadeInDown.delay(index * 45).duration(350)}
              style={[styles.card, theme.shadows.sm, { backgroundColor: cardBg, borderColor: cardBorder }]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardIdentity}>
                  <View style={[styles.classBadge, { backgroundColor: primaryTint }]}>
                    <Text style={[styles.classBadgeText, { color: primary }]}>{entry.class_name}-{entry.section_name}</Text>
                  </View>
                  <View style={[styles.typeBadge, { borderColor: cardBorder }]}>
                    <Ionicons name={entry.subject_id ? 'library-outline' : 'people-outline'} size={13} color={subColor} />
                    <Text style={[styles.typeBadgeText, { color: subColor }]}>{entry.subject_name || 'Whole class'}</Text>
                  </View>
                </View>
                <TouchableOpacity style={[styles.editButton, { borderColor: cardBorder }]} onPress={() => openEdit(entry)}>
                  <Ionicons name="create-outline" size={16} color={primary} />
                  <Text style={[styles.editButtonText, { color: primary }]}>Edit</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.cardTitle, { color: titleColor }]}>{entryTitle(entry)}</Text>
              <Text style={[styles.content, { color: subColor }]}>{entry.content || entry.content_te}</Text>

              <View style={[styles.cardFooter, { borderTopColor: cardBorder }]}>
                <View style={styles.footerItem}>
                  <Ionicons name="person-outline" size={14} color={subColor} />
                  <Text style={[styles.footerText, { color: subColor }]}>{entry.teacher_name || 'Administrator'}</Text>
                </View>
                {entry.homework_due_date ? (
                  <View style={styles.footerItem}>
                    <Ionicons name="calendar-outline" size={14} color={subColor} />
                    <Text style={[styles.footerText, { color: subColor }]}>Due {entry.homework_due_date}</Text>
                  </View>
                ) : null}
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>

      <Modal visible={composerOpen} transparent animationType="slide" onRequestClose={closeComposer}>
        <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={[styles.backdrop, { backgroundColor: schoolColorWithAlpha(theme.colors.primaryDark, isDark ? 0.76 : 0.58) }]}
            onPress={closeComposer}
          />
          <View style={[styles.sheet, theme.shadows.lg, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.colors.border }]} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <View style={[styles.sheetIcon, { backgroundColor: primaryTint }]}>
                  <Ionicons name={editingEntry ? 'create-outline' : 'book-outline'} size={20} color={primary} />
                </View>
                <View>
                  <Text style={[styles.sheetTitle, { color: titleColor }]}>{editingEntry ? 'Modify diary entry' : 'Add diary entry'}</Text>
                  <Text style={[styles.sheetSubtitle, { color: subColor }]}>For {editingEntry?.entry_date || today}</Text>
                </View>
              </View>
              <TouchableOpacity style={[styles.closeButton, { backgroundColor: inputBg }]} onPress={closeComposer}>
                <Ionicons name="close" size={20} color={subColor} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <FieldLabel text="Class and section" color={titleColor} />
              {editingEntry ? (
                <View style={[styles.lockedClass, { backgroundColor: inputBg, borderColor: cardBorder }]}>
                  <Ionicons name="lock-closed-outline" size={16} color={subColor} />
                  <Text style={[styles.lockedClassText, { color: titleColor }]}>{editingEntry.class_name}-{editingEntry.section_name}</Text>
                  <Text style={[styles.lockedHint, { color: subColor }]}>Create a new entry to target another class.</Text>
                </View>
              ) : (
                <View style={styles.formChips}>
                  {options.map((option) => (
                    <FilterChip
                      key={option.class_section_id}
                      label={`${option.class_name}-${option.section_name}`}
                      selected={formClassSectionId === option.class_section_id}
                      theme={theme}
                      onPress={() => chooseFormClass(option.class_section_id)}
                    />
                  ))}
                </View>
              )}

              <FieldLabel text="Diary type" color={titleColor} />
              <View style={[styles.modeSwitch, { backgroundColor: inputBg, borderColor: cardBorder }]}>
                <ModeButton
                  icon="people-outline"
                  title="Class diary"
                  subtitle="For everyone"
                  selected={formMode === 'class'}
                  onPress={() => chooseMode('class')}
                  theme={theme}
                  onPrimary={onPrimary}
                />
                <ModeButton
                  icon="library-outline"
                  title="Subject diary"
                  subtitle="Subject-specific"
                  selected={formMode === 'subject'}
                  onPress={() => chooseMode('subject')}
                  theme={theme}
                  onPrimary={onPrimary}
                />
              </View>

              {formMode === 'subject' ? (
                <>
                  <FieldLabel text="Subject" color={titleColor} />
                  {!selectedFormOption ? (
                    <Text style={[styles.inlineHint, { color: subColor }]}>Select a class first.</Text>
                  ) : selectedFormOption.subjects.length === 0 ? (
                    <Text style={[styles.inlineHint, { color: theme.colors.danger }]}>No subjects are assigned to this class-section.</Text>
                  ) : (
                    <View style={styles.formChips}>
                      {selectedFormOption.subjects.map((subject) => (
                        <FilterChip
                          key={subject.id}
                          label={subject.name}
                          selected={formSubjectId === subject.id}
                          theme={theme}
                          onPress={() => setFormSubjectId(subject.id)}
                        />
                      ))}
                    </View>
                  )}
                </>
              ) : null}

              <FieldLabel text="Title" color={titleColor} mutedColor={theme.colors.textMuted} optional />
              <AppTextInput
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder={formMode === 'subject' ? 'Example: Mathematics homework' : 'Example: Tomorrow is a half-day'}
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, { backgroundColor: inputBg, borderColor: cardBorder, color: titleColor }]}
              />

              <FieldLabel text="Diary details" color={titleColor} />
              <AppTextInput
                value={formContent}
                onChangeText={setFormContent}
                placeholder="Enter homework, instructions, or a class update"
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                style={[styles.input, styles.textArea, { backgroundColor: inputBg, borderColor: cardBorder, color: titleColor }]}
              />

              <AppDatePicker
                label="Homework due date"
                value={formDueDate}
                onChange={setFormDueDate}
                minimumDate={editingEntry?.entry_date || today}
                isDark={isDark}
                accentColor={primary}
                containerStyle={styles.dateField}
                wrapperStyle={{ backgroundColor: inputBg, borderColor: cardBorder }}
              />

              <View style={[styles.scopeNote, { backgroundColor: theme.colors.alertBgInfo }]}>
                <Ionicons name="information-circle-outline" size={18} color={theme.colors.alertIconInfo} />
                <Text style={[styles.scopeNoteText, { color: theme.colors.alertTextInfo }]}>
                  {formMode === 'class'
                    ? 'This will appear as a general diary update for the whole class.'
                    : 'This will appear under the selected subject for students and parents.'}
                </Text>
              </View>
            </ScrollView>

            <View style={[styles.sheetActions, { borderTopColor: cardBorder }]}>
              <TouchableOpacity style={[styles.cancelButton, { borderColor: cardBorder }]} onPress={closeComposer} disabled={saving}>
                <Text style={[styles.cancelButtonText, { color: titleColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: primary }, saving && styles.disabledButton]} onPress={saveDiary} disabled={saving}>
                {saving ? <LogoLoader size={22} color={onPrimary} /> : <Ionicons name={editingEntry ? 'save-outline' : 'send-outline'} size={18} color={onPrimary} />}
                <Text style={[styles.saveButtonText, { color: onPrimary }]}>{saving ? 'Saving...' : editingEntry ? 'Save changes' : 'Post diary'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FilterRow({ label, subColor, children }: { label: string; subColor: string; children: React.ReactNode }) {
  return (
    <View style={styles.filterRow}>
      <Text style={[styles.filterLabel, { color: subColor }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        {children}
      </ScrollView>
    </View>
  );
}

function FilterChip({ label, selected, theme, onPress }: { label: string; selected: boolean; theme: SchoolTheme; onPress: () => void }) {
  const selectedText = themeTextOn(theme.colors.primary, theme);
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.colors.primary : theme.colors.navPill,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
        },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, { color: selected ? selectedText : theme.colors.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FieldLabel({ text, color, mutedColor, optional }: { text: string; color: string; mutedColor?: string; optional?: boolean }) {
  return (
    <Text style={[styles.fieldLabel, { color }]}>
      {text}{optional ? <Text style={[styles.optionalLabel, { color: mutedColor }]}>  Optional</Text> : null}
    </Text>
  );
}

function ModeButton({ icon, title, subtitle, selected, onPress, theme, onPrimary }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
  theme: SchoolTheme;
  onPrimary: string;
}) {
  const selectedBackground = schoolColorWithAlpha(theme.colors.primary, theme.dark ? 0.20 : 0.10);
  return (
    <TouchableOpacity style={[styles.modeButton, selected && { backgroundColor: selectedBackground }]} onPress={onPress}>
      <View style={[styles.modeIcon, selected && { backgroundColor: theme.colors.primary }]}>
        <Ionicons name={icon} size={18} color={selected ? onPrimary : theme.colors.textSecondary} />
      </View>
      <View>
        <Text style={[styles.modeTitle, { color: selected ? theme.colors.primary : theme.colors.textStrong }]}>{title}</Text>
        <Text style={[styles.modeSubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterContainer: { paddingVertical: 12, borderBottomWidth: 1 },
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, marginBottom: 8 },
  filterLabel: { width: 72, fontSize: 10, fontWeight: '800', letterSpacing: 1.15 },
  filterHint: { fontSize: 12, fontWeight: '600', paddingVertical: 7 },
  filterScroll: { paddingRight: 20 },
  chip: { paddingHorizontal: 15, paddingVertical: 7, borderRadius: 999, marginRight: 8, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '600' },
  scrollContent: { width: '100%', maxWidth: 1100, alignSelf: 'center', padding: 20, paddingBottom: 80 },
  listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  listTitle: { fontSize: 19, fontWeight: '800' },
  listSubtitle: { fontSize: 13, marginTop: 3 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 13 },
  addButtonText: { fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.55 },
  centerBox: { paddingVertical: 100, alignItems: 'center' },
  emptyBox: { alignItems: 'center', paddingTop: 70, gap: 10 },
  emptyIcon: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  emptyTitle: { fontSize: 19, fontWeight: '800' },
  emptySub: { maxWidth: 400, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  emptyAction: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  emptyActionText: { fontSize: 14, fontWeight: '800' },
  setupHint: { maxWidth: 420, marginTop: 8, fontSize: 13, textAlign: 'center' },
  card: { borderRadius: 18, borderWidth: 1, padding: 17, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cardIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  classBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 },
  classBadgeText: { fontSize: 12, fontWeight: '800' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  typeBadgeText: { fontSize: 12, fontWeight: '600' },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  editButtonText: { fontSize: 13, fontWeight: '800' },
  cardTitle: { fontSize: 16, fontWeight: '800', marginTop: 14, marginBottom: 6 },
  content: { fontSize: 14, lineHeight: 22 },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 15, paddingTop: 12, borderTopWidth: 1 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  footerText: { fontSize: 12, fontWeight: '500' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { width: '100%', maxWidth: 760, maxHeight: '92%', alignSelf: 'center', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, overflow: 'hidden' },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 9 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 13, paddingBottom: 15 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  sheetIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  sheetSubtitle: { fontSize: 12, marginTop: 2 },
  closeButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  form: { paddingHorizontal: 20, paddingBottom: 24 },
  fieldLabel: { fontSize: 13, fontWeight: '800', marginTop: 15, marginBottom: 9 },
  optionalLabel: { fontSize: 11, fontWeight: '600' },
  formChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  lockedClass: { borderWidth: 1, borderRadius: 13, padding: 13, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  lockedClassText: { fontSize: 14, fontWeight: '800' },
  lockedHint: { width: '100%', fontSize: 11, marginLeft: 23 },
  modeSwitch: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, padding: 5, gap: 5 },
  modeButton: { flex: 1, minHeight: 62, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 9 },
  modeIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  modeTitle: { fontSize: 13, fontWeight: '800' },
  modeSubtitle: { fontSize: 10, marginTop: 2 },
  inlineHint: { fontSize: 13, paddingVertical: 4 },
  input: { borderWidth: 1, borderRadius: 13, minHeight: 48, paddingHorizontal: 13, fontSize: 14 },
  textArea: { minHeight: 112, paddingTop: 12 },
  dateField: { marginTop: 15, marginBottom: 0 },
  scopeNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 12, padding: 11, marginTop: 15 },
  scopeNoteText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 14 },
  cancelButton: { minWidth: 100, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  cancelButtonText: { fontSize: 14, fontWeight: '800' },
  saveButton: { minWidth: 145, height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 18 },
  saveButtonText: { fontSize: 14, fontWeight: '800' },
});
