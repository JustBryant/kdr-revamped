import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import Layout from '../../components/Layout';
import { LiveEffectPreview } from '../../components/LiveEffectPreview';
import axios from 'axios';
import { useRouter } from 'next/router';

interface Cosmetic {
    id: string;
    name: string;
    description: string;
    price: number;
    type: string;
    imageUrl: string;
    isSellable: boolean;
    metadata: any;
}

export default function AdminCosmeticShop() {
    const { data: session, status } = useSession();
    const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingItem, setEditingItem] = useState<Cosmetic | null>(null);
    const [activeTab, setActiveTab] = useState<any>('PROFILE_ICON');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>({});
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated' || (session?.user as any)?.role !== 'ADMIN') {
            router.push('/');
        }
    }, [status, session]);

    useEffect(() => {
        fetchCosmetics();
    }, [activeTab, page, search, status]);

    const fetchCosmetics = async () => {
        if (status !== 'authenticated') return;
        try {
            setLoading(true);
            const res = await axios.get('/api/admin/cosmetics', {
                params: {
                    type: activeTab,
                    page,
                    search,
                    limit: 50
                }
            });
            setCosmetics(res.data.items);
            setPagination(res.data.pagination);
        } catch (err) {
            console.error('Failed to fetch cosmetics', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;

        try {
            const res = await axios.put('/api/admin/cosmetics', {
                id: editingItem.id,
                name: editingItem.name,
                description: editingItem.description,
                price: editingItem.price,
                isSellable: editingItem.isSellable,
                type: editingItem.type,
            });
            setEditingItem(null);
            fetchCosmetics();
            alert('Updated successfully');
        } catch (err: any) {
            console.error('Update failed:', err.response?.data || err.message);
            alert(`Failed to update: ${err.response?.data?.message || err.message}`);
        }
    };

    if (status === 'loading') return null;

    return (
        <Layout>
            <Head>
                <title>Admin - Cosmetic Management</title>
            </Head>

            <div className="max-w-7xl mx-auto px-4 py-12">
                <header className="mb-12">
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white mb-4">
                        Cosmetic <span className="text-blue-600">Admin</span>
                    </h1>
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                         <div className="flex flex-wrap gap-2">
                            {['PROFILE_ICON', 'BORDER', 'FRAME', 'TITLE', 'BACKGROUND', 'CARD_EFFECT', 'ICON_EFFECT'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => { setActiveTab(tab); setPage(1); }}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        activeTab === tab ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    {tab.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text"
                            placeholder="Search cosmestics..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest"
                        />
                    </div>
                </header>

                {loading ? (
                    <div className="flex justify-center py-24"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {cosmetics.map((item) => (
                            <div key={item.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-3xl p-6 flex gap-6 items-start shadow-sm hover:shadow-md transition-all">
                                <div className="w-24 h-24 flex-shrink-0 bg-black/10 dark:bg-white/5 rounded-2xl overflow-hidden flex items-center justify-center border border-black/5">
                                    {(item.type === 'CARD_EFFECT' || item.type === 'ICON_EFFECT') ? (
                                        <LiveEffectPreview type={item.type as any} metadata={item.metadata} className="w-full h-full" />
                                    ) : (
                                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-black uppercase tracking-tight text-gray-900 dark:text-white truncate">{item.name}</h3>
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest border ${item.isSellable ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                                            {item.isSellable ? 'Active' : 'Hidden'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{item.description}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono font-black text-blue-600">{item.price} DP</span>
                                        <button 
                                            onClick={() => setEditingItem(item)}
                                            className="px-3 py-1.5 bg-gray-100 dark:bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300 transition-colors"
                                        >
                                            Edit
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {pagination.pages > 1 && (
                    <div className="mt-12 flex justify-center gap-2">
                        {Array.from({ length: pagination.pages }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setPage(i + 1)}
                                className={`w-10 h-10 rounded-xl font-black transition-all ${page === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-500'}`}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {editingItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingItem(null)}></div>
                    <form onSubmit={handleUpdate} className="relative bg-white dark:bg-zinc-900 border border-white/10 rounded-[2rem] p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-black uppercase tracking-tighter italic text-gray-900 dark:text-white mb-6">Edit <span className="text-blue-600">Cosmetic</span></h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 ml-1">Name</label>
                                <input
                                    type="text"
                                    value={editingItem.name}
                                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-blue-600/50"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 ml-1">Description</label>
                                <textarea
                                    value={editingItem.description || ''}
                                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-blue-600/50"
                                    rows={3}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 ml-1">Price (DP)</label>
                                    <input
                                        type="number"
                                        value={editingItem.price}
                                        onChange={(e) => setEditingItem({ ...editingItem, price: parseInt(e.target.value) })}
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-blue-600/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5 ml-1">Visibility</label>
                                    <select
                                        value={String(editingItem.isSellable)}
                                        onChange={(e) => setEditingItem({ ...editingItem, isSellable: e.target.value === 'true' })}
                                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-blue-600/50"
                                    >
                                        <option value="true">Active (Purchasable)</option>
                                        <option value="false">Hidden (Owner Only)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setEditingItem(null)}
                                className="flex-1 py-4 bg-gray-100 dark:bg-white/5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all active:scale-95"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </Layout>
    );
}
