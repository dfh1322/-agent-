import { useState, useCallback } from 'react';
import { chatApi } from '../services/api';

export function useProperties() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProperties = useCallback(async (filters?: {
    district?: string;
    min_price?: number;
    max_price?: number;
    bedrooms?: number;
  }) => {
    setLoading(true);
    try {
      const data = await chatApi.getProperties(filters);
      setProperties(data);
      return data;
    } catch (error) {
      console.error('Error fetching properties:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPropertyDetail = useCallback(async (id: number) => {
    try {
      return await chatApi.getPropertyDetail(id);
    } catch (error) {
      console.error('Error fetching property detail:', error);
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

  const compareProperties = useCallback(async (propertyIds: number[]) => {
    try {
      return await chatApi.compareProperties(propertyIds);
    } catch (error) {
      console.error('Error comparing properties:', error);
      return null;
    }
  }, []);

  return {
    properties,
    loading,
    fetchProperties,
    fetchPropertyDetail,
    recommendProperties,
    compareProperties,
  };
}
