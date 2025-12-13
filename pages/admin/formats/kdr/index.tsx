import React from 'react';
import Layout from '../../../../components/Layout';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function KDRDashboard() {
  const { data: session, status } = useSession();

  if (status === 'loading') return <div>Loading...</div>;

  if (!session || session.user?.role !== 'ADMIN') {
    return (
      <div className="text-center py-10">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center mb-8">
          <Link href="/admin/formats" className="text-blue-600 hover:underline mr-4">
            &larr; Back to Formats
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">KDR Dashboard</h1>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/admin/classes" className="block group">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 group-hover:border-blue-500 flex flex-col items-center justify-center text-center h-48">
              <div className="text-4xl mb-4">⚔️</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Classes
              </h2>
            </div>
          </Link>

          <Link href="/admin/formats/kdr/generic-skills" className="block group">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 group-hover:border-blue-500 flex flex-col items-center justify-center text-center h-48">
              <div className="text-4xl mb-4">⚡</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Generic Skills
              </h2>
            </div>
          </Link>

          <Link href="/admin/formats/kdr/generic-loot" className="block group">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 group-hover:border-blue-500 flex flex-col items-center justify-center text-center h-48">
              <div className="text-4xl mb-4">💰</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Generic Loot
              </h2>
            </div>
          </Link>

          <Link href="/admin/formats/kdr/treasures" className="block group">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 group-hover:border-blue-500 flex flex-col items-center justify-center text-center h-48">
              <div className="text-4xl mb-4">💎</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Treasures
              </h2>
            </div>
          </Link>

          <Link href="/admin/formats/kdr/settings" className="block group">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 group-hover:border-blue-500 flex flex-col items-center justify-center text-center h-48">
              <div className="text-4xl mb-4">⚙️</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Settings
              </h2>
            </div>
          </Link>
        </div>
      </div>
  );
}
