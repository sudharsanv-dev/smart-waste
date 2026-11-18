// src/api/scheduleService.ts
// Locked Section 3.2 Scheduler Service (Root Pagination)

import { axiosClient } from './axiosClient';
import {
  AdminSchedulesResponse,
  AgentSchedulesResponse,
  ConsumerSchedulesResponse,
} from '../types/contracts';

export const scheduleService = {
  // A. Admin API: Retrieve Master Schedules
  async getAdminSchedules(params?: {
    start_date?: string;
    end_date?: string;
    area_code?: string;
    assigned_agent_id?: string;
    page?: number;
    size?: number;
  }): Promise<AdminSchedulesResponse> {
    const response = await axiosClient.get<AdminSchedulesResponse>('/api/v1/admin/schedules', { params });
    return response.data;
  },

  // B. Collection Agent API: Retrieve Assigned Tasks
  async getAgentSchedules(params?: {
    start_date?: string;
    end_date?: string;
    start_time?: string;
    end_time?: string;
    page?: number;
    size?: number;
  }): Promise<AgentSchedulesResponse> {
    const response = await axiosClient.get<AgentSchedulesResponse>('/api/v1/agent/schedules', { params });
    return response.data;
  },

  // C. Consumer API: Retrieve Neighborhood Timetable
  async getConsumerSchedules(params: {
    area_code: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    size?: number;
  }): Promise<ConsumerSchedulesResponse> {
    const response = await axiosClient.get<ConsumerSchedulesResponse>('/api/v1/consumer/schedules', { params });
    return response.data;
  },
};
