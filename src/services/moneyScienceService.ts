import { supabase } from './supabaseConfig';
import { MoneyScienceModule, MoneyScienceProgress } from '../types/models';

export const MoneyScienceService = {
    /**
     * Fetch all available modules
     */
    getAllModules: async (): Promise<MoneyScienceModule[]> => {
        const { data, error } = await supabase
            .from('money_science_modules')
            .select('*')
            .order('title');

        if (error) throw error;
        return data || [];
    },

    /**
     * Fetch progress for a specific student
     */
    getStudentProgress: async (studentId: string): Promise<MoneyScienceProgress[]> => {
        const { data, error } = await supabase
            .from('student_money_science_progress')
            .select('*')
            .eq('student_id', studentId);

        if (error) throw error;
        return data || [];
    },

    /**
     * Update or Create progress
     */
    upsertProgress: async (studentId: string, moduleId: string, progress: Partial<MoneyScienceProgress>) => {
        const { data, error } = await supabase
            .from('student_money_science_progress')
            .upsert({
                student_id: studentId,
                module_id: moduleId,
                ...progress,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
