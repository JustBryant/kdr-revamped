import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import Link from 'next/link'
import { prisma } from '../../../../lib/prisma'
import ClassImage from '../../../../components/common/ClassImage'
import React from 'react'

interface ClassItem {
  id: string
  name: string
  image?: string | null
}

interface Props {
  classes: ClassItem[]
  formatName?: string
  slug?: string
}

export default function ClassList({ classes, formatName, slug }: Props) {
  return (
    <>
      <Head>
        <title>{`Class Editor${formatName ? ` — ${formatName}` : ''} | Admin`}</title>
      </Head>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-12 grid grid-cols-3 items-center">
          <div>
            <Link href={slug ? `/admin/formats/${encodeURIComponent(slug)}` : '/admin/formats'} className="text-blue-600 hover:underline">&larr; Back</Link>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white text-center">Class Editor{formatName ? ` — ${formatName}` : ''}</h1>
          <div className="flex justify-end">
            <Link
              href={slug ? `/admin/formats/${encodeURIComponent(slug)}/classes/editor` : '/admin/classes/editor'}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-bold transition-colors shadow-sm"
            >
              New Class
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {classes.filter((cls: any) => !cls.parentClassId).map((cls: any) => (
            <div key={cls.id} className="flex flex-col gap-4">
              <Link 
                href={slug ? `/admin/formats/${encodeURIComponent(slug)}/classes/editor?id=${cls.id}` : `/admin/classes/editor?id=${cls.id}`}
                className="group flex flex-col items-center"
              >
                <div className="w-full relative mb-1 transition-transform group-hover:scale-105">
                  {cls.image ? (
                    <ClassImage
                      image={cls.image}
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
              
              {/* Admin Subclasses List */}
              {cls.subclasses && cls.subclasses.length > 0 && (
                <div className="flex flex-col gap-2 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Subclasses ({cls.subclasses.length})</p>
                  <div className="grid grid-cols-4 gap-2">
                    {cls.subclasses.map((sub: any) => (
                      <Link 
                        key={sub.id}
                        href={slug ? `/admin/formats/${encodeURIComponent(slug)}/classes/editor?id=${sub.id}` : `/admin/classes/editor?id=${sub.id}`}
                        className="relative group/sub"
                        title={sub.name}
                      >
                        <div className="aspect-square relative transition-transform group-hover/sub:scale-110">
                           {sub.image ? (
                            <img src={`/images/classes/${sub.image}`} alt={sub.name} className="w-full h-full object-contain" />
                           ) : (
                             <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-sm" />
                           )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const session = await getSession(context as any)

    if (!session) {
      return {
        redirect: {
          destination: '/api/auth/signin',
          permanent: false,
        },
      }
    }

    const raw = context.params?.slug
    const slug = Array.isArray(raw) ? raw[0] : raw as string | undefined
    if (!slug) {
      return {
        redirect: {
          destination: '/admin/formats',
          permanent: false,
        },
      }
    }

    const format = await prisma.format.findUnique({ where: { slug } })
    if (!format) {
      return {
        redirect: {
          destination: '/admin/formats',
          permanent: false,
        },
      }
    }

    // Some environments may still be running an older Prisma client without
    // the `FormatClass` model. Guard against that to avoid runtime crashes
    // and fall back to listing all classes (safe default).
    const prismaAny = prisma as any
    let classes: any[] = []

    if (prismaAny.formatClass && typeof prismaAny.formatClass.findMany === 'function') {
      try {
        const links: any[] = await prismaAny.formatClass.findMany({
          where: { formatId: format.id },
          include: { 
            class: { 
              select: { 
                id: true, 
                name: true, 
                image: true,
                parentClassId: true,
                subclasses: {
                  select: { id: true, name: true, image: true }
                }
              } 
            } 
          }
        })
        classes = links.map((l: any) => l.class).sort((a: any, b: any) => a.name.localeCompare(b.name))
      } catch (err: any) {
        // If the underlying table doesn't exist or another DB error occurs,
        // gracefully fall back to the legacy classes list rather than crashing.
        console.warn('Error querying FormatClass; falling back to all classes list', err?.message || err)
        try {
          classes = await prisma.class.findMany({ select: { id: true, name: true, image: true }, orderBy: { name: 'asc' } })
        } catch (e) {
          console.error('Error querying classes table as fallback', e)
          classes = []
        }
      }
    } else {
      console.warn('Prisma client missing FormatClass model; falling back to all classes list')
      try {
        classes = await prisma.class.findMany({ select: { id: true, name: true, image: true }, orderBy: { name: 'asc' } })
      } catch (e) {
        console.error('Error querying classes table as fallback', e)
        classes = []
      }
    }

    return {
      props: {
        classes: JSON.parse(JSON.stringify(classes)),
        formatName: format.name,
        slug,
        session,
      },
    }
  } catch (err) {
    console.error('getServerSideProps error for admin format classes:', err)
    // Fail gracefully — return empty props so the page still renders client-side
    return {
      props: {
        classes: [],
        formatName: null,
        slug: null,
        session: null
      }
    }
  }
}
