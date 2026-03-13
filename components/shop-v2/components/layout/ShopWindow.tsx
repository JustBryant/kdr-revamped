import React, { ReactNode, forwardRef } from 'react'

const ShopWindow = forwardRef<HTMLDivElement, { children: ReactNode }>(({ children }, ref) => {
  return (
    <div
      ref={ref}
      className="relative min-h-[72vh] max-h-[72vh] bg-white/6 dark:bg-white/6 border-2 border-gray-200 dark:border-gray-700 rounded-lg flex flex-col p-6 overflow-y-auto shadow-lg custom-scrollbar"
      style={{ boxShadow: '0 10px 40px rgba(2,6,23,0.6)' }}
    >
      {children}
    </div>
  )
})

export default ShopWindow
