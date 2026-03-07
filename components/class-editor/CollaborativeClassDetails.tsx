import React, { useEffect, useMemo, useState } from 'react'
import useCollaborative from '../collab/useCollaborative'
import ClassDetailsEditor, { ClassDetails } from './ClassDetailsEditor'
import { useRouter } from 'next/router'

interface Props {
  details: ClassDetails
  onChange: (d: ClassDetails) => void
  onEditSkillExtras?: () => void
  onEditRelicExtras?: () => void
  send?: (payload: any) => void
  me?: any
  peers?: Record<string, any>
}

export default function CollaborativeClassDetails({ details, onChange, onEditSkillExtras, onEditRelicExtras, send, me, peers }: Props) {
  const [local, setLocal] = useState<ClassDetails>(details)

  useEffect(() => {
    setLocal(details)
  }, [details.name, details.isPublic, details.image, details.skillName, details.skillDescription, details.questDescription, details.relicDescription])

  // broadcast local changes when they happen (debounced)
  useEffect(() => {
    if (!send) return
    const t = setTimeout(() => {
      send({ section: 'classDetails', data: local, ts: Date.now(), user: me })
    }, 350)
    return () => clearTimeout(t)
  }, [local, send, me])

  return (
    <div>
      <ClassDetailsEditor
        details={local}
        onChange={(d) => { setLocal(d); onChange && onChange(d) }}
        onEditSkillExtras={onEditSkillExtras}
        onEditRelicExtras={onEditRelicExtras}
        collabSend={send}
        me={me}
        peers={peers}
      />
    </div>
  )
}
