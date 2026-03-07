import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { Card } from '../../../../types/class-editor';
import CardImage from '../../../../components/common/CardImage';
import { useRouter } from 'next/router';

type Rarity = 'C' | 'R' | 'SR' | 'UR';

interface Treasure {
  id: string;
  card: Card;
  rarity: Rarity;
}

export const RARITIES: Rarity[] = ['C', 'R', 'SR', 'UR'];

export const RARITY_LABELS: Record<Rarity, string> = {
  'C': 'Normal',
  'R': 'Rare',
  'SR': 'Super Rare',
  'UR': 'Ultra Rare'
};

export const RARITY_COLORS: Record<Rarity, string> = {
  'C': 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  'R': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  'SR': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  'UR': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200'
};

export default function TreasuresEditor() {
  const { data: session, status } = useSession();
  const [treasures, setTreasures] = useState<Treasure[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRarity, setActiveRarity] = useState<Rarity>('C');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const slug = Array.isArray(router.query.slug) ? router.query.slug[0] : router.query.slug as string | undefined;
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchTreasures();
    }
  }, [status]);

  // Debounce search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const res = await axios.get(`/api/cards/search?q=${encodeURIComponent(searchQuery)}`);
          setSearchResults(res.data);
        } catch (error) {
          console.error('Error searching cards:', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const fetchTreasures = async () => {
    try {
      const res = await axios.get('/api/treasures');
      setTreasures(res.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch treasures', error);
      setLoading(false);
    }
  };

  const addTreasure = async (card: Card) => {
    // Check if already exists in this rarity
    if (treasures.some(t => t.card.id === card.id && t.rarity === activeRarity)) {
      alert('This card is already in this rarity tier.');
      return;
    }

    try {
      const res = await axios.post('/api/treasures', {
        cardId: card.id,
        rarity: activeRarity
      });
      setTreasures([res.data, ...treasures]);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Failed to add treasure', error);
      alert('Failed to add treasure');
    }
  };

  const removeTreasure = async (id: string) => {
    try {
      await axios.delete(`/api/treasures/${id}`);
      setTreasures(treasures.filter(t => t.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      console.error('Failed to remove treasure', error);
      alert('Failed to remove treasure');
    }
  };

  const removeBulk = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      setLoading(true);
      await Promise.all(
        Array.from(selectedIds).map(id => axios.delete(`/api/treasures/${id}`))
      );
      setTreasures(treasures.filter(t => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to remove treasures in bulk', error);
      alert('Failed to remove treasures in bulk');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const currentRarityIds = treasures
      .filter(t => t.rarity === activeRarity)
      .map(t => t.id);
    
    setSelectedIds(prev => {
      const next = new Set(prev);
      currentRarityIds.forEach(id => next.add(id));
      return next;
    });
  };

  const deselectAll = () => {
    const currentRarityIds = new Set(
      treasures.filter(t => t.rarity === activeRarity).map(t => t.id)
    );
    
    setSelectedIds(prev => {
      const next = new Set(prev);
      currentRarityIds.forEach(id => next.delete(id));
      return next;
    });
  };

  // artwork handled by CardImage component

  if (status === 'loading' || loading) return <div className="p-8 text-center">Loading...</div>;

  if (!session || session.user?.role !== 'ADMIN') {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const activeTreasures = treasures.filter(t => t.rarity === activeRarity);

  const base = `/admin/formats/${slug}`

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Link href={base} className="text-blue-600 hover:underline mr-4">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Treasures Editor</h1>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Panel: Rarity Tabs & List */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col h-[80vh]">
          {/* Rarity Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {RARITIES.map(rarity => (
              <button
                key={rarity}
                onClick={() => setActiveRarity(rarity)}
                className={`flex-1 py-4 text-center font-bold transition-colors relative ${
                  activeRarity === rarity 
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                     <img 
                      src={`/images/rarity/${rarity === 'C' ? 'N' : rarity}.png`} 
                      alt={rarity}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerText = rarity;
                      }}
                     />
                  </div>
                  <span className="text-sm">{RARITY_LABELS[rarity]}</span>
                </div>
                {activeRarity === rarity && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 dark:bg-blue-400" />
                )}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 relative z-10">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search cards to add to ${RARITY_LABELS[activeRarity]}...`}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="absolute left-4 right-4 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-96 overflow-y-auto z-20">
                {searchResults.map(card => (
                  <button
                    key={card.id}
                    onClick={() => addTreasure(card)}
                    onMouseEnter={() => setHoveredCard(card)}
                    onMouseLeave={() => setHoveredCard(null)}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center space-x-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <div className="w-8 h-12 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden flex-shrink-0">
                      <CardImage konamiId={card.konamiId} card={card} alt={card.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white">{card.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{card.type}</div>
                    </div>
                    <div className="ml-auto text-blue-600 dark:text-blue-400 font-bold">+ Add</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Treasures List */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-700 dark:text-gray-300">
                {activeTreasures.length} Cards in {RARITY_LABELS[activeRarity]}
              </h3>
              
              <div className="flex items-center space-x-2">
                {selectedIds.size > 0 ? (
                  <button 
                    onClick={removeBulk}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Remove Selected ({selectedIds.size})</span>
                  </button>
                ) : (
                  <button 
                    onClick={selectAll}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition-colors"
                  >
                    Select All
                  </button>
                )}
                {selectedIds.size > 0 && (
                  <button 
                    onClick={deselectAll}
                    className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded text-xs font-bold transition-colors"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
            </div>

            {activeTreasures.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                <p>No treasures in this rarity yet.</p>
                <p className="text-sm">Search above to add cards.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {activeTreasures.map(treasure => {
                  const isSelected = selectedIds.has(treasure.id);
                  return (
                    <div 
                      key={treasure.id}
                      onClick={() => toggleSelect(treasure.id)}
                      className={`relative bg-white dark:bg-gray-800 p-2 rounded border-2 transition-all cursor-pointer shadow-sm flex items-center space-x-3 group ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10' 
                          : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                      onMouseEnter={() => setHoveredCard(treasure.card)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      {/* Selectable Checkbox Indicator */}
                      <div className={`absolute top-1 left-1 w-3 h-3 rounded-full border transition-colors z-10 ${
                        isSelected 
                          ? 'bg-blue-500 border-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.5)]' 
                          : 'bg-white/20 border-gray-400 opacity-0 group-hover:opacity-100'
                      }`} />

                      <div style={{ width: 40, flexShrink: 0 }}>
                        <CardImage konamiId={treasure.card.konamiId} card={treasure.card} alt={treasure.card.name} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate text-gray-900 dark:text-white">{treasure.card.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{treasure.card.type}</div>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeTreasure(treasure.id); }}
                        className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 z-20"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Preview */}
        <div className={`w-full lg:w-80 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-fit sticky top-8 transition-opacity duration-200 ${hoveredCard ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 text-center">Card Preview</h3>
          {hoveredCard && (
            <div className="flex flex-col items-center">
              <div className="w-full rounded-lg shadow-lg mb-4 overflow-hidden">
                <CardImage konamiId={hoveredCard.konamiId} card={hoveredCard} alt={hoveredCard.name} className="w-full h-full object-contain" />
              </div>
              <div className="w-full space-y-2 text-sm">
                <div className="font-bold text-xl text-gray-900 dark:text-white text-center">{hoveredCard.name}</div>
                <div className="text-center">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${RARITY_COLORS[activeRarity]}`}>
                    {RARITY_LABELS[activeRarity]}
                  </span>
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-center">{hoveredCard.type}</div>
                {(hoveredCard.atk !== undefined && hoveredCard.atk !== null) && (
                  <div className="flex justify-center space-x-4 text-gray-700 dark:text-gray-300 font-mono font-bold">
                    <span>ATK/{hoveredCard.atk === -1 ? '?' : hoveredCard.atk}</span>
                    {(hoveredCard.def !== undefined && hoveredCard.def !== null) && <span>DEF/{hoveredCard.def === -1 ? '?' : hoveredCard.def}</span>}
                  </div>
                )}
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {hoveredCard.desc}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
