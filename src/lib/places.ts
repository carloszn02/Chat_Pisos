/** Reading cities and their districts/neighbourhoods, and "I'd like a group here" interest. */

import { supabase } from '@/lib/supabase';
import type { Area, City } from '@/types/places';

export async function fetchActiveCities(): Promise<City[]> {
  const { data, error } = await supabase
    .from('cities')
    .select('id, country_id, slug, name, photo_credit')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function fetchAreas(cityId: string): Promise<Area[]> {
  const { data, error } = await supabase
    .from('areas')
    .select('id, city_id, parent_id, kind, slug, name, official_name, sort_order')
    .eq('city_id', cityId)
    .order('sort_order');
  if (error) throw error;
  return data as Area[];
}

/** Places the current user has asked a group for. */
export async function fetchMyInterests(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('area_interest')
    .select('area_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set(data.map((row) => row.area_id as string));
}

export async function setInterest(userId: string, areaId: string, interested: boolean) {
  if (interested) {
    const { error } = await supabase.from('area_interest').insert({ area_id: areaId });
    // 23505 = already marked; that's fine.
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await supabase
      .from('area_interest')
      .delete()
      .eq('user_id', userId)
      .eq('area_id', areaId);
    if (error) throw error;
  }
}
