/* types/property.ts — community & building domain types (refactored: properties merged into communities) */

export interface Community {
  id: number;
  name: string;
  alias?: string;
  district?: string;
  district_id?: number;
  address?: string;
  developer?: string;
  property_type?: string;
  building_count?: number;
  total_households?: number;
  plot_ratio?: number;
  green_rate?: number;
  property_company?: string;
  property_fee?: number;
  delivery_date?: string;
  decoration_status?: string;
  school_district?: string;
  metro_distance?: number;
  metro_line?: string;
  status: string;
  tags?: Record<string, unknown>;
  description?: string;
  is_featured?: boolean;
  price_per_sqm?: number;
  total_price_min?: number;
  total_price_max?: number;
  area_min?: number;
  area_max?: number;
  owner_id?: number;
  province?: string;
  city?: string;
  district_name?: string;
  buildings?: Building[];
}

export interface Building {
  id: number;
  community_id: number;
  name: string;
  building_number?: string;
  building_type?: string;
  total_floors?: number;
  floor_min?: number;
  floor_max?: number;
  units_per_floor?: number;
  unit_count?: number;
  elevator_count?: number;
  orientation?: string;
  delivery_date?: string;
  decoration_status?: string;
  metro_distance?: number;
  status: string;
  house_types?: HouseType[];
}

export interface HouseType {
  id: number;
  building_id?: number;
  name: string;
  bedrooms?: number;
  living_rooms?: number;
  bathrooms?: number;
  area?: number;
  total_price?: number;
  orientation?: string;
  floor_min?: number;
  floor_max?: number;
  description?: string;
  units?: Unit[];
}

export interface Unit {
  id: number;
  building_id: number;
  building_name?: string;
  house_type_id: number;
  house_type_name?: string;
  bedrooms?: number;
  room_number: string;
  floor?: number;
  area?: number;
  total_price?: number;
  orientation?: string;
  status_tag: string;
  tags?: string[];
  description?: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

/** @deprecated Use Community instead — kept for backward compat in transition */
export type Property = Community;
