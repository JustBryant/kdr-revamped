import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';

type Cosmetic = {
    id: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    type: 'BORDER' | 'FRAME' | 'TITLE' | 'BACKGROUND' | 'PROFILE_ICON';
};

type PaginationData = {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

export default function CosmeticShop() {
    const { data: session, status } = useSession();
    const [cosmetics, setCosmetics] = useState<Cosmetic[]>([]);
    const [ownedIds, setOwnedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Cosmetic['type']>('BORDER');
    
    // Pagination and Search
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<PaginationData | null>(null);

    // Loot Crate State
    const [openingCrate, setOpeningCrate] = useState(false);
    const [crateResult, setCrateResult] = useState<Cosmetic | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCosmetics();
        }, search ? 500 : 0);
        return () => clearTimeout(timer);
    }, [status, activeTab, page, search]);

    const handleLootCrate = async () => {
        if (!session) return alert('Please sign in to buy a crate!');
        try {
            setOpeningCrate(true);
            setCrateResult(null);
            
            // Animation Delay
            await new Promise(r => setTimeout(r, 2000));
            
            const res = await axios.post('/api/shop/loot-crate');
            setCrateResult(res.data.item);
            setOwnedIds(prev => [...prev, res.data.item.id]);
        } catch (err: any) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to open loot crate.');
        } finally {
            setOpeningCrate(false);
        }
    };

    const fetchCosmetics = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/shop/cosmetics', {
                params: {
                    type: activeTab,
                    page,
                    search,
                    limit: 24
                }
            });
            setCosmetics(res.data.cosmetics);
            setOwnedIds(res.data.ownedIds);
            setPagination(res.data.pagination);
        } catch (err) {
            console.error('Failed to fetch cosmetics', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async (id: string) => {
        if (!session) return alert('Please sign in to purchase cosmetics!');
        try {
            setPurchasing(id);
            await axios.post('/api/shop/cosmetics', { itemId: id });
            setOwnedIds([...ownedIds, id]);
            alert('Success! You now own this item.');
        } catch (err) {
            console.error(err);
            alert('Failed to purchase item.');
        } finally {
            setPurchasing(null);
        }
    };

    const handleEquip = async (id: string, type: Cosmetic['type']) => {
        try {
            await axios.post('/api/user/equip', { itemId: id, cosmeticType: type });
            alert('Item equipped successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to equip item.');
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-12 min-h-screen">
            <header className="mb-12 text-center">
                <h1 className="text-5xl font-black italic uppercase tracking-tighter text-gray-800 dark:text-white mb-4">
                    Cosmetic <span className="text-blue-600">Shop</span>
                </h1>
                <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-sm">
                    Enhance your profile with custom borders and frames
                </p>
            </header>

            {/* Loot Crate Section */}
            <div className="mb-16 bg-gradient-to-r from-blue-600 to-indigo-900 rounded-[3rem] p-1 shadow-2xl overflow-hidden group">
                <div className="bg-white/10 backdrop-blur-3xl rounded-[2.9rem] p-8 md:p-12 flex flex-col md:flex-row items-center gap-12 relative overflow-hidden">
                    {/* Animated background particles */}
                    <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full blur-3xl animate-pulse"></div>
                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-400 rounded-full blur-3xl animate-pulse delay-700"></div>
                    </div>

                    <div className="relative z-10 flex-shrink-0 group-hover:rotate-6 transition-transform duration-500">
                        <div className="w-48 h-48 bg-white/20 rounded-[2rem] border-4 border-white/30 flex items-center justify-center shadow-2xl">
                            <span className="text-8xl">🎁</span>
                        </div>
                    </div>

                    <div className="relative z-10 flex-1 text-center md:text-left">
                        <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white mb-4 leading-none">
                            Daily <span className="text-blue-300">Crate</span>
                        </h2>
                        <p className="text-blue-100 font-medium text-lg mb-8 max-w-lg">
                            Open a mystery crate for only <span className="font-black">500 G</span> for a chance to win a random <span className="font-black italic">Ultra Rare</span> profile icon!
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-6 justify-center md:justify-start">
                            <button
                                onClick={handleLootCrate}
                                disabled={openingCrate}
                                className="group/btn px-12 py-5 bg-white text-blue-900 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-xl hover:scale-110 active:scale-95 disabled:opacity-50"
                            >
                                {openingCrate ? 'OPENING...' : 'BUY CRATE'}
                            </button>
                            <span className="text-white/50 font-black uppercase tracking-widest text-[10px]">
                                Available every 24 hours
                            </span>
                        </div>
                    </div>

                    {/* Result Overlay */}
                    {(openingCrate || crateResult) && (
                        <div className="absolute inset-0 z-50 bg-blue-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
                            {openingCrate ? (
                                <div className="space-y-8 animate-bounce">
                                    <div className="text-9xl mb-4">📦</div>
                                    <div className="text-3xl font-black italic uppercase tracking-tighter text-white">Opening Loot Crate...</div>
                                    <div className="flex justify-center gap-2">
                                        <div className="w-4 h-4 bg-white rounded-full animate-ping"></div>
                                        <div className="w-4 h-4 bg-white rounded-full animate-ping delay-100"></div>
                                        <div className="w-4 h-4 bg-white rounded-full animate-ping delay-200"></div>
                                    </div>
                                </div>
                            ) : crateResult && (
                                <div className="space-y-6 animate-in slide-in-from-bottom duration-700">
                                    <div className="text-white/50 font-black uppercase tracking-widest text-xs mb-2">You Unlocked</div>
                                    <div className="w-64 h-64 mx-auto rounded-3xl overflow-hidden border-8 border-yellow-400 shadow-[0_0_50px_rgba(250,204,21,0.5)] bg-white/10 p-2 transform rotate-2 animate-pulse">
                                        <img src={crateResult.imageUrl} className="w-full h-full object-cover rounded-2xl shadow-inner" alt={crateResult.name} />
                                    </div>
                                    <h3 className="text-5xl font-black italic uppercase tracking-tighter text-white drop-shadow-2xl">
                                        {crateResult.name}
                                    </h3>
                                    <button
                                        onClick={() => setCrateResult(null)}
                                        className="mt-8 px-10 py-4 bg-yellow-400 text-blue-950 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white transition-all transform hover:scale-105"
                                    >
                                        Epic!
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-8 mb-12">
                <div className="flex flex-wrap justify-center gap-4">
                    {['BORDER', 'FRAME', 'TITLE', 'BACKGROUND', 'PROFILE_ICON'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 border-2 ${
                                activeTab === tab
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-105'
                                    : 'bg-white/5 border-gray-100 dark:border-white/5 text-gray-400 hover:border-blue-600/50'
                            }`}
                        >
                            {tab.replace('_', ' ')}{tab.endsWith('N') ? '' : 'S'}
                        </button>
                    ))}
                </div>

                <div className="relative max-w-xl mx-auto w-full group">
                    <input
                        type="text"
                        placeholder={`Search ${activeTab.toLowerCase().replace('_', ' ')}s...`}
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="w-full bg-white dark:bg-white/5 border-2 border-gray-100 dark:border-white/5 rounded-2xl px-12 py-4 text-gray-800 dark:text-white font-bold tracking-widest text-xs uppercase focus:border-blue-600/50 focus:outline-none transition-all duration-300"
                    />
                    <svg
                        className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-600 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-24">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {cosmetics.length === 0 ? (
                            <div className="col-span-full text-center py-24 bg-white/5 rounded-3xl border border-dashed border-gray-200 dark:border-white/10">
                                <p className="text-gray-400 font-bold uppercase tracking-widest">No items available in this category.</p>
                            </div>
                        ) : (
                            cosmetics.map((item) => {
                                const isOwned = ownedIds.includes(item.id);
                                return (
                                    <div key={item.id} className="group relative bg-white dark:bg-white/5 rounded-[2rem] p-6 border border-gray-100 dark:border-white/10 overflow-hidden shadow-xl transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl">
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        
                                        <div className="relative z-10">
                                            <div className="w-full aspect-square bg-black/10 dark:bg-white/5 rounded-2xl mb-6 flex items-center justify-center overflow-hidden border border-black/5 dark:border-white/5 relative">
                                                {item.imageUrl ? (
                                                    <div className="relative w-full h-full">
                                                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-zinc-900 animate-pulse z-0 rounded-2xl">
                                                            <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
                                                        </div>
                                                        <img 
                                                            src={item.imageUrl} 
                                                            alt={item.name} 
                                                            className="w-full h-full object-cover relative z-10 opacity-0 transition-opacity duration-300 rounded-2xl" 
                                                            onLoad={(e) => {
                                                                (e.target as HTMLImageElement).classList.remove('opacity-0');
                                                                (e.target as HTMLImageElement).parentElement?.querySelector('.animate-pulse')?.classList.add('hidden');
                                                            }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="text-gray-500 dark:text-white/10 font-black italic text-4xl uppercase tracking-tighter opacity-20">NO PREVIEW</div>
                                                )}
                                            </div>

                                            <h3 className="text-xl font-black italic uppercase tracking-tighter text-gray-800 dark:text-white mb-2 leading-none">
                                                {item.name}
                                            </h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 line-clamp-2 min-h-[2.5rem]">
                                                {item.description}
                                            </p>

                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">Price</span>
                                                    <span className="text-xl font-black text-blue-600 dark:text-blue-400 italic font-mono">{item.price} G</span>
                                                </div>

                                                {isOwned ? (
                                                    <button
                                                        onClick={() => handleEquip(item.id, item.type)}
                                                        className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                                                    >
                                                        Equip
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handlePurchase(item.id)}
                                                        disabled={purchasing !== null}
                                                        className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                                                    >
                                                        {purchasing === item.id ? 'Buying...' : 'Purchase'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {pagination && pagination.totalPages > 1 && (
                        <div className="mt-16 flex justify-center items-center gap-4">
                            <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page === 1}
                                className="px-6 py-3 bg-white dark:bg-white/5 border-2 border-gray-100 dark:border-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest disabled:opacity-20 transition-all hover:border-blue-600/50"
                            >
                                Previous
                            </button>
                            
                            <span className="font-black italic text-gray-400 text-xs">
                                Page <span className="text-blue-600">{page}</span> of {pagination.totalPages}
                            </span>

                            <button
                                onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                                disabled={page === pagination.totalPages}
                                className="px-6 py-3 bg-white dark:bg-white/5 border-2 border-gray-100 dark:border-white/5 rounded-2xl font-black uppercase text-[10px] tracking-widest disabled:opacity-20 transition-all hover:border-blue-600/50"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

