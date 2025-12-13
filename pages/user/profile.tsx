import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { CARD_IMAGE_BASE_URL } from '../../lib/constants';

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  
  // Profile State
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [favoriteCard, setFavoriteCard] = useState<any>(null);
  
  // Image Selection State
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);

  // Favorite Card Search
  const [cardSearch, setCardSearch] = useState('');
  const [cardResults, setCardResults] = useState<any[]>([]);
  const [searchingCards, setSearchingCards] = useState(false);
  
  // Profile Icon Search
  const [iconSearch, setIconSearch] = useState('');
  const [iconSearchResults, setIconSearchResults] = useState<any[]>([]);
  const [searchingIcons, setSearchingIcons] = useState(false);

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

  const fetchProfile = async () => {
    try {
      const res = await axios.get('/api/user/profile');
      const user = res.data;
      setName(user.name || '');
      setImage(user.image || '');
      setFavoriteCard(user.favoriteCard);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch profile', error);
      setLoading(false);
    }
  };

  const fetchImages = async () => {
    if (availableImages.length > 0) {
      setIsImageModalOpen(true);
      return;
    }
    
    setLoadingImages(true);
    try {
      const res = await axios.get('/api/classes/images');
      setAvailableImages(res.data);
      setIsImageModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch images', error);
      alert('Failed to load images from GitHub.');
    } finally {
      setLoadingImages(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put('/api/user/profile', {
        name,
        image,
        favoriteCardId: favoriteCard?.id
      });
      
      // Update the session with new data
      await update({
        ...session,
        user: {
          ...session?.user,
          name,
          image
        }
      });

      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile', error);
      alert('Failed to update profile.');
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
      await axios.patch('/api/user/profile', {
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

  const getCardImageUrl = (konamiId: number | null | undefined) => {
    if (!konamiId) return '/placeholder-card.png'; // Or some default
    return `${CARD_IMAGE_BASE_URL}/${konamiId}.jpg`;
  };

  const searchCards = async (query: string, type: 'favorite' | 'icon') => {
    if (type === 'favorite') setCardSearch(query);
    else setIconSearch(query);

    if (query.length < 2) {
      if (type === 'favorite') setCardResults([]);
      else setIconSearchResults([]);
      return;
    }

    if (type === 'favorite') setSearchingCards(true);
    else setSearchingIcons(true);

    try {
      const res = await axios.get(`/api/cards/search?q=${query}`);
      if (type === 'favorite') setCardResults(res.data);
      else setIconSearchResults(res.data);
    } catch (error) {
      console.error('Error searching cards', error);
    } finally {
      if (type === 'favorite') setSearchingCards(false);
      else setSearchingIcons(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">User Settings</h1>
        
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-8">
          <button
            className={`py-2 px-4 font-medium ${activeTab === 'profile' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </button>
          <button
            className={`py-2 px-4 font-medium ${activeTab === 'security' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`}
            onClick={() => setActiveTab('security')}
          >
            Security
          </button>
        </div>

        {activeTab === 'profile' && (
          <form onSubmit={handleProfileUpdate} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white p-2 border"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Profile Icon</label>
              <div className="mt-1 flex items-center gap-4 mb-2">
                {image ? (
                  <img src={image} alt="Profile Preview" className="h-20 w-20 rounded-full object-cover border border-gray-300 dark:border-gray-600" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                    No Icon
                  </div>
                )}
              </div>
              
              <input
                type="text"
                placeholder="Search card for icon..."
                value={iconSearch}
                onChange={(e) => searchCards(e.target.value, 'icon')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white p-2 border"
              />
              
              {iconSearchResults.length > 0 && (
                <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-md max-h-60 overflow-y-auto">
                  {iconSearchResults.map((card) => (
                    <div
                      key={card.id}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
                      onClick={() => {
                        setImage(getCardImageUrl(card.konamiId));
                        setIconSearchResults([]);
                        setIconSearch('');
                      }}
                    >
                      {card.konamiId && <img src={getCardImageUrl(card.konamiId)} alt={card.name} className="h-8 w-8 object-contain mr-2" />}
                      <span className="dark:text-white">{card.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Favorite Card</label>
              {favoriteCard && (
                <div className="flex items-center mt-2 mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                  {favoriteCard.konamiId && <img src={getCardImageUrl(favoriteCard.konamiId)} alt={favoriteCard.name} className="h-12 w-12 object-contain mr-3" />}
                  <span className="font-medium dark:text-white">{favoriteCard.name}</span>
                  <button
                    type="button"
                    onClick={() => setFavoriteCard(null)}
                    className="ml-auto text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              )}
              
              <input
                type="text"
                placeholder="Search for a card..."
                value={cardSearch}
                onChange={(e) => searchCards(e.target.value, 'favorite')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white p-2 border"
              />
              
              {cardResults.length > 0 && (
                <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-md max-h-60 overflow-y-auto">
                  {cardResults.map((card) => (
                    <div
                      key={card.id}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
                      onClick={() => {
                        setFavoriteCard(card);
                        setCardResults([]);
                        setCardSearch('');
                      }}
                    >
                      {card.konamiId && <img src={getCardImageUrl(card.konamiId)} alt={card.name} className="h-8 w-8 object-contain mr-2" />}
                      <span className="dark:text-white">{card.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Save Changes
            </button>
          </form>
        )}

        {activeTab === 'security' && (
          <form onSubmit={handlePasswordUpdate} className="space-y-6">
            {securityMessage.text && (
              <div className={`p-4 rounded ${securityMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {securityMessage.text}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white p-2 border"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white p-2 border"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white p-2 border"
              />
            </div>

            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Update Password
            </button>
          </form>
        )}
      </div>
  );
}
