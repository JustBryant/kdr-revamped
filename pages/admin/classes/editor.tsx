import { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import StartingCardsEditor, { StartingSkill } from '../../../components/class-editor/StartingCardsEditor'
import LootPoolEditor from '../../../components/class-editor/LootPoolEditor'
import { DeckCard, LootPool } from '../../../types/class-editor'
import LegendaryMonsterPicker from '../../../components/class-editor/LegendaryMonsterPicker'
import ClassDetailsEditor, { ClassDetails } from '../../../components/class-editor/ClassDetailsEditor'
import TipSkillsEditor from '../../../components/class-editor/TipSkillsEditor'
import { Skill } from '../../../types/class-editor'

// Define Card interface here or import it if available globally
interface Card {
  id: string
  konamiId: number
  name: string
  type: string
  desc: string
  atk?: number
  def?: number
  level?: number
  race?: string
  attribute?: string
}

export default function ClassEditor() {
  const router = useRouter()
  const { id } = router.query
  const isNew = !id

  const [classDetails, setClassDetails] = useState<ClassDetails>({
    name: isNew ? 'New Class' : 'Existing Class',
    image: '',
    skillName: '',
    skillDescription: '',
    questDescription: '',
    relicDescription: ''
  })

  const [deck, setDeck] = useState<DeckCard[]>([])
  const [startingSkills, setStartingSkills] = useState<StartingSkill[]>([])
  const [lootPools, setLootPools] = useState<LootPool[]>([])
  const [tipSkills, setTipSkills] = useState<Skill[]>([])
  const [legendaryMonster, setLegendaryMonster] = useState<Card | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Fetch class data if editing
  useEffect(() => {
    if (!id) return

    const fetchClass = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/classes/${id}`)
        if (!res.ok) throw new Error('Failed to fetch class')
        
        const data = await res.json()
        
        // 1. Class Details
        const mainSkill = data.skills.find((s: any) => s.type === 'MAIN')
        setClassDetails({
          name: data.name,
          image: data.image || '',
          skillName: mainSkill?.name || '',
          skillDescription: mainSkill?.description || '',
          questDescription: data.legendaryQuest || '',
          relicDescription: data.legendaryRelic || ''
        })

        // 2. Deck
        setDeck(data.startingCards.map((sc: any) => ({
          ...sc.card,
          quantity: sc.quantity,
          category: sc.category
        })))

        // 3. Starting Skills
        setStartingSkills(data.skills.filter((s: any) => s.type === 'STARTING').map((s: any) => ({
          ...s,
          modifications: s.modifications.map((m: any) => ({
            ...m,
            card: m.card
          }))
        })))

        // 4. Tip Skills
        setTipSkills(data.skills.filter((s: any) => s.type === 'TIP'))

        // 5. Loot Pools
        setLootPools(data.lootPools.map((pool: any) => ({
          id: pool.id,
          name: pool.name,
          tier: pool.tier,
          tax: pool.tax,
          items: pool.items.map((item: any) => ({
            id: item.id,
            type: item.type,
            card: item.card,
            skill: item.type === 'Skill' ? {
              name: item.skillName,
              description: item.skillDescription
            } : undefined
          }))
        })))

        // 6. Legendary Monster
        setLegendaryMonster(data.legendaryMonsterCard)

      } catch (error) {
        console.error('Error loading class:', error)
        alert('Failed to load class data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchClass()
  }, [id])

  const handleSave = async (shouldRedirect = true) => {
    setIsSaving(true)
    try {
      const payload = {
        id: isNew ? undefined : id,
        ...classDetails,
        deck,
        startingSkills,
        lootPools,
        tipSkills,
        legendaryMonsterId: legendaryMonster?.id
      }

      const res = await fetch('/api/classes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || errorData.error || 'Failed to save class')
      }
      
      if (shouldRedirect) {
        router.push('/admin/classes')
      }
      return true
    } catch (error: any) {
      console.error('Error saving class:', error)
      alert(`Failed to save class: ${error.message}`)
      return false
    } finally {
      if (shouldRedirect) {
        setIsSaving(false)
      }
    }
  }

  const handleCreateSubclass = async () => {
    if (isNew || !id) return
    
    if (!confirm('Create a subclass? This will save the current changes first.')) {
      return
    }

    // Save first, but don't redirect
    const saved = await handleSave(false)
    if (!saved) {
      setIsSaving(false)
      return
    }

    try {
      const res = await fetch('/api/classes/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: id })
      })

      if (!res.ok) throw new Error('Failed to duplicate class')
      
      const newClass = await res.json()
      
      // Redirect to the new class editor
      // We use window.location.href to force a full reload or ensure the router picks up the new ID cleanly
      // but router.push should be fine.
      router.push(`/admin/classes/editor?id=${newClass.id}`)
    } catch (error) {
      console.error('Error creating subclass:', error)
      alert('Failed to create subclass')
      setIsSaving(false)
    }
  }

  return (
    <>
      <Head>
        <title>{isNew ? 'Create Class' : 'Edit Class'} | KDR Revamped</title>
      </Head>

      <div className="w-full px-6 py-8">
        {isLoading && (
          <div className="fixed inset-0 bg-white/80 dark:bg-gray-900/80 z-50 flex items-center justify-center">
            <div className="text-xl font-bold text-gray-600 dark:text-gray-300">Loading Class Data...</div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-8 border-b border-gray-200 dark:border-gray-700 pb-6">
          <div className="flex items-center">
            <button 
              onClick={() => router.back()}
              className="mr-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {isNew ? 'Create Class' : 'Edit Class'}
            </h1>
          </div>
          <div className="flex space-x-3">
            {!isNew && (
              <button
                onClick={handleCreateSubclass}
                disabled={isSaving}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium disabled:opacity-50"
              >
                Create Subclass
              </button>
            )}
            <button 
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
            >
              Discard
            </button>
            <button 
              onClick={() => handleSave(true)}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium shadow-sm disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Class'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Left Column: Main Content */}
          <div className="col-span-12 lg:col-span-9 space-y-8">
            {/* 1. Class Details */}
            <ClassDetailsEditor 
              details={classDetails}
              onChange={setClassDetails}
            />

            {/* 2. Starting Cards */}
            <StartingCardsEditor 
              deck={deck}
              onChange={setDeck}
              skills={startingSkills}
              onSkillsChange={setStartingSkills}
            />

            {/* 3. Loot Pools */}
            <LootPoolEditor 
              pools={lootPools}
              onChange={setLootPools}
            />

            {/* 4. Tip Skills */}
            <TipSkillsEditor 
              skills={tipSkills}
              onChange={setTipSkills}
            />
          </div>

          {/* Right Column: Sidebar */}
          <div className="col-span-12 lg:col-span-3 space-y-8">
            <LegendaryMonsterPicker 
              selectedCard={legendaryMonster}
              onChange={setLegendaryMonster}
            />
          </div>
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

  return {
    props: { session },
  }
}
