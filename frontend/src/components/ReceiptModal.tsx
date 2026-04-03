'use client';

interface Props {
  sale: any;
  onClose: () => void;
}

export function ReceiptModal({ sale, onClose }: Props) {
  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="modal-panel bg-white w-full max-w-sm overflow-hidden"
        style={{
          borderRadius: '16px',
          boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.35)',
        }}
      >
        {/* Receipt Header */}
        <div
          className="text-center px-6 pt-7 pb-5"
          style={{ background: 'linear-gradient(160deg, #1e3a5f 0%, #1d4ed8 100%)' }}
        >
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <h2 className="text-white font-bold text-base tracking-wide">Tangub City Hardware</h2>
          <p className="text-blue-200 text-xs mt-0.5 font-medium">Official Receipt</p>
          <p className="font-code text-white/90 text-xs mt-2 tracking-wider">{sale.receiptNumber}</p>
          <p className="text-blue-200 text-xs mt-1">
            {new Date(sale.createdAt).toLocaleString('en-PH', {
              month: 'short', day: 'numeric', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Line Items */}
          <div className="space-y-2.5">
            {sale.items?.map((item: any) => (
              <div key={item.id} className="flex justify-between items-start gap-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-slate-800 font-medium leading-tight truncate">
                    {item.product?.name || item.productId}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    ×{item.quantity} {item.unitName}
                  </p>
                </div>
                <span className="font-amount text-slate-700 font-medium whitespace-nowrap">
                  PHP {Number(item.total).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <hr className="receipt-dash" />

          {/* Totals */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="font-amount">PHP {Number(sale.subtotal).toFixed(2)}</span>
            </div>
            {Number(sale.discount) > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Discount</span>
                <span className="font-amount">−PHP {Number(sale.discount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-1">
              <span className="font-bold text-slate-900 text-base">Total</span>
              <span className="font-amount font-bold text-slate-900 text-xl">
                PHP {Number(sale.total).toFixed(2)}
              </span>
            </div>
          </div>

          <hr className="receipt-dash" />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-500">
              <span className="capitalize">Paid · {sale.paymentMethod}</span>
              <span className="font-amount">PHP {Number(sale.amountPaid).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-emerald-600 font-semibold">
              <span>Change</span>
              <span className="font-amount">PHP {Number(sale.change).toFixed(2)}</span>
            </div>
          </div>

          <hr className="receipt-dash" />

          <p className="text-center text-xs text-slate-400 tracking-wide">
            Thank you for your purchase!
          </p>
        </div>

        {/* Action */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-sm tracking-wide transition-colors shadow-sm shadow-blue-200"
          >
            New Transaction
          </button>
        </div>
      </div>
    </div>
  );
}
