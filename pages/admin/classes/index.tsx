import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Link from 'next/link'
import { prisma } from '../../../lib/prisma'
import { CLASS_IMAGE_BASE_URL } from '../../../lib/constants'

interface ClassItem {
  id: string
  name: string
  image?: string | null
}

interface ClassListProps {
  classes: ClassItem[]
}

export default function ClassList({ classes }: ClassListProps) {
  return (
    <>
      <Head>
        <title>Class Editor | KDR Revamped</title>
      </Head>
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-12 grid grid-cols-3 items-center">
          <div></div>
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white text-center">Class Editor</h1>
          <div className="flex justify-end">
            <Link 
              href="/admin/classes/editor"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-bold transition-colors shadow-sm"
            >
              New Class
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {classes.map((cls) => (
            <Link 
              key={cls.id} 
              href={`/admin/classes/editor?id=${cls.id}`}
              className="group flex flex-col items-center"
            >
              <div className="w-full relative mb-1 transition-transform group-hover:scale-105">
                {cls.image ? (
                  <img 
                    src={`${CLASS_IMAGE_BASE_URL}/${cls.image}`} 
                    alt={cls.name} 
                    className="w-full h-auto drop-shadow-md"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                    <div className="text-gray-400 dark:text-gray-500 text-center p-4">
                      <div className="text-4xl mb-2">?</div>
                      <div className="text-xs uppercase font-bold">No Image</div>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-lg font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 text-center">
                {cls.name}
              </span>
            </Link>
          ))}
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

  const classes = await prisma.class.findMany({
    select: {
      id: true,
      name: true,
      image: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  return {
    props: { 
      session,
      classes: JSON.parse(JSON.stringify(classes)), // Serialize dates if any
    },
  }
}
