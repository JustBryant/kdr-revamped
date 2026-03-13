import React, { ReactNode } from 'react'

export default function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  )
}
