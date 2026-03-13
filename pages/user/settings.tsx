import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import axios from 'axios';
import CardImage from '../../components/common/CardImage';
import Layout from '../../components/Layout';

export default function UserSettingsPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  
  // Profile State
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [favoriteCard, setFavoriteCard] = useState<any>(null);
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  
  // Image Selection State
  const [ownedIcons, setOwnedIcons] = useState<any[]>([]);
  const [loadingOwnedIcons, setLoadingOwnedIcons] = useState(false);
  const [showIconLibrary, setShowIconLibrary] = useState(false);

  // Favourite Card Search
  const [cardSearch, setCardSearch] = useState('');
  const [cardResults, setCardResults] = useState<any[]>([]);
  const [searchingCards, setSearchingCards] = useState(false);
  const [cardSearchError, setCardSearchError] = useState<string | null>(null);
  
  // Profile Icon Search
  const [iconSearch, setIconSearch] = useState('');
  const [iconSearchResults, setIconSearchResults] = useState<any[]>([]);
  const [artworkOptions, setArtworkOptions] = useState<any[]>([]);
  const [loadingArtworks, setLoadingArtworks] = useState(false);
  const [cardArtworksMap, setCardArtworksMap] = useState<Record<number, any[]>>({});
  const [cardArtworksLoading, setCardArtworksLoading] = useState<Record<number, boolean>>({});
  const [searchingIcons, setSearchingIcons] = useState(false);
  const [iconSearchError, setIconSearchError] = useState<string | null>(null);
  const [showIconSearch, setShowIconSearch] = useState(false);

  // Security State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityMessage, setSecurityMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated') {
      fetchProfile();
    }
  }, [status, router]);

  // Fetch artworks for icon search results so we can show all artworks per card
  useEffect(() => {
    const fetchArtworksFor = async () => {
      const idsToFetch = iconSearchResults
        .map((c: any) => c.id)
        .filter((id: number) => id && !cardArtworksMap[id] && !cardArtworksLoading[id]);

      for (const id of idsToFetch) {
        setCardArtworksLoading((s) => ({ ...s, [id]: true }));
        try {
          const res = await axios.get(`/api/cards/${id}`);
          const cardDetails = res.data;
          const artworks = Array.isArray(cardDetails.artworks) ? cardDetails.artworks : [];
          setCardArtworksMap((s) => ({ ...s, [id]: artworks }));
        } catch (err) {
          console.error('Failed to fetch card artworks for', id, err);
          setCardArtworksMap((s) => ({ ...s, [id]: [] }));
        } finally {
          setCardArtworksLoading((s) => ({ ...s, [id]: false }));
        }
      }
    };

    if (iconSearchResults && iconSearchResults.length > 0) fetchArtworksFor();
  }, [iconSearchResults, cardArtworksMap, cardArtworksLoading]);

  // Thumbnail component shows a spinner while the image loads
  const Thumbnail = ({ src, konamiId, alt, onClick }: { src?: string; konamiId?: number | null; alt?: string; onClick?: () => void }) => {
    const [loaded, setLoaded] = useState(false);
    
    // Preload the image immediately to minimize flicker
    useEffect(() => {
      if (src) {
        const img = new Image();
        img.src = src;
        img.onload = () => setLoaded(true);
      }
    }, [src]);

    return (
      <button
        type="button"
        onClick={onClick}
        className="w-16 h-16 border rounded-full overflow-hidden hover:opacity-90 p-0 bg-gray-100 dark:bg-gray-800/10 relative flex-shrink-0"
      >
        <CardImage
          src={src || null}
          konamiId={konamiId ?? null}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
             <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        )}
      </button>
    );
  };

  const fetchProfile = async () => {
    try {
      const res = await axios.get('/api/user/me');
      const data = res.data;
      const user = data.user || data;
      if (user) {
        setName(user.name || '');
        // Prioritize the equipped profile icon URL over the fallback session image
        setImage(user.profileIcon?.imageUrl || user.image || '');
        setFavoriteCard(user.favoriteCard);
        setSelectedIconId(user.profileIconId || null);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch profile', error);
      setLoading(false);
    }
  };

  const fetchOwnedIcons = async () => {
    setLoadingOwnedIcons(true);
    try {
      const { data } = await axios.get('/api/user/owned-icons');
      setOwnedIcons(data.icons || []);
    } catch (err) {
      console.error('Failed to fetch owned icons', err);
    } finally {
      setLoadingOwnedIcons(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityMessage({ type: '', text: '' }); // Clear any old messages
    
    // Validate name before sending
    if (!name || name.trim().length < 3) {
      setSecurityMessage({ type: 'error', text: 'Display name must be at least 3 characters long.' });
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        image,
        favoriteCardId: favoriteCard?.id,
        profileIconId: selectedIconId
      };
      
      console.log('[DEBUG] Sending profile update payload:', payload);
      
      const response = await axios.put('/api/user/me', payload);
      
      // If the server returned an error without a 400/500 code
      if (response.data?.success === false) {
        setSecurityMessage({ type: 'error', text: response.data.message || 'Failed to update profile.' });
        return;
      }
      
      // Update the session with new data
      await update({
        ...session,
        user: {
          ...session?.user,
          name: name.trim(),
          image: selectedIconId ? image : image || session?.user?.image,
        }
      });
      setSecurityMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error: any) {
      console.error('Failed to update profile', error);
      
      // Fallback for real network errors or legacy error codes
      const serverMessage = error.response?.data?.message || 'Failed to update profile.';
      setSecurityMessage({ type: 'error', text: serverMessage });
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityMessage({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setSecurityMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    try {
      await axios.patch('/api/user/me', {
        currentPassword,
        newPassword
      });
      setSecurityMessage({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setSecurityMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update password.' });
    }
  };

  const searchCards = async (query: string, type: 'favourite' | 'icon') => {
    if (type === 'favourite') setCardSearch(query);
    else setIconSearch(query);

    if (query.length < 2) {
      if (type === 'favourite') setCardResults([]);
      else setIconSearchResults([]);
      return;
    }

    if (type === 'favourite') {
      setSearchingCards(true);
      setCardSearchError(null);
    } else {
      setSearchingIcons(true);
      setIconSearchError(null);
    }

    try {
      if (type === 'favourite') {
        const res = await axios.get(`/api/cards/search?q=${encodeURIComponent(query)}`);
        setCardResults(res.data);
      } else {
        const res = await axios.get(`/api/cards/search?q=${encodeURIComponent(query)}&variant=TCG`);
        setIconSearchResults(res.data);
      }
    } catch (error) {
      console.error('Error searching cards', error);
      const msg = (error as any)?.response?.data?.message || 'Search failed';
      if (type === 'favourite') setCardSearchError(msg);
      else setIconSearchError(msg);
    } finally {
      if (type === 'favourite') setSearchingCards(false);
      else setSearchingIcons(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 py-12">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white mb-8">User Settings</h1>
          
          <div className="flex border-b border-gray-100 dark:border-white/5 mb-12">
            {[
              { id: 'profile', label: 'Profile' },
              { id: 'security', label: 'Security' }
            ].map(tab => (
              <button
                key={tab.id}
                className={`pb-4 px-6 text-xs font-black uppercase tracking-widest transition-all relative ${
                  activeTab === tab.id 
                    ? 'text-blue-600' 
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                }`}
                onClick={() => setActiveTab(tab.id as any)}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full"></div>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="space-y-12">
              {securityMessage.text && (
                <div className={`p-4 rounded-2xl border text-xs font-black uppercase tracking-widest animate-in fade-in slide-in-from-top-2 ${
                  securityMessage.type === 'success' 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
                    : 'bg-red-500/10 border-red-500/20 text-red-500'
                }`}>
                  {securityMessage.text}
                </div>
              )}
              <section>
                <div className="flex items-center gap-4 mb-8">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Account Identity</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-gray-100 dark:from-white/5 to-transparent"></div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-8 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-8 rounded-3xl">
                  <div className="relative group">
                    <button
                      type="button"
                      onClick={() => {
                        setShowIconLibrary(true);
                        if (ownedIcons.length === 0) fetchOwnedIcons();
                      }}
                      className="relative h-24 w-24 rounded-3xl overflow-hidden border-2 border-white dark:border-white/10 shadow-xl focus:outline-none transition-transform group-hover:scale-105"
                    >
                      {image ? (
                        <img src={image} alt="profile" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-gray-200 dark:bg-gray-700" />
                      )}
                      <div className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                         </svg>
                      </div>
                    </button>
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Display Name</label>
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your display name"
                            className="block w-full max-w-xs bg-white dark:bg-zinc-900/50 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider focus:border-blue-500/50 focus:outline-none transition-all"
                          />
                        </div>
                        {session?.user?.email && (
                          <div className="text-xs font-bold text-gray-500 uppercase tracking-widest leading-none">{session.user.email}</div>
                        )}
                        <div className="pt-2">
                           <button 
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 mr-3"
                           >
                             Save Changes
                           </button>
                           <button 
                            type="button"
                            onClick={() => {
                              setShowIconLibrary(true);
                              if (ownedIcons.length === 0) fetchOwnedIcons();
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-400 transition-colors border border-gray-100 dark:border-white/10 px-6 py-3 rounded-xl"
                           >
                             Change Avatar
                           </button>
                        </div>
                      </div>
                </div>

                {showIconLibrary && (
                  <div className="mt-6 bg-white dark:bg-[#0a0a0c] border border-gray-100 dark:border-white/10 p-6 rounded-2xl shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Owned Icons</h3>
                      <button 
                        type="button" 
                        onClick={() => setShowIconLibrary(false)} 
                        className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all"
                      >
                        Close
                      </button>
                    </div>
                    
                    {loadingOwnedIcons ? (
                      <div className="flex items-center justify-center p-12">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : ownedIcons.length > 0 ? (
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {ownedIcons.map((icon) => (
                          <div 
                            key={icon.id}
                            className={`relative group cursor-pointer rounded-2xl overflow-hidden border-2 transition-all ${
                              selectedIconId === icon.id ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-transparent'
                            }`}
                            onClick={() => {
                              setSelectedIconId(icon.id);
                              setImage(icon.imageUrl || '');
                            }}
                          >
                            <img src={icon.imageUrl} alt={icon.name} className="w-full h-full object-cover aspect-square" />
                            {selectedIconId === icon.id && (
                              <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                                <div className="bg-blue-600 text-white rounded-full p-1 scale-75">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-12 text-center border border-dashed border-gray-100 dark:border-white/10 rounded-2xl">
                         <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">No icons owned</p>
                         <p className="text-[10px] text-gray-400 mt-2">Visit the Cosmetic Shop to get some!</p>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center gap-4 mb-8">
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-400">Featured Display</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-gray-100 dark:from-white/5 to-transparent"></div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-3">Favourite Card</label>
                    <div className="relative group">
                      <input
                        type="text"
                        placeholder="Search for your signature card..."
                        value={cardSearch}
                        onChange={(e) => searchCards(e.target.value, 'favourite')}
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl p-6 text-base font-black italic uppercase tracking-tighter focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                      />
                      
                      {cardSearch.length < 2 && favoriteCard && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-4 bg-white dark:bg-gray-900 p-2 rounded-xl border border-gray-100 dark:border-white/10 shadow-lg">
                           <div className="w-10 h-14 rounded-md overflow-hidden border border-gray-100 dark:border-white/5">
                             <img 
                                src={favoriteCard.imageUrlSmall || favoriteCard.imageUrl || `https://images.ygoprodeck.com/images/cards_small/${favoriteCard.konamiId}.jpg`}
                                alt={favoriteCard.name}
                                className="w-full h-full object-contain bg-black/20"
                             />
                           </div>
                           <span className="text-xs font-black italic uppercase tracking-tight pr-4">{favoriteCard.name}</span>
                        </div>
                      )}
                    </div>
                    
                    {cardResults.length > 0 && (
                      <div className="mt-4 bg-white dark:bg-[#0a0a0c] border border-gray-100 dark:border-white/10 rounded-2xl shadow-2xl max-h-64 overflow-y-auto custom-scrollbar">
                        {cardResults.map((card) => (
                          <div
                            key={card.id}
                            className="p-4 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer flex items-center gap-4 group transition-colors"
                            onClick={() => {
                              setFavoriteCard(card);
                              setCardResults([]);
                              setCardSearch('');
                            }}
                          >
                            <div className="w-12 h-16 rounded-md overflow-hidden border border-gray-100 dark:border-white/5 flex-shrink-0 group-hover:scale-105 transition-transform bg-black/10">
                              <img 
                                src={card.imageUrlSmall || card.imageUrl || `https://images.ygoprodeck.com/images/cards_small/${card.konamiId}.jpg`}
                                alt={card.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div>
                               <div className="text-sm font-black italic uppercase tracking-tighter text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{card.name}</div>
                               <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{card.type}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <div className="pt-8 border-t border-gray-100 dark:border-white/5">
                <button
                  type="submit"
                  className="w-full md:w-auto px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-900/20 transition-all hover:-translate-y-1 active:scale-95"
                >
                  Save Profile Settings
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handlePasswordUpdate} className="space-y-8 max-w-2xl">
              {securityMessage.text && (
                <div className={`p-5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-3 ${
                  securityMessage.type === 'error' 
                    ? 'bg-red-500/10 text-red-600 border border-red-500/20' 
                    : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  {securityMessage.text}
                </div>
              )}
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-3">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl p-5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-3">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl p-5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-3">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl p-5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full md:w-auto px-12 py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-900/20 transition-all hover:-translate-y-1 active:scale-95"
                >
                  Update Credentials
                </button>
              </div>
            </form>
          )}
      </div>
    );
  }
