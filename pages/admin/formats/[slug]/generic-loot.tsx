import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import LootPoolEditor from '../../../../components/class-editor/LootPoolEditor';
import { LootPool } from '../../../../types/class-editor';
import { useRouter } from 'next/router';

export default function GenericLootEditor() {
  const { data: session, status } = useSession();
  const [pools, setPools] = useState<LootPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const slug = Array.isArray(router.query.slug) ? router.query.slug[0] : router.query.slug as string | undefined;

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPools();
    }
  }, [status]);

  const fetchPools = async () => {
    try {
      const res = await axios.get('/api/loot/generic');
      setPools(res.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch generic loot', error);
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.post('/api/loot/generic', { pools });
      alert('Generic loot saved successfully!');
    } catch (error) {
      console.error('Failed to save generic loot', error);
      alert('Failed to save generic loot');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) return <div>Loading...</div>;

  if (!session || session.user?.role !== 'ADMIN') {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const base = `/admin/formats/${slug}`;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Link href={base} className="text-blue-600 hover:underline mr-4">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Generic Loot Pools</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <LootPoolEditor 
        pools={pools} 
        onChange={setPools} 
        tierLabels={{
          'STARTER': 'Staples',
          'MID': 'Removal/Disruption',
          'HIGH': 'Engine'
        }}
      />
    </div>
  );
}
