import { useState, useCallback } from 'react';
import { chatApi } from '../services/api';

export function useCommunities() {
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCommunities = useCallback(async (filters?: {
    district?: string;
    min_price?: number;
    max_price?: number;
    bedrooms?: number;
  }) => {
    setLoading(true);
    try {
      const data = await chatApi.getCommunities(filters);
      setCommunities(data);
      return data;
    } catch (error) {
      console.error('Error fetching communities:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCommunityDetail = useCallback(async (id: number) => {
    try {
      return await chatApi.getCommunityDetail(id);
    } catch (error) {
      console.error('Error fetching community detail:', error);
      return null;
    }
  }, []);

  const recommendProperties = useCallback(async (preference: string) => {
    try {
      return await chatApi.recommendProperties(preference);
    } catch (error) {
      console.error('Error recommending properties:', error);
      return null;
    }
  }, []);

  const compareProperties = useCallback(async (communityIds: number[]) => {
    try {
      return await chatApi.compareProperties(communityIds);
    } catch (error) {
      console.error('Error comparing properties:', error);
      return null;
    }
  }, []);

  return {
    communities,
    loading,
    fetchCommunities,
    fetchCommunityDetail,
    recommendProperties,
    compareProperties,
  };
}
