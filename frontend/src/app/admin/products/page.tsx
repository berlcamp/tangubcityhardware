'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Pagination } from '@/components/Pagination';

type Unit = { unitName: string; price: number; conversionFactor: number };
type Product = {
  id: string; name: string; sku: string; barcode?: string;
  basePrice: number; isActive: boolean;
  units: Unit[];
};

const emptyForm = {
  name: '', sku: '', barcode: '', basePrice: '', isActive: true,
  units: [{ unitName: 'piece', price: '', conversionFactor: '1' }],
};

const LIMIT = 20;

export default function ProductsAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback((p = page, s = search) => {
    setLoading(true);
    api.products.getAll(p, LIMIT, s || undefined)
      .then((res: any) => {
        setProducts(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku, barcode: p.barcode || '', isActive: p.isActive,
      basePrice: String(p.basePrice),
      units: p.units.map(u => ({ unitName: u.unitName, price: String(u.price), conversionFactor: String(u.conversionFactor) })),
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const data = {
        name: form.name,
        sku: form.sku,
        barcode: form.barcode || undefined,
        basePrice: Number(form.basePrice),
        isActive: form.isActive,
        units: form.units.map(u => ({
          unitName: u.unitName,
          price: Number(u.price),
          conversionFactor: Number(u.conversionFactor),
        })),
      };
      if (editing) {
        await api.products.update(editing.id, data);
      } else {
        await api.products.create(data);
      }
      setShowForm(false);
      load();
    } catch (e: any) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.products.delete(id);
      load(page, search);
    } catch (e: any) {
      alert(e.message || 'Delete failed');
    }
  };

  const addUnit = () => {
    setForm(f => ({ ...f, units: [...f.units, { unitName: '', price: '', conversionFactor: '1' }] }));
  };

  const removeUnit = (i: number) => {
    setForm(f => ({ ...f, units: f.units.filter((_, idx) => idx !== i) }));
  };

  const updateUnit = (i: number, field: string, value: string) => {
    setForm(f => ({ ...f, units: f.units.map((u, idx) => idx === i ? { ...u, [field]: value } : u) }));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Products</h2>
        <button
          onClick={openCreate}
          className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add Product
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search products..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-600">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Units</th>
                <th className="px-4 py-3 text-right">Base Price</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-gray-500">{p.sku}</td>
                  <td className="px-4 py-3 text-gray-500">{p.units.map(u => u.unitName).join(', ')}</td>
                  <td className="px-4 py-3 text-right">PHP {Number(p.basePrice).toLocaleString()}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline mr-3">Edit</button>
                    <button onClick={() => handleDelete(p.id, p.name)} className="text-red-500 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No products found</td></tr>
              )}
            </tbody>
          </table>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={LIMIT}
          onPageChange={p => setPage(p)}
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div
          className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="modal-panel bg-white rounded-2xl w-full max-w-lg overflow-hidden flex flex-col"
            style={{ maxHeight: '90vh', boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.35)' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
                 style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
              <div>
                <h3 className="font-semibold text-slate-900 tracking-tight">
                  {editing ? 'Edit Product' : 'Add Product'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editing ? `Editing: ${editing.name}` : 'Fill in the details below'}
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              {/* Basic Info Section */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Product Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Product Name</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="e.g. Portland Cement 40kg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">SKU</label>
                    <input
                      value={form.sku}
                      onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-code"
                      placeholder="SKU-001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Barcode</label>
                    <input
                      value={form.barcode}
                      onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-code"
                      placeholder="Optional"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Base Price (PHP)</label>
                    <input
                      type="number"
                      value={form.basePrice}
                      onChange={e => setForm(f => ({ ...f, basePrice: e.target.value }))}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          id="isActive"
                          checked={form.isActive}
                          onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                          className="sr-only"
                        />
                        <div className={`w-10 h-5.5 rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-slate-300'}`}
                             style={{ height: '22px' }}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">Active product</p>
                        <p className="text-xs text-slate-400">Visible and selectable in POS</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Units Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Units & Pricing</p>
                  <button
                    onClick={addUnit}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    + Add Unit
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <p className="flex-1 text-xs text-slate-400 font-medium">Unit Name</p>
                    <p className="w-24 text-xs text-slate-400 font-medium">Price (PHP)</p>
                    <p className="w-20 text-xs text-slate-400 font-medium">Qty / Unit</p>
                    <div className="w-7 flex-shrink-0" />
                  </div>
                  {form.units.map((u, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        placeholder="e.g. bag, piece"
                        value={u.unitName}
                        onChange={e => updateUnit(i, 'unitName', e.target.value)}
                        className="flex-1 border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                      <input
                        placeholder="0.00"
                        type="number"
                        value={u.price}
                        onChange={e => updateUnit(i, 'price', e.target.value)}
                        className="w-24 border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                      <input
                        placeholder="1"
                        type="number"
                        value={u.conversionFactor}
                        onChange={e => updateUnit(i, 'conversionFactor', e.target.value)}
                        className="w-20 border border-slate-200 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                      {form.units.length > 1 && (
                        <button
                          onClick={() => removeUnit(i)}
                          className="w-7 h-7 flex items-center justify-center rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all text-lg leading-none flex-shrink-0"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-slate-400">Qty / Unit = how many base units make up this unit (e.g. a bundle of 6 pieces → enter 6)</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-200"
              >
                {saving ? 'Saving…' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
