'use client';

import { useState } from 'react';

interface Props {
  subtotal: number;
  itemCount: number;
  onConfirm: (amountPaid: number, discount: number, paymentMethod: string) => void;
  onClose: () => void;
}

const PAYMENT_METHODS = [
  { id: 'cash',  label: 'Cash' },
  { id: 'gcash', label: 'GCash' },
  { id: 'card',  label: 'Card' },
];

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

export function CheckoutModal({ subtotal, itemCount, onConfirm, onClose }: Props) {
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const total = subtotal - discount;
  const change = amountPaid - total;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div className="modal-panel bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
           style={{ boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.35)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
             style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Checkout</h2>
            <p className="text-xs text-slate-500 mt-0.5">{itemCount} item{itemCount !== 1 ? 's' : ''} in cart</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Order Summary */}
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Order Summary</p>
            </div>
            <div className="px-4 py-3 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="text-slate-800 font-medium font-amount">PHP {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600">Discount</span>
                <input
                  type="number"
                  value={discount || ''}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-28 text-right border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="px-4 py-3 bg-blue-50 border-t border-blue-100 flex justify-between items-center">
              <span className="text-sm font-semibold text-blue-900">Total Due</span>
              <span className="font-amount text-2xl font-bold text-blue-700">PHP {total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Payment Method</p>
            <div className="flex gap-2">
              {PAYMENT_METHODS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setPaymentMethod(id)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all duration-150 ${
                    paymentMethod === id
                      ? 'bg-blue-700 text-white border-blue-700 shadow-sm shadow-blue-200'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Paid */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Amount Tendered</p>
            <input
              type="number"
              value={amountPaid || ''}
              onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 font-amount text-2xl text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300"
              placeholder="0.00"
              autoFocus
            />
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmountPaid(amt)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-medium border border-slate-200 hover:border-slate-300 transition-all"
                >
                  {amt.toLocaleString()}
                </button>
              ))}
              <button
                onClick={() => setAmountPaid(Math.ceil(total))}
                className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full text-xs font-semibold border border-blue-200 transition-all"
              >
                Exact
              </button>
            </div>
          </div>

          {/* Change Display */}
          {amountPaid > 0 && (
            <div className={`rounded-xl p-4 text-center border ${
              change >= 0
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                change >= 0 ? 'text-emerald-600' : 'text-red-500'
              }`}>
                {change >= 0 ? 'Change' : 'Insufficient'}
              </p>
              <p className={`font-amount text-3xl font-bold ${
                change >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}>
                PHP {Math.abs(change).toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(amountPaid, discount, paymentMethod)}
            disabled={change < 0 || amountPaid <= 0}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-sm shadow-emerald-200 disabled:shadow-none"
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  );
}
