import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { LiveEffectPreview } from '../../components/LiveEffectPreview';

type Cosmetic = {
    id: string;
    name: string;
    description: string;
    price: number;
    imageUrl: string;
    type: 'BORDER' | 'FRAME' | 'TITLE' | 'BACKGROUND' | 'PROFILE_ICON' | 'CARD_EFFECT' | 'ICON_EFFECT' | 'ALL';
    metadata?: any;
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
    const [userPoints, setUserPoints] = useState(0);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Cosmetic['type']>('PROFILE_ICON');
    const [activeEffectTab, setActiveEffectTab] = useState<'ALL' | 'CARD_EFFECT' | 'ICON_EFFECT'>('ALL');
    
    // Preview Selection
    const [selectedItem, setSelectedItem] = useState<Cosmetic | null>(null);

    // Pagination and Search
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<PaginationData | null>(null);

    // Loot Crate State
    const [openingCrate, setOpeningCrate] = useState(false);
    const [crateResult, setCrateResult] = useState<Cosmetic | null>(null);

    const isEffectTab = activeTab === 'CARD_EFFECT' || activeTab === 'ICON_EFFECT' || activeTab === 'ALL';

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCosmetics();
        }, search ? 500 : 0);
        return () => clearTimeout(timer);
    }, [status, activeTab, activeEffectTab, page, search]);

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
            setUserPoints(prev => prev - (res.data.item.price || 0)); // Note: Loot crate might have fixed price
            window.dispatchEvent(new CustomEvent('user:stats-refresh'));
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
                    type: activeTab === 'ALL' ? activeEffectTab : activeTab,
                    page,
                    search,
                    limit: 24
                }
            });
            setCosmetics(res.data.cosmetics);
            setOwnedIds(res.data.ownedIds);
            setUserPoints(res.data.userPoints);
            setPagination(res.data.pagination);
        } catch (err) {
            console.error('Failed to fetch cosmetics', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async (item: Cosmetic) => {
        if (!session) return alert('Please sign in to purchase cosmetics!');
        if (userPoints < item.price) {
            alert(`Insufficient Funds! You need ${item.price - userPoints} more DP.`);
            return;
        }

        try {
            setPurchasing(item.id);
            await axios.post('/api/shop/cosmetics', { itemId: item.id });
            setOwnedIds([...ownedIds, item.id]);
            setUserPoints(prev => prev - item.price);
            // Refresh gold display or user stats if needed
            window.dispatchEvent(new CustomEvent('user:stats-refresh'));
            alert('Success! You now own this item.');
        } catch (err: any) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to purchase item.');
        } finally {
            setPurchasing(null);
        }
    };

    const handleEquip = async (id: string, type: Cosmetic['type']) => {
        try {
            await axios.post('/api/user/equip', { itemId: id, cosmeticType: type });
            
            // Dispatch a refresh event for the navbar/profile
            window.dispatchEvent(new CustomEvent('user:stats-refresh'));
            
            alert('Item equipped successfully!');
        } catch (err) {
            console.error(err);
            alert('Failed to update equipment.');
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-12 min-h-screen">
            <header className="mb-12 text-center relative">
                <div className="absolute top-0 right-0 hidden md:flex flex-col items-end">
                    <div className="bg-blue-600/10 border border-blue-600/20 rounded-2xl p-4 flex items-center gap-3 backdrop-blur-sm">
                        <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/40">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="flex flex-col items-start leading-tight">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600/60">Your Balance</span>
                            <span className="text-xl font-black italic tracking-tighter text-gray-800 dark:text-white">{userPoints.toLocaleString()} DP</span>
                        </div>
                    </div>
                </div>

                <h1 className="text-5xl font-black italic uppercase tracking-tighter text-gray-800 dark:text-white mb-4">
                    Cosmetic <span className="text-blue-600">Shop</span>
                </h1>
                <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-sm">
                    Enhance your profile with custom borders and frames
                </p>
            </header>

            <div className="flex flex-col gap-8 mb-12">
                <div className="flex flex-wrap justify-center gap-4">
                    {['PROFILE_ICON', 'BORDER', 'FRAME', 'TITLE', 'BACKGROUND', 'EFFECTS'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => {
                                if (tab === 'EFFECTS') {
                                    setActiveTab('ALL');
                                } else {
                                    setActiveTab(tab as any);
                                }
                                setSearch('');
                                setPage(1);
                            }}
                            className={`px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 border-2 ${
                                (tab === 'EFFECTS' && (activeTab === 'ALL' || activeTab === 'CARD_EFFECT' || activeTab === 'ICON_EFFECT')) || activeTab === tab
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)] scale-105'
                                    : 'bg-white/5 border-gray-100 dark:border-white/5 text-gray-400 hover:border-blue-600/50'
                            }`}
                        >
                            {tab.replace('_', ' ')}{tab.endsWith('S') ? '' : (tab.endsWith('N') ? '' : 'S')}
                        </button>
                    ))}
                </div>

                {(activeTab === 'ALL' || activeTab === 'CARD_EFFECT' || activeTab === 'ICON_EFFECT') && (
                    <div className="flex justify-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                        {['ALL', 'CARD_EFFECT', 'ICON_EFFECT'].map((efType) => (
                            <button
                                key={efType}
                                onClick={() => {
                                    setActiveEffectTab(efType as any);
                                    setActiveTab(efType as any);
                                    setSearch('');
                                    setPage(1);
                                }}
                                className={`px-6 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border ${
                                    (activeTab === efType)
                                        ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                                        : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                {efType.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                )}

                <div className="relative max-w-xl mx-auto w-full group">
                    <input
                        type="text"
                        placeholder={`Search ${activeTab === 'ALL' ? 'effects' : activeTab.toLowerCase().replace('_', ' ') + (activeTab.endsWith('S') ? '' : 's')}...`}
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
                                                {(item.type === 'CARD_EFFECT' || item.type === 'ICON_EFFECT') ? (
                                                    <LiveEffectPreview 
                                                        type={item.type as any} 
                                                        metadata={item.metadata} 
                                                        className="w-full h-full"
                                                    />
                                                ) : item.imageUrl ? (
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
                                                    <span className="text-xl font-black text-blue-600 dark:text-blue-400 italic font-mono">{item.price} DP</span>
                                                </div>

                                                <div className="flex gap-2">
                                                    {isOwned ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEquip(item.id, item.type);
                                                            }}
                                                            className={`flex-1 px-4 py-3 text-white rounded-xl font-black uppercase tracking-[0.1em] text-[10px] transition-all shadow-lg active:scale-95 bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20`}
                                                    >
                                                        Equip
                                                    </button>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePurchase(item);
                                                            }}
                                                            disabled={purchasing !== null || userPoints < item.price}
                                                            className={`flex-1 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg active:scale-95 ${
                                                                userPoints < item.price 
                                                                ? 'bg-gray-100 dark:bg-white/5 text-gray-400 cursor-not-allowed' 
                                                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                                                            }`}
                                                        >
                                                            {purchasing === item.id ? '...' : (userPoints < item.price ? 'Locked' : 'Buy')}
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedItem(item);
                                                        }}
                                                        className="px-4 py-2 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-800 dark:text-gray-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-gray-200 dark:border-white/10"
                                                    >
                                                        View
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Cosmetic Preview Modal */}
                    {selectedItem && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
                            <div className="absolute inset-0 bg-white/5 dark:bg-black/40 backdrop-blur-md" onClick={() => setSelectedItem(null)}></div>
                            
                            <div className="relative bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-[3rem] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row shadow-[0_30px_100px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300">
                                {/* Close Button */}
                                <button 
                                    onClick={() => setSelectedItem(null)}
                                    className="absolute top-8 right-8 z-[110] w-12 h-12 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-2xl flex items-center justify-center transition-colors border border-gray-200 dark:border-white/10"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-800 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>

                                {/* Left: Visual Preview */}
                                <div className="w-full md:w-1/2 min-h-[500px] md:min-h-0 bg-gray-50 dark:bg-black/20 flex items-center justify-center relative overflow-hidden group p-12">
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        {(selectedItem.type === 'CARD_EFFECT' || selectedItem.type === 'ICON_EFFECT') ? (
                                            <div className="w-full max-w-[320px] aspect-[1/1.45] shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-lg overflow-hidden">
                                                <LiveEffectPreview 
                                                    type={selectedItem.type as any} 
                                                    metadata={selectedItem.metadata} 
                                                    className="w-full h-full"
                                                />
                                            </div>
                                        ) : (
                                            <img 
                                                src={selectedItem.imageUrl} 
                                                alt={selectedItem.name} 
                                                className="max-w-full max-h-full object-contain shadow-2xl rounded-xl" 
                                            />
                                        )}
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white dark:from-zinc-900/50 to-transparent pointer-events-none"></div>
                                </div>

                                {/* Right: Info & Actions */}
                                <div className="w-full md:w-1/2 p-8 md:p-16 flex flex-col justify-center bg-white dark:bg-zinc-900">
                                    <div className="mb-12">
                                        <div className="flex items-center gap-4 mb-4">
                                            <span className="px-3 py-1 bg-blue-600/10 border border-blue-600/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-blue-600 italic">
                                                {selectedItem.type.replace('_', ' ')}
                                            </span>
                                            <span className="text-sm font-black italic tracking-tighter text-blue-600 dark:text-blue-400">
                                                {selectedItem.price} DP
                                            </span>
                                        </div>
                                        <h2 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white mb-8 leading-[0.9]">
                                            {selectedItem.name}
                                        </h2>
                                        <p className="text-xl text-gray-500 dark:text-gray-400 leading-relaxed max-w-md">
                                            {selectedItem.description}
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-4">
                                        {ownedIds.includes(selectedItem.id) ? (
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => {
                                                        handleEquip(selectedItem.id, selectedItem.type);
                                                        setSelectedItem(null);
                                                    }}
                                                    className="flex-1 py-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                                                >
                                                    Equip Item
                                                </button>
                                                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handlePurchase(selectedItem)}
                                                disabled={purchasing !== null || userPoints < selectedItem.price}
                                                className={`py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-xs transition-all shadow-2xl active:scale-95 ${
                                                    userPoints < selectedItem.price
                                                    ? 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-black/5 dark:border-white/5 shadow-none'
                                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/40'
                                                }`}
                                            >
                                                {purchasing === selectedItem.id 
                                                    ? 'Processing...' 
                                                    : (userPoints < selectedItem.price ? `Insufficient Points (${selectedItem.price - userPoints} short)` : 'Purchase Now')}
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => setSelectedItem(null)}
                                            className="py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-white transition-colors"
                                        >
                                            Return to Shop
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

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

