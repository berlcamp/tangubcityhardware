'use client';

import { CartItem } from '@/lib/types';

interface Props {
  items: CartItem[];
  onUpdateItem: (index: number, updates: Partial<CartItem>) => void;
  onRemoveItem: (index: number) => void;
  subtotal: number;
  onCheckout: () => void;
}

export function Cart({
  items,
  onUpdateItem,
  onRemoveItem,
  subtotal,
  onCheckout,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-bold text-gray-800">
          Cart ({items.length} {items.length === 1 ? 'item' : 'items'})
        </h2>
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <p className="text-lg">Cart is empty</p>
              <p className="text-sm mt-1">Search and add products to begin</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item, index) => (
              <div key={`${item.productId}-${item.unitName}`} className="px-6 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {item.productName}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {item.unitName} @ PHP {item.price.toFixed(2)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Quantity controls */}
                    <div className="flex items-center border border-gray-300 rounded">
                      <button
                        onClick={() =>
                          onUpdateItem(index, {
                            quantity: Math.max(1, item.quantity - 1),
                          })
                        }
                        className="px-2 py-1 hover:bg-gray-100 text-gray-600"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          onUpdateItem(index, {
                            quantity: Math.max(
                              1,
                              parseFloat(e.target.value) || 1,
                            ),
                          })
                        }
                        className="w-14 text-center py-1 border-x border-gray-300 outline-none text-sm"
                      />
                      <button
                        onClick={() =>
                          onUpdateItem(index, {
                            quantity: item.quantity + 1,
                          })
                        }
                        className="px-2 py-1 hover:bg-gray-100 text-gray-600"
                      >
                        +
                      </button>
                    </div>

                    {/* Item total */}
                    <div className="w-24 text-right font-medium">
                      PHP {item.total.toFixed(2)}
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => onRemoveItem(index)}
                      className="text-red-500 hover:text-red-700 text-sm px-2"
                    >
                      X
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals and checkout */}
      <div className="border-t border-gray-200 bg-gray-50 p-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-xl font-bold text-gray-800">Total</span>
          <span className="text-2xl font-bold text-blue-700">
            PHP {subtotal.toFixed(2)}
          </span>
        </div>
        <button
          onClick={onCheckout}
          disabled={items.length === 0}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-4 rounded-lg text-lg font-bold transition-colors"
        >
          Checkout
        </button>
      </div>
    </div>
  );
}
