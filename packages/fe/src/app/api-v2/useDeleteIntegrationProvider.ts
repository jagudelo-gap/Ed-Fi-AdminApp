import { useMutation } from '@tanstack/react-query';
import { apiClient } from './apiClient';

export const useDeleteIntegrationProvider = () => {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`integration-providers/${id}`);
    },
  });
};
