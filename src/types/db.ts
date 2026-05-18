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

export interface HiddenItem {
  item_id: string;
  family_id: string;
  hidden_by: string | null;
  hidden_at: string;
}

export interface Message {
  id: string;
  item_id: string;
  author_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
}

// Same shape minus `content` — what useConversations loads eagerly on page
// load to power per-item unread counts and the chat-icon affordance without
// pulling every message body. Content is fetched on demand when a thread
// modal opens.
export type MessageMeta = Omit<Message, 'content'>;

export interface ThreadRead {
  item_id: string;
  user_id: string;
  last_read_at: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'other';

export interface Meal {
  id: string;
  meal_date: string;        // 'YYYY-MM-DD' (Postgres DATE)
  meal_type: MealType;
  title: string;
  notes: string | null;
  head_chef_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MealSousChef {
  meal_id: string;
  user_id: string;
  joined_at: string;
}


