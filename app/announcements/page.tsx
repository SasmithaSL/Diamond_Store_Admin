'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import Toast from '@/components/Toast';

interface Announcement {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  is_active: number | boolean;
  created_at: string;
  updated_at?: string;
}

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function AnnouncementsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'success',
    is_active: true,
  });

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    fetchAnnouncements();
  }, [router]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const response = await api.get('/announcements');
      setAnnouncements(response.data.announcements || []);
    } catch (err: any) {
      console.error('Failed to fetch announcements:', err);
      showToast(err.response?.data?.error || 'Failed to load announcements', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ title: '', message: '', type: 'info', is_active: true });
    setShowModal(true);
  };

  const openEditModal = (a: Announcement) => {
    setEditingId(a.id);
    setFormData({
      title: a.title,
      message: a.message,
      type: a.type,
      is_active: Boolean(a.is_active),
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/announcements/${editingId}`, formData);
        showToast('Announcement updated successfully', 'success');
      } else {
        await api.post('/announcements', formData);
        showToast('Announcement created successfully', 'success');
      }
      closeModal();
      fetchAnnouncements();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save announcement', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await api.delete(`/announcements/${id}`);
      showToast('Announcement deleted', 'success');
      fetchAnnouncements();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete', 'error');
    }
  };

  const toggleActive = async (a: Announcement) => {
    try {
      await api.put(`/announcements/${a.id}`, { is_active: !a.is_active });
      showToast(a.is_active ? 'Announcement hidden' : 'Announcement activated', 'success');
      fetchAnnouncements();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to update', 'error');
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'info': return 'bg-blue-100 text-blue-800';
      case 'warning': return 'bg-amber-100 text-amber-800';
      case 'success': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (val: string) => {
    const d = new Date(val);
    return isNaN(d.getTime()) ? val : d.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <div className={`lg:pl-64 transition-all duration-300 ${sidebarOpen ? 'lg:ml-0' : ''}`}>
        <header className="bg-white shadow-sm border-b sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center gap-4">
              <h1 className="text-xl font-bold text-gray-800">Announcements</h1>
              <button
                onClick={openCreateModal}
                className="rounded-lg bg-primary-600 px-4 py-2 text-white font-semibold hover:bg-primary-700 transition"
              >
                + New Announcement
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <p className="text-gray-600 mb-4">
            Create and manage announcements or notices that appear on the frontend (home page and user dashboard).
          </p>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
              <p className="text-lg">No announcements yet.</p>
              <p className="mt-2">Click &quot;New Announcement&quot; to create one.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-xl border bg-white p-4 sm:p-5 shadow-sm ${
                    a.is_active ? 'border-gray-200' : 'border-gray-200 bg-gray-50 opacity-75'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-900">{a.title}</h2>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(a.type)}`}>
                          {a.type}
                        </span>
                        {!a.is_active && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-gray-600 whitespace-pre-wrap">{a.message}</p>
                      <p className="mt-2 text-xs text-gray-400">{formatDate(a.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleActive(a)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                          a.is_active
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                      >
                        {a.is_active ? 'Hide' : 'Activate'}
                      </button>
                      <button
                        onClick={() => openEditModal(a)}
                        className="px-3 py-1.5 rounded-lg bg-primary-100 text-primary-700 hover:bg-primary-200 text-sm font-medium transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm font-medium transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Edit Announcement' : 'New Announcement'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Announcement title"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[120px]"
                  placeholder="Announcement message..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'info' | 'warning' | 'success' })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">Active (visible on frontend)</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary-600 py-2 text-white font-semibold hover:bg-primary-700 transition"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
