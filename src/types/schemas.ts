import { z } from 'zod';

// ============================================================================
// DATABASE-ALIGNED SCHEMAS
// ============================================================================

// UUID validation
const uuidSchema = z.string().uuid();

// Reference Types
export const GenderSchema = z.object({
    id: z.number(),
    name: z.string(),
});

export const StudentCategorySchema = z.object({
    id: z.number(),
    name: z.string(),
});

export const ReligionSchema = z.object({
    id: z.number(),
    name: z.string(),
});

export const BloodGroupSchema = z.object({
    id: z.number(),
    name: z.string(),
});

export const RelationshipTypeSchema = z.object({
    id: z.number(),
    name: z.string(),
});

export const StaffDesignationSchema = z.object({
    id: z.number(),
    name: z.string(),
});

export const CountrySchema = z.object({
    code: z.string().length(2),
    name: z.string(),
});

// Enums
export const ContactTypeSchema = z.enum(['email', 'phone', 'address']);
export const AccountStatusSchema = z.enum(['active', 'locked', 'disabled']);
export const AttendanceStatusSchema = z.enum(['present', 'absent', 'late', 'half_day']);
export const EnrollmentStatusSchema = z.enum(['active', 'completed', 'withdrawn']);

// Person
export const PersonSchema = z.object({
    id: uuidSchema,
    first_name: z.string().min(1, 'First name is required'),
    middle_name: z.string().nullable().optional(),
    last_name: z.string().min(1, 'Last name is required'),
    display_name: z.string().nullable().optional(),
    dob: z.string().nullable().optional(), // ISO date
    gender_id: z.number(),
    nationality_code: z.string().length(2).nullable().optional(),
    photo_url: z.string().url().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.string().nullable().optional(),
});

export const PersonContactSchema = z.object({
    id: uuidSchema,
    person_id: uuidSchema,
    contact_type: ContactTypeSchema,
    contact_value: z.string().min(1),
    is_primary: z.boolean().default(false),
    is_emergency: z.boolean().default(false),
    is_verified: z.boolean().default(false),
    verified_at: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.string().nullable().optional(),
});

// RBAC
export const RoleSchema = z.object({
    id: uuidSchema,
    code: z.string(),
    name: z.string(),
    is_system: z.boolean(),
});

export const PermissionSchema = z.object({
    id: uuidSchema,
    code: z.string(),
    name: z.string(),
});

// User
export const UserSchema = z.object({
    id: uuidSchema,
    person_id: uuidSchema,
    account_status: AccountStatusSchema.default('active'),
    created_at: z.string(),
    last_login_at: z.string().nullable().optional(),
    failed_login_attempts: z.number().default(0),
    locked_until: z.string().nullable().optional(),
    updated_at: z.string(),
});

export const UserRoleSchema = z.object({
    user_id: uuidSchema,
    role_id: uuidSchema,
    granted_by: uuidSchema.nullable().optional(),
    granted_at: z.string(),
});

// Student
export const StudentSchema = z.object({
    id: uuidSchema,
    person_id: uuidSchema,
    admission_no: z.string().min(1, 'Admission number is required'),
    admission_date: z.string(), // ISO date
    category_id: z.number().nullable().optional(),
    religion_id: z.number().nullable().optional(),
    blood_group_id: z.number().nullable().optional(),
    status_id: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.string().nullable().optional(),
});

// Parent
export const ParentSchema = z.object({
    id: uuidSchema,
    person_id: uuidSchema,
    occupation: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.string().nullable().optional(),
});

export const StudentParentSchema = z.object({
    id: uuidSchema,
    student_id: uuidSchema,
    parent_id: uuidSchema,
    relationship_id: z.number().nullable().optional(),
    is_primary_contact: z.boolean().default(false),
    is_legal_guardian: z.boolean().default(false),
    valid_from: z.string().nullable().optional(),
    valid_to: z.string().nullable().optional(),
    created_at: z.string(),
    deleted_at: z.string().nullable().optional(),
});

// Academics
export const AcademicYearSchema = z.object({
    id: uuidSchema,
    code: z.string(),
    start_date: z.string(),
    end_date: z.string(),
});

export const ClassSchema = z.object({
    id: uuidSchema,
    name: z.string().min(1, 'Class name is required'),
    code: z.string().nullable().optional(),
});

export const SectionSchema = z.object({
    id: uuidSchema,
    name: z.string().min(1, 'Section name is required'),
    code: z.string().nullable().optional(),
});

export const ClassSectionSchema = z.object({
    id: uuidSchema,
    class_id: uuidSchema,
    section_id: uuidSchema,
    academic_year_id: uuidSchema,
});

export const StudentEnrollmentSchema = z.object({
    id: uuidSchema,
    student_id: uuidSchema,
    academic_year_id: uuidSchema,
    class_section_id: uuidSchema,
    status: EnrollmentStatusSchema.default('active'),
    start_date: z.string(),
    end_date: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.string().nullable().optional(),
});

// Attendance
export const DailyAttendanceSchema = z.object({
    id: uuidSchema,
    student_enrollment_id: uuidSchema,
    attendance_date: z.string(),
    status: AttendanceStatusSchema,
    marked_by: uuidSchema.nullable().optional(),
    marked_at: z.string().nullable().optional(),
    updated_at: z.string(),
    deleted_at: z.string().nullable().optional(),
});

// ============================================================================
// LEGACY SCHEMAS (For Backward Compatibility)
// ============================================================================

export const LegacyUserSchema = z.object({
    uid: z.string(),
    role: z.enum(['admin', 'teacher', 'student', 'parent', 'accountant', 'staff']),
    name: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    createdAt: z.any().optional(),
});

export const LegacyStudentSchema = z.object({
    id: z.string(),
    name: z.string().min(1, "Name is required"),
    classId: z.string().min(1, "Class is required"),
    rollNo: z.string(),
    parentId: z.string().optional(),
    dob: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    createdAt: z.any().optional(),
});

export const LegacyAttendanceSchema = z.object({
    id: z.string(),
    studentId: z.string(),
    date: z.string(),
    status: z.enum(['present', 'absent', 'unmarked']),
});

export const FeeSchema = z.object({
    id: z.string(),
    studentId: z.string(),
    amount: z.number().min(0),
    status: z.enum(['paid', 'due', 'overdue']),
    dueDate: z.string().optional(),
    type: z.string().optional(),
});

export const ComplaintSchema = z.object({
    id: z.string(),
    raisedBy: z.string(),
    message: z.string().min(5, "Message must be at least 5 chars"),
    status: z.enum(['open', 'resolved']),
    createdAt: z.any().optional(),
});

// ============================================================================
// CREATE/UPDATE SCHEMAS (For API Requests)
// ============================================================================

export const CreatePersonSchema = PersonSchema.omit({
    id: true,
    display_name: true,
    created_at: true,
    updated_at: true,
    deleted_at: true,
});

export const UpdatePersonSchema = CreatePersonSchema.partial();

export const CreateStudentSchema = StudentSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    deleted_at: true,
});

export const UpdateStudentSchema = CreateStudentSchema.partial().omit({
    person_id: true, // Cannot change person link
});

export const CreateUserSchema = UserSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    last_login_at: true,
    failed_login_attempts: true,
    locked_until: true,
});

export const CreateEnrollmentSchema = StudentEnrollmentSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    deleted_at: true,
});

export const MarkAttendanceSchema = DailyAttendanceSchema.omit({
    id: true,
    marked_at: true,
    updated_at: true,
    deleted_at: true,
});
