'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import { Product, CartItem } from '@/lib/types';
import { ProductSearch } from '@/components/ProductSearch';
import { Cart } from '@/components/Cart';
import { CheckoutModal } from '@/components/CheckoutModal';
import { ReceiptModal } from '@/components/ReceiptModal';
import { SalesHistory } from '@/components/SalesHistory';

export default function POSPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [todaySummary, setTodaySummary] = useState({ totalSales: 0, totalRevenue: '0' });
  const searchRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setUser(auth.getUser());
  }, []);

  const loadTodaySummary = useCallback(async () => {
    try {
      const summary = await api.sales.todaySummary();
      setTodaySummary(summary);
    } catch {
      // offline — ignore
    }
  }, []);

  useEffect(() => {
    loadTodaySummary();
    searchRef.current?.focus();
  }, [loadTodaySummary]);

  const addToCart = (product: Product, unitName: string, quantity: number) => {
    const unit = product.units.find((u) => u.unitName === unitName);
    if (!unit) return;

    setCart((prev) => {
      const existing = prev.find(
        (item) => item.productId === product.id && item.unitName === unitName,
      );

      if (existing) {
        return prev.map((item) =>
          item.productId === product.id && item.unitName === unitName
            ? {
                ...item,
                quantity: item.quantity + quantity,
                total: (item.quantity + quantity) * item.price - item.discount,
              }
            : item,
        );
      }

      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          unitName,
          quantity,
          price: Number(unit.price),
          discount: 0,
          total: quantity * Number(unit.price),
          maxStock: Number(product.inventory?.quantity ?? 999),
        },
      ];
    });
  };

  const updateCartItem = (index: number, updates: Partial<CartItem>) => {
    setCart((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, ...updates };
        updated.total = updated.quantity * updated.price - updated.discount;
        return updated;
      }),
    );
  };

  const removeCartItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.total, 0);

  const handleCheckout = async (
    amountPaid: number,
    discount: number,
    paymentMethod: string,
  ) => {
    try {
      const sale = await api.sales.create({
        items: cart.map((item) => ({
          productId: item.productId,
          unitName: item.unitName,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount,
        })),
        discount,
        amountPaid,
        paymentMethod,
        terminalId: 'POS-01',
        userId: user?.id,
        userName: user?.name,
      });

      setReceipt(sale);
      setCart([]);
      setShowCheckout(false);
      loadTodaySummary();

      // Auto-print receipt if running in Electron
      if (window.electronPrinter) {
        window.electronPrinter.printReceipt(sale).catch((err) =>
          console.error('Auto-print failed:', err)
        );
      }
    } catch (err: any) {
      alert(err.message || 'Checkout failed');
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-blue-700 text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Tangub City Hardware</h1>
          <span className="text-blue-200 text-sm">POS Terminal</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right text-sm">
            <div className="text-blue-200">Today&apos;s Sales</div>
            <div className="font-bold">
              {todaySummary.totalSales} txns | PHP{' '}
              {Number(todaySummary.totalRevenue).toLocaleString('en-PH', {
                minimumFractionDigits: 2,
              })}
            </div>
          </div>
          <button
            onClick={() => setShowHistory(true)}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm"
          >
            Sales Today
          </button>
          {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
            <Link
              href="/admin"
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm"
            >
              Admin
            </Link>
          )}
          <button
            onClick={() => { auth.logout(); router.push('/login'); }}
            className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Product Search */}
        <div className="w-1/2 border-r border-gray-200 flex flex-col">
          <ProductSearch
            ref={searchRef}
            onAddToCart={addToCart}
          />
        </div>

        {/* Right: Cart */}
        <div className="w-1/2 flex flex-col bg-white">
          <Cart
            items={cart}
            onUpdateItem={updateCartItem}
            onRemoveItem={removeCartItem}
            subtotal={cartSubtotal}
            onCheckout={() => setShowCheckout(true)}
          />
        </div>
      </div>

      {/* Modals */}
      {showCheckout && (
        <CheckoutModal
          subtotal={cartSubtotal}
          itemCount={cart.length}
          onConfirm={handleCheckout}
          onClose={() => setShowCheckout(false)}
        />
      )}

      {receipt && (
        <ReceiptModal
          sale={receipt}
          onClose={() => setReceipt(null)}
        />
      )}

      {showHistory && (
        <SalesHistory onClose={() => setShowHistory(false)} cashier={user?.name} />
      )}
    </div>
  );
}
