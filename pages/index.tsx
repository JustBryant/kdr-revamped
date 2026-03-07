import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import ThemeToggle from '../components/ThemeToggle'
import ClassImage from '../components/common/ClassImage'

export default function Home() {
  const [classes, setClasses] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const tabs = [
    { title: 'Patch Notes', content: '...', link: '/patch-notes' },
    { title: 'New Classes', content: '...' },
    { title: 'Format Info', content: '...' }
  ]

  useEffect(() => {
    fetch('/api/classes')
      .then(res => res.json())
      .then(data => setClasses(data.slice(0, 5)))
      .catch(err => console.error(err))

    const timer = setInterval(() => {
      setActiveTab(t => (t + 1) % tabs.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="min-h-screen bg-[#0b0f19] dark:bg-[#0b0f19] light:bg-gray-50 text-gray-100 dark:text-gray-100 light:text-gray-900 font-sans selection:bg-indigo-500/30 transition-colors">
      <Head>
        <title>KDR Revamped | A Roguelike Experience</title>
        <meta name="description" content="A fully custom crafted format, featuring a wide range of classes with their own unique gameplay." />
      </Head>

      {/* Hero Section */}
      <section className="relative h-[85vh] flex flex-col items-center justify-center overflow-hidden px-4">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 z-0 text-white">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[150px] animate-pulse delay-1000"></div>
          <div className="absolute inset-0 bg-[url('/images/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-10 dark:opacity-10 light:opacity-5"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-5xl space-y-12">
          {/* Main Logo Image */}
          <div className="relative group">
            <div className="absolute -inset-4 bg-indigo-500/20 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
            <img 
              src="/images/KDRLogo.png" 
              alt="KDR Logo" 
              className="w-64 md:w-96 drop-shadow-[0_0_30px_rgba(79,70,229,0.4)] animate-float dark:invert-0 light:invert transition-all"
            />
          </div>

          <div className="space-y-6 text-white">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase italic text-gray-100 dark:text-gray-100 light:text-gray-900">
              A <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-500">Roguelike</span> Experience
            </h1>
            <p className="text-gray-400 dark:text-gray-400 light:text-gray-600 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
              A fully custom crafted format, featuring a wide range of classes with their own unique gameplay.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 pt-4 w-full sm:w-auto">
            <Link href="/kdr" className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest rounded-xl transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] text-sm">
              Play KDR
            </Link>
            <Link href="/classes" className="px-10 py-4 bg-white/5 dark:bg-white/5 light:bg-gray-200 hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-gray-300 text-white dark:text-white light:text-gray-900 font-black uppercase tracking-widest rounded-xl border border-white/10 dark:border-white/10 light:border-gray-300 backdrop-blur-md transition-all hover:scale-105 text-sm">
              Explore Classes
            </Link>
          </div>
        </div>
      </section>

      {/* Rotating Info & Stats Section */}
      <section className="max-w-7xl mx-auto px-6 py-24 border-t border-white/5 dark:border-white/5 light:border-gray-200">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          
          {/* Information Carousel */}
          <div className="lg:col-span-2 space-y-8">
            <div className="flex gap-6 border-b border-white/5 dark:border-white/5 light:border-gray-200 pb-4">
              {tabs.map((tab, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveTab(idx)}
                  className={`text-xs font-black uppercase tracking-widest transition-all ${activeTab === idx ? 'text-indigo-400 translate-y-[-2px]' : 'text-gray-500 dark:text-gray-500 light:text-gray-400 hover:text-gray-300 dark:hover:text-gray-300 light:hover:text-gray-600'}`}
                >
                  {tab.title}
                </button>
              ))}
            </div>
            
            <div className="min-h-[200px] flex flex-col justify-center animate-fadeIn text-gray-100 dark:text-gray-100 light:text-gray-900">
              <h2 className="text-3xl font-bold mb-4">{tabs[activeTab].title}</h2>
              <div className="flex flex-col gap-4">
                <div className="h-2 w-full max-w-md bg-white/5 rounded-full animate-pulse"></div>
                <div className="h-2 w-full max-w-sm bg-white/5 rounded-full animate-pulse"></div>
                <div className="h-2 w-full max-w-xs bg-white/5 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Quick Stats / Class Glimpse */}
          <div className="bg-white/[0.02] dark:bg-white/[0.02] light:bg-white border border-white/5 dark:border-white/5 light:border-gray-200 rounded-3xl p-8 backdrop-blur-sm space-y-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400">Featured Classes</h3>
            <div className="space-y-4">
              {classes.length > 0 ? classes.map((cls, i) => (
                <Link key={i} href={`/classes/view/${cls.id}`} className="flex items-center gap-4 group hover:bg-white/5 dark:hover:bg-white/5 light:hover:bg-gray-100 p-2 rounded-xl transition-all">
                  <div className="w-12 h-12 rounded-lg bg-black/40 dark:bg-black/40 light:bg-gray-100 border border-white/10 dark:border-white/10 light:border-gray-200 flex items-center justify-center overflow-hidden p-1">
                    <ClassImage image={cls.image} className="w-full h-full object-contain" alt={cls.name} />
                  </div>
                  <div>
                    <div className="font-bold group-hover:text-indigo-400 transition-colors uppercase text-sm tracking-tight text-white dark:text-white light:text-gray-900">{cls.name}</div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Active Class</div>
                  </div>
                </Link>
              )) : (
                <div className="text-gray-600 text-xs italic py-4">Loading featured classes...</div>
              )}
            </div>
            <Link href="/classes/list" className="block text-center text-[10px] font-black uppercase tracking-[0.2em] py-4 border-t border-white/5 dark:border-white/5 light:border-gray-200 text-gray-400 dark:text-gray-400 light:text-gray-500 hover:text-white dark:hover:text-white light:hover:text-gray-900 transition-colors">
              View All Classes →
            </Link>
          </div>
        </div>
      </section>

      {/* Interactive Footer */}
      <footer className="py-12 border-t border-white/5 dark:border-t border-white/5 light:border-gray-200 text-center px-6">
        <div className="flex flex-col items-center space-y-4">
          <img src="/images/KDRLogo.png" className="h-8 opacity-30 grayscale dark:invert-0 light:invert" alt="KDR Logo" />
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-600">
            KDR REDESIGN // 2026 // PROTOTYPE
          </p>
        </div>
      </footer>

      <style jsx>{`
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
