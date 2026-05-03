import { api } from './apiClient';

export interface DoubtAssistRequest {
    question: string;
    class_level?: string;
    subject?: string;
}

export interface DoubtAssistResponse {
    answer: string;
    id: string;
}

export const AIService = {
    /**
     * Ask AI Doubt Assist
     */
    askDoubt: async (data: DoubtAssistRequest): Promise<DoubtAssistResponse> => {
        return api.post<DoubtAssistResponse>('/ai/doubt-assist', data);
    },
};
