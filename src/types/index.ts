export type Role = "COMPANY_ADMIN" | "SHOP_OWNER" | "DELIVERY_STAFF" | "WAREHOUSE_STAFF";
export type UnitType = "KG" | "PIECE" | "BOTH";

export interface Category {
  id: string;
  nameEn: string;
  nameUz: string;
  nameRu: string | null;
  slug: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}
export type OrderStatus =
  | "PENDING"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "PARTIALLY_DELIVERED"
  | "CANCELLED";

export type VehicleType = "MOTORCYCLE" | "CAR" | "VAN" | "TRUCK";
export type RouteStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type StopStatus =
  | "PENDING"
  | "ARRIVED"
  | "VERIFYING"
  | "COMPLETED"
  | "PARTIAL_RETURN"
  | "FULL_RETURN"
  | "SKIPPED";
export type ReturnReason =
  | "BAD_QUALITY"
  | "WRONG_PRODUCT"
  | "DAMAGED"
  | "EXPIRED"
  | "CUSTOMER_REFUSED"
  | "OTHER";
export type NotificationType =
  | "ORDER_PLACED"
  | "PRICE_UPDATED"
  | "STATUS_CHANGED"
  | "ACTUAL_COST_SET"
  | "PRICE_ALERT"
  | "ROUTE_ASSIGNED"
  | "DRIVER_EN_ROUTE"
  | "DRIVER_ARRIVED"
  | "RETURN_PROCESSED"
  | "DELIVERY_COMPLETED"
  | "ORDER_SHORTAGE_ALERT"
  | "LOW_STOCK_ALERT"
  | "RESTOCK_ASSIGNED"
  | "RESTOCK_COMPLETED"
  | "STOCK_ADJUSTED";

export interface DeliveryStaff {
  id:           string;
  userId:       string;
  fullName:     string;
  phone:        string;
  vehicleType:  VehicleType;
  vehiclePlate: string | null;
  isActive:     boolean;
  isAvailable:  boolean;
  currentLat:   number | null;
  currentLng:   number | null;
  lastSeenAt:   string | null;
  createdAt:    string;
  user?:        { email: string };
}

export interface Route {
  id:               string;
  date:             string;
  staffId:          string | null;
  staff?:           DeliveryStaff | null;
  status:           RouteStatus;
  startedAt:        string | null;
  completedAt:      string | null;
  totalDistanceKm:  number | null;
  estimatedMinutes: number | null;
  stops:            RouteStop[];
  createdAt:        string;
}

export interface RouteStop {
  id:          string;
  routeId:     string;
  orderId:     string;
  order?:      Order;
  sequence:    number;
  status:      StopStatus;
  arrivedAt:   string | null;
  completedAt: string | null;
  driverNote:  string | null;
}

export interface Product {
  id: string;
  name: string;
  nameUz: string;
  nameRu: string | null;
  categoryId: string;
  category: Category;
  unitType: UnitType;
  imageUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
  pricePerKg: number | null;
  pricePerPiece: number | null;
  stockAvailableKg: number | null;
  stockAvailablePieces: number | null;
}

export interface CartItem {
  productId: string;
  name: string;
  unitType: UnitType;
  orderedAs: "KG" | "PIECE";
  pricePerUnit: number;
  qty: number;
}

export interface Order {
  id: string;
  shopId: string;
  status: OrderStatus;
  estimatedTotal: number;
  actualTotal: number | null;
  deliveryFee: number | null;
  notes: string | null;
  finalCostNote: string | null;
  createdAt: string;
  updatedAt: string;
  shop?: { id: string; name: string; ownerName: string; phone: string; address: string };
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  orderedAs: "KG" | "PIECE";
  requestedKg: number | null;
  requestedPieces: number | null;
  actualKg: number | null;
  actualPieces: number | null;
  estimatedPrice: number;
  actualPrice: number | null;
  adminAdjusted: boolean;
  adminNote: string | null;
  product: { id: string; name: string; unitType: UnitType; imageUrl: string | null };
}

export interface Shop {
  id: string;
  name: string;
  ownerName: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  isActive: boolean;
  userId: string;
  createdAt: string;
  user?: { name: string; email: string };
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title?: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalShops: number;
  activeShops: number;
  totalOrders: number;
  pendingOrders: number;
  revenue: number;
  recentOrders: Array<{
    id: string;
    shopName: string;
    itemCount: number;
    status: OrderStatus;
    estimatedTotal: number;
    createdAt: string;
  }>;
}

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };
