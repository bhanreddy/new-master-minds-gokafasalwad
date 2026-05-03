import { supabase } from './supabaseConfig';
import { ScienceProject } from '../types/models';

export const ScienceProjectsService = {
    /**
     * Fetch all projects with user status if available
     */
    getProjects: async (studentId: string): Promise<ScienceProject[]> => {
        // 1. Fetch all projects
        const { data: projects, error: projError } = await supabase
            .from('science_projects')
            .select('*');

        if (projError) throw projError;

        // 2. Fetch my registrations
        const { data: myProjs, error: myError } = await supabase
            .from('student_science_projects')
            .select('project_id, status, grade')
            .eq('student_id', studentId);

        if (myError) throw myError;

        // 3. Merge
        const myMap = new Map();
        myProjs?.forEach(p => myMap.set(p.project_id, p));

        return projects.map((p: any) => ({
            ...p,
            user_status: myMap.get(p.id)?.status || 'available',
            user_grade: myMap.get(p.id)?.grade
        }));
    },

    joinProject: async (studentId: string, projectId: string) => {
        const { data, error } = await supabase
            .from('student_science_projects')
            .insert({
                student_id: studentId,
                project_id: projectId,
                status: 'registered'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    submitProject: async (studentId: string, projectId: string, url: string) => {
        const { data, error } = await supabase
            .from('student_science_projects')
            .update({
                status: 'submitted',
                submission_url: url,
                updated_at: new Date().toISOString()
            })
            .eq('student_id', studentId)
            .eq('project_id', projectId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
