export type ProfileStatus = 'pending' | 'approved' | 'denied';
export type TrackingType = 'quantity' | 'task' | 'claim';
export type Category = 'beach' | 'clothing' | 'car' | 'house' | 'documents' | string;

export interface Family {
  id: string;
  name: string;
  display_name: string;
  sort_order: number;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  family_id: string | null;
  status: ProfileStatus;
  is_admin: boolean;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
}

export interface ChecklistItem {
  id: string;
  category: Category;
  label: string;
  tracking_type: TrackingType;
  is_default: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

export interface Contribution {
  item_id: string;
  family_id: string;
  quantity: number;
  done: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface PackingStatus {
  item_id: string;
  family_id: string;
  updated_by: string | null;
  updated_at: string;
}


