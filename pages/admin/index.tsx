import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Link from 'next/link'

export default function AdminIndex() {
  return (
    <>
      <Head>
        <title>Admin | KDR Revamped</title>
      </Head>

      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Admin</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Quick links to administrative sections.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
          <Link
            href="/admin/formats"
            className="block p-6 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Formats</h2>
            <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">Manage game formats and rules (KDR, etc.).</p>
          </Link>

          <Link
            href="/admin/users"
            className="block p-6 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Users</h2>
            <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">View and manage user accounts and roles.</p>
          </Link>

          <Link
            href="/admin/shopkeepers"
            className="block p-6 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Shopkeepers</h2>
            <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">Edit shopkeepers, dialogues and inventory.</p>
          </Link>

          <Link
            href="/admin/formats/kdr"
            className="block p-6 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">KDR Format</h2>
            <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">KDR-specific format settings and treasures.</p>
          </Link>

          <Link
            href="/admin/cosmetics"
            className="block p-6 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Cosmetic Shop</h2>
            <p className="text-sm text-gray-500 dark:text-gray-300 mt-1">Manage cosmetic names, prices, and visibility.</p>
          </Link>
        </div>
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)

  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    }
  }

  // Enforce admin-only access
  if ((session as any).user?.role !== 'ADMIN') {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    }
  }

  return { props: {} }
}
