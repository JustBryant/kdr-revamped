// Simple Markdown-to-HTML parser for Patch Notes
// Optimized for KDR Revamped with class/card embedding support

import ClassImage from './common/ClassImage'

export function parseMarkdown(text: string) {
  if (!text) return ''

  let html = text
    // Escaping
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-white">$1</strong>')
    
    // Italic
    .replace(/\*(.*?)\*/g, '<em class="italic opacity-80">$1</em>')
    
    // Colors: [red]text[/red]
    .replace(/\[(red|blue|green|yellow|purple|orange|indigo|pink)\](.*?)\[\/\1\]/g, (match, color, content) => {
      const colors: Record<string, string> = {
        red: 'text-red-500',
        blue: 'text-blue-500',
        green: 'text-green-500',
        yellow: 'text-yellow-500',
        purple: 'text-purple-500',
        orange: 'text-orange-500',
        indigo: 'text-indigo-500',
        pink: 'text-pink-500'
      }
      return `<span class="${colors[color]} font-bold">${content}</span>`
    })

    // Font Sizes: [size=lg]text[/size]
    .replace(/\[size=(xs|sm|base|lg|xl|2xl|3xl)\](.*?)\[\/size\]/g, (match, size, content) => {
      const sizes: Record<string, string> = {
        xs: 'text-xs',
        sm: 'text-sm',
        base: 'text-base',
        lg: 'text-lg',
        xl: 'text-xl',
        '2xl': 'text-2xl',
        '3xl': 'text-3xl'
      }
      return `<span class="${sizes[size]}">${content}</span>`
    })

    .replace(/\[img\](.*?)\[\/img\]/g, '<div class="my-4 flex justify-center"><img src="$1" class="rounded-xl border border-white/10 shadow-lg max-h-96 object-contain" /></div>')

  return html
}

export function ClassIcon({ name, size = "xs" }: { name: string, size?: "xs" | "sm" | "md" }) {
  const sizes = {
    xs: 'w-5 h-5',
    sm: 'w-8 h-8',
    md: 'w-12 h-12'
  }
  
  return (
    <span className="inline-flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded border border-white/10 mx-1 align-middle group hover:bg-white/10 transition-colors">
      <div className={`${sizes[size]} flex-shrink-0`}>
        <ClassImage image={`${name}.png`} alt={name} />
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 group-hover:text-blue-300 transition-colors">{name}</span>
    </span>
  )
}

export function RichTextRenderer({ content }: { content: string }) {
  // Handle Class Embedding: {class:Name}
  // Handle Card Embedding: {card:ID}
  
  const parts = content.split(/(\{class:.*?\}|\{card:.*?\})/g)

  return (
    <div className="rich-text-content leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith('{class:')) {
          const className = part.replace('{class:', '').replace('}', '')
          return <ClassIcon key={i} name={className} />
        }
        
        // Basic card mention (visual only for now)
        if (part.startsWith('{card:')) {
          const cardName = part.replace('{card:', '').replace('}', '')
          return (
            <span key={i} className="text-indigo-400 font-bold underline decoration-indigo-500/30 cursor-help">
              {cardName}
            </span>
          )
        }

        return <span key={i} dangerouslySetInnerHTML={{ __html: parseMarkdown(part) }} />
      })}
    </div>
  )
}
