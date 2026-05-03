export interface Invoice {
    id: string; // student_fees.id
    student_id: string;
    amount_due: number;
    amount_paid: number;
    discount: number;
    status: 'pending' | 'partial' | 'paid' | 'waived' | 'overdue';
    due_date: string | null;
    period_month: number | null;
    period_year: number | null;
    created_at: string; // Invoice Date

    // Joins
    student?: {
        admission_no: string;
        person?: {
            first_name: string;
            last_name: string;
            display_name: string;
        };
        class_section?: {
            class?: { name: string };
            section?: { name: string };
        };
    };

    fee_structure?: {
        amount: number;
        fee_type?: {
            name: string;
            description: string | null;
            code: string | null;
        };
    };
}
