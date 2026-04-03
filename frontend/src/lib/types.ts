export interface ProductUnit {
  id: string;
  unitName: string;
  conversionFactor: number;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  basePrice: number;
  units: ProductUnit[];
  inventory?: {
    quantity: number;
    lowStock: number;
  };
}

export interface CartItem {
  productId: string;
  productName: string;
  unitName: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
  maxStock: number;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change: number;
  createdAt: string;
  items: SaleItem[];
}

export interface SaleItem {
  id: string;
  productId: string;
  unitName: string;
  quantity: number;
  price: number;
  discount: number;
  total: number;
  product?: Product;
}
