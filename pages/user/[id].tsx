import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import CardImage from '../../components/common/CardImage';
import Layout from '../../components/Layout';
import { getClassImageUrl } from '../../lib/constants';

export default function PublicProfilePage() {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'history'>('overview');

  useEffect(() => {
    if (id) {
      fetchUserData();
    }
  }, [id]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/user/${id}`);
      setUserData(res.data);
    } catch (err) {
      console.error('Failed to fetch user data', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !id) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-500 animate-pulse">Loading Profile...</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold uppercase tracking-widest text-gray-500">User Not Found</h1>
        <Link href="/leaderboard" className="text-blue-500 hover:text-blue-600 font-bold uppercase tracking-widest text-sm underline decoration-2 underline-offset-4">
          Back to Leaderboard
        </Link>
      </div>
    );
  }

  const { user, stats, classStats, recentMatches, mostPlayedClass, signatureCard } = userData || {};

  // Calculate win rate
  const totalMatches = (stats?.wins || 0) + (stats?.losses || 0);
  const winRate = totalMatches > 0 ? Math.round((stats.wins / totalMatches) * 100) : 0;

  const normalizeImage = (img: string | null) => {
    if (!img) return null;
    if (img.startsWith('http')) return img;
    return getClassImageUrl(img);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header Section */}
        <div className="relative mb-12">
          {/* Banner Decoration */}
          <div className="absolute inset-0 h-48 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-3xl -z-10 opacity-50"></div>
          
          <div className="flex flex-col md:flex-row items-center md:items-end gap-8 pb-8 border-b border-gray-100 dark:border-white/5">
            <div className="relative group">
              <div className="w-32 h-32 rounded-3xl overflow-hidden border-2 border-white dark:border-white/10 shadow-2xl transition-transform group-hover:scale-105 duration-500">
                <img 
                  src={user?.image || '/images/default-avatar.png'} 
                  alt={user?.name || 'User'} 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-4 mb-2">
                <h1 className="text-4xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">
                  {user?.name}
                </h1>
              </div>
              <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-6">
                ELO {stats?.elo ?? 1500}
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-8">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Win Rate</span>
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-black tracking-tighter text-gray-900 dark:text-white">{winRate}%</span>
                    <span className="text-xs font-bold text-gray-400 mb-1">({stats?.wins || 0}W - {stats?.losses || 0}L)</span>
                  </div>
                </div>
                <div className="h-10 w-px bg-gray-100 dark:bg-white/5 hidden sm:block"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Main Class</span>
                  <span className="text-xl font-bold uppercase tracking-tight text-blue-500">{mostPlayedClass}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-8 mb-12 border-b border-gray-100 dark:border-white/5">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'classes', label: 'Class Stats' },
          { id: 'history', label: 'Match History' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${
              activeTab === tab.id 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-fadeInShort"></div>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fadeInShort">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Signature Card Highlight */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Signature Card</h3>
                <div className="p-1 rounded-[2.5rem] bg-gradient-to-b from-blue-600/20 to-purple-600/20 shadow-2xl">
                  {user?.favoriteCard ? (
                    <div className="bg-white dark:bg-[#0f172a] rounded-[2.2rem] p-4 overflow-hidden relative group">
                      <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover:opacity-10 transition-opacity blur-2xl"></div>
                      <CardImage card={user.favoriteCard} className="w-full aspect-[2/3] object-contain shadow-2xl" />
                      <div className="mt-4 text-center">
                        <p className="text-lg font-black uppercase italic text-gray-900 dark:text-white mb-1">{user.favoriteCard.name}</p>
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Favourite Pickup</p>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-[2/3] bg-gray-50 dark:bg-white/5 rounded-[2.2rem] flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-white/10">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No Signature Card</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="lg:col-span-2 space-y-12">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Performance Overview</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-6 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Win Efficiency</p>
                    <div className="flex items-baseline gap-2">
                       <span className="text-4xl font-black tracking-tighter text-gray-900 dark:text-white">{winRate}%</span>
                       <span className="text-xs font-bold text-green-500 uppercase tracking-widest">Efficiency</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Accomplishments */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-6">Recent Combat History</h3>
                <div className="space-y-3">
                  {recentMatches?.length > 0 ? recentMatches.map((match: any) => {
                    const isA = match.playerA?.userId === user?.id;
                    const me = isA ? match.playerA : match.playerB;
                    const opponent = isA ? match.playerB : match.playerA;
                    const isWinner = match.winnerId === me?.id;

                    return (
                      <div key={match.id} className="group relative bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 p-4 transition-all hover:bg-gray-50 dark:hover:bg-white/[0.08] shadow-sm flex items-center gap-4">
                        <div className={`w-2 h-10 rounded-full ${isWinner ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]' : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]'}`}></div>
                        
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 items-center gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/10 p-1">
                              <img src={normalizeImage(me?.playerClass?.image) || '/images/default-class.png'} className="w-full h-full object-contain" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Class Used</span>
                              <span className="text-sm font-bold uppercase truncate max-w-[120px]">{me?.playerClass?.name || 'Classless'}</span>
                            </div>
                          </div>

                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 italic">Result</span>
                            <span className={`text-sm font-black uppercase tracking-wider ${isWinner ? 'text-green-500' : 'text-red-500'}`}>
                              {isWinner ? 'Victory' : 'Defeat'}
                            </span>
                          </div>

                          <div className="hidden md:flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Opponent</span>
                            <div className="flex items-center gap-2">
                               <img src={opponent?.user?.image || '/images/default-avatar.png'} className="w-5 h-5 rounded-full object-cover" />
                               <span className="text-sm font-bold truncate max-w-[100px]">{opponent?.user?.name || 'Unknown'}</span>
                            </div>
                          </div>

                          <div className="hidden md:flex flex-col text-right">
                             <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Date</span>
                             <span className="text-sm font-bold text-gray-500">{new Date(match.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="p-12 text-center bg-gray-50 dark:bg-white/5 rounded-[2.2rem] border-2 border-dashed border-gray-100 dark:border-white/10">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest italic">No combat records found.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'classes' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {classStats?.length > 0 ? classStats.map((cs: any) => (
              <div key={cs.id} className="group p-6 bg-white dark:bg-white/5 rounded-3xl border border-gray-100 dark:border-white/10 transition-all hover:scale-[1.02] shadow-sm">
                <div className="w-full aspect-square mb-6 relative">
                  <div className="absolute inset-0 bg-blue-600/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <img src={normalizeImage(cs.classImage) || '/images/default-class.png'} className="w-full h-full object-contain relative z-10" />
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-black uppercase italic tracking-tighter mb-4">{cs.className}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col p-3 rounded-2xl bg-gray-50 dark:bg-white/5">
                      <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Wins</span>
                      <span className="text-xl font-black text-green-500">{cs.wins}</span>
                    </div>
                    <div className="flex flex-col p-3 rounded-2xl bg-gray-50 dark:bg-white/5">
                      <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 mb-1">Losses</span>
                      <span className="text-xl font-black text-red-500">{cs.losses}</span>
                    </div>
                    <div className="col-span-2 flex flex-col p-3 rounded-2xl bg-blue-600/10">
                      <span className="text-[8px] font-black uppercase tracking-widest text-blue-500 mb-1">Picks</span>
                      <span className="text-xl font-black text-blue-600 dark:text-blue-400">{cs.picks}</span>
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="col-span-full p-20 text-center">
                 <p className="text-gray-500 font-bold uppercase tracking-[0.2em] italic">No class statistical data available.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Same history as overview but with more detail or filters if needed */}
             {recentMatches?.length > 0 ? recentMatches.map((match: any) => {
                const isA = match.playerA?.userId === user?.id;
                const me = isA ? match.playerA : match.playerB;
                const opponent = isA ? match.playerB : match.playerA;
                const isWinner = match.winnerId === me?.id;
                return (
                  <div key={match.id} className="p-6 bg-white dark:bg-white/5 rounded-3xl border border-gray-100 dark:border-white/10 flex flex-col gap-6 shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black uppercase tracking-widest text-gray-400">Match ID</span>
                        <span className="text-xs font-mono font-bold text-gray-500">{match.id.substring(0, 8)}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-400">{new Date(match.createdAt).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex items-center justify-between gap-8">
                       <div className="flex-1 flex flex-col items-center gap-2">
                          <img src={normalizeImage(me?.playerClass?.image) || '/images/default-class.png'} className="w-16 h-16 object-contain" />
                          <span className="text-xs font-black uppercase tracking-tighter truncate w-full text-center">{user?.name}</span>
                       </div>
                       
                       <div className="flex flex-col items-center">
                          <span className={`text-2xl font-black italic uppercase tracking-tighter ${isWinner ? 'text-green-500' : 'text-red-500'}`}>
                            {isWinner ? 'WIN' : 'LOSS'}
                          </span>
                          <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">VS</span>
                       </div>

                       <div className="flex-1 flex flex-col items-center gap-2">
                          <img src={normalizeImage(opponent?.playerClass?.image) || '/images/default-class.png'} className="w-16 h-16 object-contain opacity-60" />
                          <span className="text-xs font-black uppercase tracking-tighter truncate w-full text-center opacity-60">{opponent?.user?.name || 'Unknown'}</span>
                       </div>
                    </div>
                  </div>
                )
             }) : (
                <p className="text-center text-gray-500 py-20 font-bold uppercase italic">History is empty.</p>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
