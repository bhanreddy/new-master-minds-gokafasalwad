import { supabase } from './supabaseConfig';
import { LifeValuesModule, LifeValuesProgress } from '../types/models';

export const LifeValuesService = {
    getModules: async (): Promise<LifeValuesModule[]> => {
        const { data, error } = await supabase
            .from('life_values_modules')
            .select('*');
        if (error) throw error;
        return data || [];
    },

    getProgress: async (studentId: string): Promise<LifeValuesProgress[]> => {
        const { data, error } = await supabase
            .from('student_life_values_progress')
            .select('*')
            .eq('student_id', studentId);

        if (error) throw error;
        return data || [];
    },

    updateEngagement: async (studentId: string, moduleId: string, academicYearId: string, scoreDelta: number) => {
        // Need to fetch current first (or upsert with increment logic if Supabase supports atomic increment easily)
        // For now, simpler read-modify-write as conflict handling is complex in upsert for logic

        const { data: existing } = await supabase
            .from('student_life_values_progress')
            .select('*')
            .eq('student_id', studentId)
            .eq('module_id', moduleId)
            .eq('academic_year_id', academicYearId)
            .single();

        let newScore = (existing?.engagement_score || 0) + scoreDelta;

        const { data, error } = await supabase
            .from('student_life_values_progress')
            .upsert({
                student_id: studentId,
                module_id: moduleId,
                academic_year_id: academicYearId,
                engagement_score: newScore,
                updated_at: new Date().toISOString()
            })
            .select();

        if (error) throw error;
        return data;
    }
};
