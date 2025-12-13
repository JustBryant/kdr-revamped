import Head from 'next/head'

export default function Home() {
  return (
    <>
      <Head>
        <title>KDR Revamped</title>
        <meta name="description" content="KDR custom format — prototype" />
      </Head>
      <main className="container mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-4 text-blue-600">KDR Revamped</h1>
        <p className="text-gray-700">Prototype workspace. Next: design mode, auth, database.</p>
      </main>
    </>
  )
}
