'use client';
import { useSmartPolling } from './use-smart-polling';
import { ProjectSummary } from '@/types';

interface ProjectsResponse {
  projects: ProjectSummary[];
}

export function useProjects(interval: number = 5000) {
  const { data, loading, error, refresh } = useSmartPolling<ProjectsResponse>(
    '/api/runs?mode=projects',
    {
      interval,
      sseFilter: () => true // Any event triggers refetch since project counts change
    }
  );
  return {
    projects: data?.projects || [],
    loading,
    error,
    refresh
  };
}
