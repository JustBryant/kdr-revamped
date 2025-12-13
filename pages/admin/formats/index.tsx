import React from 'react';
import Layout from '../../../components/Layout';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

export default function FormatsList() {
  const { data: session, status } = useSession();
  const router = useRouter();

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
      <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Select a Format</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/admin/formats/kdr" className="block group">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 group-hover:border-blue-500">
              <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                KDR
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                The official format
              </p>
            </div>
          </Link>
          
          {/* Placeholder for future formats */}
          {/* 
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 opacity-50 bg-gray-50 dark:bg-gray-900">
            <h2 className="text-2xl font-bold mb-2 text-gray-500">
              Coming Soon
            </h2>
            <p className="text-gray-400">
              More formats in development
            </p>
          </div> 
          */}
        </div>
      </div>
  );
}
