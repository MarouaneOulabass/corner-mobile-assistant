// Corner Mobile — Type definitions

export type UserRole = 'superadmin' | 'manager' | 'seller';

export type ProductType = 'phone' | 'accessory' | 'part';

export type ProductCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';

export type ProductStatus = 'in_stock' | 'sold' | 'in_repair' | 'transferred' | 'returned';

export type PaymentMethod = 'cash' | 'card' | 'virement' | 'mixte';

export type RepairStatus = 'received' | 'diagnosing' | 'waiting_parts' | 'in_repair' | 'ready' | 'delivered' | 'cancelled';

export interface Store {
  id: string;
  name: string;
  location: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  store_id: string;
  avatar_url?: string;
  created_at: string;
  store?: Store;
}

export interface Product {
  id: string;
  imei?: string;
  product_type: ProductType;
  brand: string;
  model: string;
  storage?: string;
  color?: string;
  condition: ProductCondition;
  purchase_price: number;
  selling_price: number;
  status: ProductStatus;
  store_id: string;
  supplier?: string;
  purchase_date?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  store?: Store;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  created_at: string;
}

export interface Sale {
  id: string;
  store_id: string;
  seller_id: string;
  customer_id?: string;
  total: number;
  discount_amount: number;
  discount_type?: 'flat' | 'percentage';
  payment_method: PaymentMethod;
  payment_details?: Record<string, number>;
  created_at: string;
  seller?: User;
  customer?: Customer;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  original_price: number;
  product?: Product;
}

export interface Repair {
  id: string;
  customer_id: string;
  store_id: string;
  technician_id?: string;
  device_brand: string;
  device_model: string;
  imei?: string;
  problem: string;
  problem_categories: string[];
  condition_on_arrival?: string;
  status: RepairStatus;
  estimated_cost: number;
  final_cost?: number;
  deposit: number;
  estimated_completion_date?: string;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  technician?: User;
  status_logs?: RepairStatusLog[];
}

export interface RepairStatusLog {
  id: string;
  repair_id: string;
  status: RepairStatus;
  changed_by: string;
  changed_at: string;
  notes?: string;
  user?: User;
}

export interface Transfer {
  id: string;
  product_id: string;
  from_store_id: string;
  to_store_id: string;
  initiated_by: string;
  created_at: string;
  product?: Product;
  from_store?: Store;
  to_store?: Store;
  initiator?: User;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'repair_ready' | 'transfer_received' | 'low_stock' | 'sale_made';
  title: string;
  message: string;
  read: boolean;
  data?: Record<string, unknown>;
  created_at: string;
}

export interface AiLog {
  id: string;
  feature: string;
  prompt: string;
  response: string;
  user_id: string;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  original_price: number;
}

export interface LabelData {
  product: Product;
  store_name: string;
}
