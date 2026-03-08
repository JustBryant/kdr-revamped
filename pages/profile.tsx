import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import CardImage from '../components/common/CardImage';
import Layout from '../components/Layout';
import { getClassImageUrl } from '../lib/constants';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'classes' | 'history'>('overview');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchUserData();
    }
  }, [status]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/user/me');
      setUserData(res.data);
    } catch (err) {
      console.error('Failed to fetch user data', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !session) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-500 animate-pulse">Loading Profile...</p>
        </div>
      </div>
    );
  }

  const { stats, classStats, recentMatches, mostPlayedClass, signatureCard, user: detailedUser } = userData || {};

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
              {/* Profile Frame Overlay */}
              {detailedUser?.frame?.imageUrl && (
                <div className="absolute inset-[-12px] z-20 pointer-events-none">
                  <img src={detailedUser.frame.imageUrl} className="w-full h-full object-contain" alt="Frame" />
                </div>
              )}
              <div className={`w-32 h-32 rounded-3xl overflow-hidden border-2 border-white dark:border-white/10 shadow-2xl transition-transform group-hover:scale-105 duration-500 ${detailedUser?.border?.imageUrl ? 'p-1 bg-gradient-to-br from-blue-400 to-purple-500' : ''}`}>
                <img 
                  src={session.user?.image || '/images/default-avatar.png'} 
                  alt={session.user?.name || 'User'} 
                  className="w-full h-full object-cover rounded-[1.4rem]"
                />
              </div>
              <Link 
                href="/user/settings" 
                className="absolute -bottom-2 -right-2 z-30 w-10 h-10 bg-white dark:bg-gray-900 rounded-xl shadow-lg flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors border border-gray-100 dark:border-white/10"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            </div>

            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-4 mb-2">
                <h1 className="text-4xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">
                  {session.user?.name}
                </h1>
                {detailedUser?.title && (
                    <span className="px-3 py-1 bg-blue-600/10 border border-blue-600/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-blue-500 italic">
                        {detailedUser.title.name}
                    </span>
                )}
              </div>
              <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-6">
                ELO {stats?.elo ?? 1500}
              </p>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-8">
                <div className="text-center md:text-left">
                  <div className="text-2xl font-black italic text-gray-900 dark:text-white">{stats?.wins || 0}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Wins</div>
                </div>
                <div className="w-px h-8 bg-gray-200 dark:bg-white/5 hidden sm:block"></div>
                <div className="text-center md:text-left">
                  <div className="text-2xl font-black italic text-gray-900 dark:text-white">{stats?.losses || 0}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Losses</div>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-4">
            </div>
          </div>
        </div>

        {/* Tabs System */}
        <div className="flex items-center gap-8 mb-12 border-b border-gray-100 dark:border-white/5 pb-1">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'classes', label: 'Class Stats' },
            { id: 'history', label: 'Recent Matches' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all relative ${
                activeTab === tab.id 
                  ? 'text-blue-600' 
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full"></div>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-12">
            
            {activeTab === 'overview' && (
              <>
                <section>
                  <div className="flex items-center gap-4 mb-8">
                    <h2 className="text-sm font-black uppercase tracking-[0.3em] text-gray-400">Player Journey</h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-gray-100 dark:from-white/5 to-transparent"></div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl p-6 hover:border-blue-500/30 transition-all group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-blue-600">Most Played Class</div>
                        <div className="p-2 rounded-lg bg-blue-600/10 text-blue-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      </div>
                      <div className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white group-hover:translate-x-1 transition-transform">
                        {mostPlayedClass || 'None'}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl p-6 hover:border-purple-500/30 transition-all group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-purple-600">Signature Card</div>
                        <div className="p-2 rounded-lg bg-purple-600/10 text-purple-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.628.288a2 2 0 01-1.18.08l-3.085-.617a2 2 0 01-1.247-1.303l-.469-1.88a2 2 0 01-1.247-1.303l-.469-1.88a2 2 0 00-1.508-1.508l-1.88-.469a2 2 0 01-1.303-1.247l-.617-3.085a2 2 0 01.08-1.18l.288-.628a6 6 0 00.517-3.86l-.477-2.387a2 2 0 00-.547-1.022L1.428 1.428" />
                          </svg>
                        </div>
                      </div>
                      <div className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white group-hover:translate-x-1 transition-transform">
                        {signatureCard || 'None'}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeTab === 'classes' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {classStats?.length > 0 ? classStats.map((cs: any) => (
                    <div key={cs.id} className="relative group overflow-hidden bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl p-6 transition-all hover:border-blue-500/30">
                        <div className="absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 opacity-10 group-hover:opacity-20 transition-opacity rotate-12">
                             <img src={normalizeImage(cs.classImage) || ''} className="w-full h-full object-contain" />
                        </div>
                        <div className="relative">
                            <h3 className="text-xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white mb-4">{cs.className}</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Wins</div>
                                    <div className="font-black italic text-gray-900 dark:text-white">{cs.wins || 0}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Picks</div>
                                    <div className="font-black italic text-gray-900 dark:text-white">{cs.picks || 0}</div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Winrate</div>
                                    <div className="font-black italic text-blue-600">{cs.wins + cs.losses > 0 ? Math.round((cs.wins/(cs.wins+cs.losses))*100) : 0}%</div>
                                </div>
                            </div>
                        </div>
                    </div>
                 )) : (
                    <div className="col-span-full py-20 text-center bg-gray-50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-200 dark:border-white/10">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-400">Play some tournaments to see class stats!</p>
                    </div>
                 )}
              </div>
            )}

            {activeTab === 'history' && (
               <div className="space-y-4">
                   {recentMatches?.map((match: any) => {
                      const isPlayerA = match.playerA.userId === session.user?.id;
                      const player = isPlayerA ? match.playerA : match.playerB;
                      const opponent = isPlayerA ? match.playerB : match.playerA;
                      const won = match.winner?.id === player?.id;
                      return (
                        <div key={match.id} className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-3xl p-8 transition-all hover:bg-gray-50 dark:hover:bg-white/[0.07]">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                     <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] ${won ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                                         {won ? 'Victory' : 'Defeat'}
                                     </div>
                                     <span className="text-xs font-bold text-gray-400">Match #{match.id.slice(-6).toUpperCase()}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col items-center gap-3 w-1/3">
                                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-blue-600/20">
                                        <img src={normalizeImage(player?.playerClass?.image) || ''} className="w-full h-full object-cover" />
                                    </div>
                                    <span className="text-sm font-black uppercase italic tracking-tighter truncate w-full text-center">{player?.playerClass?.name}</span>
                                </div>
                                
                                <div className="flex flex-col items-center gap-2">
                                    <div className="text-3xl font-black italic tracking-tighter">
                                        <span className={won ? 'text-blue-600' : ''}>{match.scoreA}</span>
                                        <span className="mx-4 text-gray-200 text-xl">—</span>
                                        <span className={!won ? 'text-red-500' : ''}>{match.scoreB}</span>
                                    </div>
                                    <div className="px-3 py-1 bg-gray-100 dark:bg-white/5 rounded text-[10px] font-black uppercase tracking-widest text-gray-400">KDR MATCH</div>
                                </div>

                                <div className="flex flex-col items-center gap-3 w-1/3">
                                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-white/5">
                                        <img src={normalizeImage(opponent?.playerClass?.image) || ''} className="w-full h-full object-cover" />
                                    </div>
                                    <span className="text-sm font-black uppercase italic tracking-tighter truncate w-full text-center">{opponent?.playerClass?.name}</span>
                                </div>
                            </div>
                        </div>
                      )
                   })}
               </div>
            )}
          </div>

          {/* Sidebar Area */}
          <div className="space-y-12">
            <section>
              <div className="flex items-center gap-4 mb-8">
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-gray-400">Currency</h2>
                <div className="h-px flex-1 bg-gradient-to-r from-gray-100 dark:from-white/5 to-transparent"></div>
              </div>
              <div className="p-8 bg-gradient-to-br from-yellow-500/10 to-amber-600/10 border border-yellow-500/20 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                      <div className="p-3 bg-yellow-500 rounded-2xl shadow-xl shadow-yellow-900/20">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                      </div>
                      <Link href="/kdr" className="text-[10px] font-black uppercase tracking-widest text-amber-600 hover:underline cursor-pointer">View Tournaments</Link>
                  </div>
                  <div>
                      <div className="text-4xl font-black italic tracking-tighter text-gray-900 dark:text-white">{(stats?.gold || 0) + (stats?.stats?.gold || 0)} DP</div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Available Duelist Points</div>
                  </div>
              </div>
            </section>

            <section>
              <div className="flex items-center gap-4 mb-8 pt-4">
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-gray-400">Achievements</h2>
                <div className="h-px flex-1 bg-gradient-to-r from-gray-100 dark:from-white/5 to-transparent"></div>
              </div>
              <div className="space-y-4">
                 {[
                   { label: 'Tournament Winner', desc: 'Place 1st in a KDR', progress: 100, color: 'bg-yellow-500' },
                   { label: 'Card Collector', desc: 'Unlock 50 unique cards', progress: 65, color: 'bg-blue-600' },
                   { label: 'Veteran', desc: 'Play 100 total matches', progress: 30, color: 'bg-emerald-500' }
                 ].map((ach, i) => (
                   <div key={i} className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl p-5 group hover:border-blue-500/20 transition-all">
                      <div className="flex justify-between items-start mb-3">
                         <div>
                            <div className="text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white mb-1">{ach.label}</div>
                            <div className="text-[10px] font-bold text-gray-400">{ach.desc}</div>
                         </div>
                         <div className="text-[10px] font-black text-gray-400">{ach.progress}%</div>
                      </div>
                      <div className="h-1 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                         <div className={`h-full ${ach.color} transition-all duration-1000`} style={{ width: `${ach.progress}%` }}></div>
                      </div>
                   </div>
                 ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }
