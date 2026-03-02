import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import StaffHeader from '../../src/components/StaffHeader';
import { StudentService } from '../../src/services/studentService';
import { ResultService, TeacherService, TeacherClassAssignment } from '@/src/services/commonServices';
import { useAuth } from '@/src/hooks/useAuth';
import { StudentWithDetails } from '@/src/types/schema';
import { useTheme } from '../../src/hooks/useTheme';
import { Theme } from '../../src/theme/themes';

// ... (existing helper constants) ...

// -------------------------------------------------------------------------
// Types & Constants
// -------------------------------------------------------------------------

interface ExamCategory {
  key: string;
  title: string;
  icon: any; // using 'any' for Ionicons name to avoid complex type imports
  color: string;
  description: string;
  subExams?: string[];
}
const EXAM_CATEGORIES: ExamCategory[] = [{
  key: 'slip_test',
  title: 'Slip Tests',
  icon: 'document-text',
  color: '#3B82F6',
  // Blue
  description: 'Weekly slip tests and unit tests',
  subExams: ['ST-1', 'ST-2', 'ST-3', 'ST-4', 'ST-5']
}, {
  key: 'fa_results',
  title: 'Formative Assessment',
  icon: 'analytics',
  color: '#10B981',
  // Green
  description: 'FA-1 to FA-4 Internal Exams',
  subExams: ['FA-1', 'FA-2', 'FA-3', 'FA-4']
}, {
  key: 'sa_results',
  title: 'Summative Assessment',
  icon: 'school',
  color: '#F59E0B',
  // Amber
  description: 'Half-yearly and Annual Exams',
  subExams: ['SA-1', 'SA-2']
}, {
  key: 'special',
  title: 'Special Exams',
  icon: 'star',
  color: '#8B5CF6',
  // Purple
  description: 'Talent tests and special evaluations',
  subExams: ['Special-1', 'Special-2']
}, {
  key: 'weekend',
  title: 'Weekend Exams',
  icon: 'calendar',
  color: '#F9FAFB',
  // Pink-ish (custom below)
  description: 'Weekly practice (IIT/NEET)',
  subExams: ['W-1', 'W-2', 'W-3', 'W-4'] // Dynamic in future?
}];
export default function UploadMarks() {
  const {
    theme,
    isDark
  } = useTheme();
  const styles = React.useMemo(() => getStyles(theme, isDark), [theme, isDark]);
  // State for navigation within the screen
  const [selectedCategory, setSelectedCategory] = useState<ExamCategory | null>(null);
  const [selectedSubExam, setSelectedSubExam] = useState(''); // 'FA-1' | ...
  const [maxMarks, setMaxMarks] = useState('100');

  // Dynamic Class/Subject Selection
  const [assignments, setAssignments] = useState<TeacherClassAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<TeacherClassAssignment | null>(null);
  const [marks, setMarks] = useState<{
    [key: string]: string;
  }>({});
  const [students, setStudents] = useState<StudentWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const {
    user
  } = useAuth();
  // ... existing useEffects ...

  // 1. Fetch Teacher's Assigned Classes on Mount
  useEffect(() => {
    fetchAssignments();
  }, []);
  const fetchAssignments = async () => {
    try {
      const data = await TeacherService.getMyClasses();
      setAssignments(data);
      if (data.length > 0) {
        setSelectedAssignment(data[0]); // Default to first assignment
      }
    } catch (error) {
      console.error('Failed to fetch assignments:', error);
      Alert.alert('Error', 'Could not load your assigned classes.');
    }
  };

  // 2. Fetch Students when Category or Assignment changes
  useEffect(() => {
    if (selectedCategory && selectedAssignment) {
      fetchStudents();
    } else {
      setStudents([]);
    }
  }, [selectedCategory, selectedAssignment]);

  // 3. Fetch Existing Marks when SubExam changes
  useEffect(() => {
    if (selectedCategory && selectedAssignment && selectedSubExam) {
      fetchExistingMarks();
    }
  }, [selectedCategory, selectedAssignment, selectedSubExam]);
  const fetchExistingMarks = async () => {
    if (!selectedAssignment || !selectedCategory || !selectedSubExam) return;
    try {
      setLoading(true);
      const data = await ResultService.getMarks({
        class_section_id: selectedAssignment.class_section_id,
        exam_category: selectedCategory.key,
        sub_exam: selectedSubExam,
        subject_id: selectedAssignment.subject_id
      });
      if (data.max_marks) {
        setMaxMarks(data.max_marks.toString());
      } else {
        setMaxMarks('100');
      }
      const newMarks: {
        [key: string]: string;
      } = {};
      if (data.marks && data.marks.length > 0) {
        data.marks.forEach(m => {
          newMarks[m.student_id] = m.marks_obtained.toString();
        });
      }
      setMarks(newMarks);
    } catch (error) {
      console.error('Failed to fetch existing marks:', error);
    } finally {
      setLoading(false);
    }
  };
  const fetchStudents = async () => {
    if (!selectedAssignment) return;
    try {
      setLoading(true);
      const response = await StudentService.getAll<StudentWithDetails>({
        class_id: selectedAssignment.class_id,
        section_id: selectedAssignment.section_id,
        limit: 100
      });
      setStudents(response.data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  // ... existing handlers ...
  const handleBackToDashboard = () => {
    setSelectedCategory(null);
    setMarks({});
  };
  const handleMaxMarksChange = (text: string) => {
    if (/^\d*$/.test(text)) {
      setMaxMarks(text);
    }
  };
  const handleMarkChange = (studentId: string, text: string) => {
    // Allow only numbers
    if (/^\d*$/.test(text) && (text === '' || Number(text) <= Number(maxMarks))) {
      setMarks(prev => ({
        ...prev,
        [studentId]: text
      }));
    }
  };
  const handleSubmit = async () => {
    if (!selectedCategory || !selectedAssignment) return;
    const filledMarks = Object.keys(marks).map(studentId => ({
      student_id: studentId,
      marks: Number(marks[studentId])
    }));
    if (filledMarks.length === 0) {
      Alert.alert("Warning", "No marks entered.");
      return;
    }
    Alert.alert("Confirm Upload", `Upload marks for ${selectedCategory?.title} - ${selectedAssignment.class_name} (${selectedAssignment.subject_name})?`, [{
      text: "Cancel",
      style: "cancel"
    }, {
      text: "Upload",
      onPress: async () => {
        try {
          setLoading(true);
          await ResultService.upload({
            class_section_id: selectedAssignment.class_section_id,
            exam_category: selectedCategory.key,
            sub_exam: selectedSubExam,
            subject_id: selectedAssignment.subject_id,
            max_marks: Number(maxMarks),
            results: filledMarks
          });
          Alert.alert("Success", "Marks uploaded successfully!");
          setSelectedCategory(null);
          setMarks({});
        } catch (e) {
          console.error(e);
          Alert.alert("Error", "Failed to upload marks");
        } finally {
          setLoading(false);
        }
      }
    }]);
  };

  // Render Dashboard (Selection Grid)
  const renderDashboard = () => {
    return <ScrollView contentContainerStyle={styles.dashboardContent}>
      <View style={styles.headerSection}>
        <Text style={styles.pageTitle}>Marks Entry</Text>
        <Text style={styles.pageSubtitle}>Select an exam category to upload marks</Text>
      </View>

      <View style={styles.gridContainer}>
        {EXAM_CATEGORIES.map((cat, index) => {
          return <Animated.View key={cat.key} entering={FadeInDown.delay(index * 100).duration(600)} style={styles.cardContainer}>
            <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => {
              setSelectedCategory(cat);
              if (cat.subExams && cat.subExams.length > 0) {
                setSelectedSubExam(cat.subExams[0]);
              }
            }}>
              <View style={[styles.iconBox, {
                backgroundColor: cat.color + '20'
              }]}>
                <Ionicons name={cat.icon} size={24} color={cat.color} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>{cat.title}</Text>
                <Text style={styles.cardSubtitle}>{cat.description}</Text>
              </View>
              <View style={styles.arrowBox}>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          </Animated.View>;
        })}
      </View>
    </ScrollView>;
  };

  // Render Upload Form
  const renderUploadForm = () => {
    return <>
      <View style={styles.filterSection}>
        {/* Dynamic Class & Subject Selection */}
        {assignments.length > 0 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{
          marginBottom: 15
        }}>
          {assignments.map(assign => {
            return <TouchableOpacity key={assign.assignment_id} style={[styles.dropdown, selectedAssignment?.assignment_id === assign.assignment_id && styles.dropdownActive]} onPress={() => setSelectedAssignment(assign)}>
              <Text style={[styles.dropdownText, selectedAssignment?.assignment_id === assign.assignment_id && styles.dropdownTextActive]}>
                {assign.class_name}-{assign.section_name} : {assign.subject_name}
              </Text>
            </TouchableOpacity>;
          })}
        </ScrollView> : <Text style={{
          color: 'red',
          marginBottom: 10
        }}>No classes assigned to you.</Text>}


        {/* Dynamic Sub-Exam Tabs */}
        {/* ... (existing sub-exam tabs) ... */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          <View style={styles.examTabs}>
            {selectedCategory?.subExams?.map((exam: string) => {
              return <TouchableOpacity key={exam} style={[styles.examTab, selectedSubExam === exam && styles.examTabActive]} onPress={() => setSelectedSubExam(exam)}>
                <Text style={[styles.examTabText, selectedSubExam === exam && styles.examTabTextActive]}>
                  {exam}
                </Text>
              </TouchableOpacity>;
            }) || null}
          </View>
        </ScrollView>
      </View>

      {/* Total Marks Input */}
      <View style={{
        paddingHorizontal: 20,
        marginBottom: 10
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#fff',
          padding: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#E5E7EB'
        }}>
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: '#374151',
            marginRight: 10
          }}>Total Marks:</Text>
          <TextInput style={{
            flex: 1,
            fontSize: 16,
            color: '#111827',
            fontWeight: 'bold'
          }} value={maxMarks} onChangeText={handleMaxMarksChange} keyboardType="numeric" maxLength={3} />
        </View>
      </View>

      {/* Student List */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {/* ... (existing table header and list) ... */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, {
            flex: 2
          }]}>Student Name</Text>
          <Text style={[styles.headerCell, {
            flex: 1,
            textAlign: 'center'
          }]}>Marks / {maxMarks}</Text>
        </View>

        {loading ? <ActivityIndicator size="large" /> : students.length > 0 ? students.map((student, index) => {
          return <Animated.View key={student.id} entering={FadeInDown.delay(index * 50).duration(400)} style={styles.studentRow}>
            <View style={{
              flex: 2
            }}>
              <Text style={styles.studentName}>{student.person.display_name || `${student.person.first_name} ${student.person.last_name}`}</Text>
              <Text style={styles.studentRoll}>Roll No: {student.admission_no}</Text>
            </View>
            <View style={{
              flex: 1,
              alignItems: 'center'
            }}>
              <TextInput style={styles.markInput} placeholder="--" keyboardType="numeric" maxLength={3} value={marks[student.id] || ''} onChangeText={text => handleMarkChange(student.id, text)} />
            </View>
          </Animated.View>;
        }) : <Text style={{
          textAlign: 'center',
          marginTop: 20,
          color: '#666'
        }}>No students found in this class.</Text>}
      </ScrollView>

      {/* ... (floating action) ... */}
      <View style={styles.floatingAction}>
        {/* ... */}
        <TouchableOpacity style={[styles.submitButton, loading && {
          opacity: 0.7
        }]} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.submitText}>Upload Results</Text>
          <Ionicons name="cloud-upload" size={20} color="#fff" style={{
            marginLeft: 8
          }} />
        </TouchableOpacity>
      </View>
    </>;
  };
  return <View style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#fff" />

    {/* Header adapts based on view */}
    <StaffHeader title={selectedCategory?.title ?? "Upload Marks"} showBackButton={true} />
    {selectedCategory && <TouchableOpacity style={styles.backToDash} onPress={handleBackToDashboard}>
      <Ionicons name="arrow-back" size={16} color="#6B7280" />
      <Text style={styles.backText}>All Exams</Text>
    </TouchableOpacity>}

    {selectedCategory ? renderUploadForm() : renderDashboard()}
  </View>;
}
const getStyles = (theme: Theme, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card
  },
  // Dashboard Styles
  dashboardContent: {
    padding: 20
  },
  headerSection: {
    marginBottom: 25
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827'
  },
  pageSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 5
  },
  gridContainer: {
    gap: 15
  },
  cardContainer: {
    width: '100%'
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2
  },
  iconBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16
  },
  textContainer: {
    flex: 1
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2
  },
  cardSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500'
  },
  arrowBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    // Matching button theme
    justifyContent: 'center',
    alignItems: 'center'
  },
  // Internal Navigation
  backToDash: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.card
  },
  backText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    marginLeft: 4
  },
  // Upload Form Styles
  filterSection: {
    backgroundColor: theme.colors.background,
    padding: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.card
  },
  dropdownRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 15
  },
  dropdown: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.card
  },
  dropdownText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500'
  },
  tabsScroll: {
    marginTop: 5
  },
  examTabs: {
    flexDirection: 'row',
    gap: 8
  },
  examTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  examTabActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#8B5CF6'
  },
  examTabText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontWeight: '600'
  },
  examTabTextActive: {
    color: '#8B5CF6'
  },
  listContent: {
    padding: 20,
    paddingBottom: 160
  },
  tableHeader: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 10
  },
  headerCell: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  studentRow: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 1
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: theme.colors.card
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937'
  },
  studentRoll: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2
  },
  markInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    width: 60,
    height: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    backgroundColor: theme.colors.card
  },
  floatingAction: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20
  },
  submitButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#8B5CF6",
    shadowOffset: {
      width: 0,
      height: 4
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  submitText: {
    color: theme.colors.background,
    fontSize: 16,
    fontWeight: 'bold'
  },
  dropdownActive: {
    borderColor: '#8B5CF6',
    backgroundColor: '#EEF2FF',
    marginRight: 10
  },
  dropdownTextActive: {
    color: '#8B5CF6',
    fontWeight: 'bold'
  }
});