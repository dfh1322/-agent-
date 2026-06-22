/* types/property.ts */
export interface Property {
  id: number;
  name: string;
  district?: string;
  district_id?: number;
  address?: string;
  developer?: string;
  price_per_sqm?: number;
  total_price_min?: number;
  total_price_max?: number;
  area_min?: number;
  area_max?: number;
  decoration_status?: string;
  metro_distance?: number;
  metro_line?: string;
  school_district?: string;
  green_rate?: number;
  property_fee?: number;
  status: string;
  tags?: Record<string, unknown>;
  description?: string;
  is_featured?: boolean;
  owner_id?: number;
  cover_image?: string;
}

export interface PropertyFavorite {
  id: number;
  property_id: number;
  property_name?: string;
  property_image?: string;
  property?: Property;
  notes?: string;
  created_at: string;
}
