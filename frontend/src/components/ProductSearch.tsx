'use client';

import { useState, useEffect, forwardRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { Product } from '@/lib/types';

interface Props {
  onAddToCart: (product: Product, unitName: string, quantity: number) => void;
}

export const ProductSearch = forwardRef<HTMLInputElement, Props>(
  function ProductSearch({ onAddToCart }, ref) {
    const [search, setSearch] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState<Record<string, string>>({});
    const [quantities, setQuantities] = useState<Record<string, number>>({});

    const loadProducts = useCallback(async (query: string) => {
      setLoading(true);
      try {
        const results = query
          ? await api.products.search(query)
          : await api.products.getAll();
        setProducts(Array.isArray(results) ? results : results.data ?? []);
      } catch {
        // offline — show empty
      }
      setLoading(false);
    }, []);

    useEffect(() => {
      loadProducts('');
    }, [loadProducts]);

    useEffect(() => {
      const timer = setTimeout(() => loadProducts(search), 300);
      return () => clearTimeout(timer);
    }, [search, loadProducts]);

    const handleAdd = (product: Product) => {
      const unitName =
        selectedUnit[product.id] || product.units[0]?.unitName || 'piece';
      const qty = quantities[product.id] || 1;
      onAddToCart(product, unitName, qty);
      setQuantities((prev) => ({ ...prev, [product.id]: 1 }));
    };

    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 bg-white">
          <input
            ref={ref}
            type="text"
            placeholder="Search products by name, SKU, or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Searching...</div>
          ) : products.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No products found
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {product.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        SKU: {product.sku}
                        {product.barcode && ` | ${product.barcode}`}
                      </p>
                      <div className="mt-1 text-sm">
                        <span
                          className={`font-medium ${
                            Number(product.inventory?.quantity ?? 0) <=
                            Number(product.inventory?.lowStock ?? 0)
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}
                        >
                          Stock: {Number(product.inventory?.quantity ?? 0)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {/* Unit selector */}
                      {product.units.length > 1 && (
                        <select
                          value={
                            selectedUnit[product.id] ||
                            product.units[0]?.unitName
                          }
                          onChange={(e) =>
                            setSelectedUnit((prev) => ({
                              ...prev,
                              [product.id]: e.target.value,
                            }))
                          }
                          className="border border-gray-300 rounded px-2 py-2 text-sm"
                        >
                          {product.units.map((u) => (
                            <option key={u.id} value={u.unitName}>
                              {u.unitName} - PHP{' '}
                              {Number(u.price).toFixed(2)}
                            </option>
                          ))}
                        </select>
                      )}

                      {product.units.length === 1 && (
                        <span className="text-sm font-medium text-gray-700 px-2">
                          {product.units[0].unitName} - PHP{' '}
                          {Number(product.units[0].price).toFixed(2)}
                        </span>
                      )}

                      {/* Quantity */}
                      <input
                        type="number"
                        min="1"
                        value={quantities[product.id] || 1}
                        onChange={(e) =>
                          setQuantities((prev) => ({
                            ...prev,
                            [product.id]: Math.max(
                              1,
                              parseInt(e.target.value) || 1,
                            ),
                          }))
                        }
                        className="w-16 border border-gray-300 rounded px-2 py-2 text-center text-sm"
                      />

                      {/* Add button */}
                      <button
                        onClick={() => handleAdd(product)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium text-sm whitespace-nowrap"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  },
);
