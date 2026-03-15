// Simple Markdown-to-HTML parser for Patch Notes
// Optimized for KDR Revamped with class/card embedding support

import ClassImage from './common/ClassImage'
import Icon from './Icon'

export interface StatRequirement {
  stat: 'STR' | 'DEX' | 'INT' | 'LUK' | 'FOR' | 'CON'
  value: number
  affectedTextSnippet?: string
  template?: string
  divisor?: number
}

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

export interface PlayerStats {
  STR?: number
  DEX?: number
  INT?: number
  LUK?: number
  FOR?: number
  CON?: number
  [key: string]: number | undefined
}

export function RichTextRenderer({ content, stats, requirements, inline = false }: { content: string; stats?: PlayerStats; requirements?: StatRequirement[]; inline?: boolean }) {
  // 1. Handle Conditional Blocks: [if DEX>=4]This text appears if DEX is at least 4[/if]
  // Pattern: [if STAT OP VAL]content[/if]
  const processConditions = (text: string) => {
    // 1. First, let the standard markdown handle things
    let processedText = parseMarkdown(text);

    // 2. Handle Conditional Blocks: [if DEX>=4]This text appears if DEX is at least 4[/if]
    // Note: We need to handle BOTH escaped and unescaped tags since parseMarkdown was called
    if (!stats) {
      processedText = processedText.replace(/\[if [\s\S]*?\]([\s\S]*?)\[\/if\]/g, (match, inner) => {
        return `<span class="opacity-40 italic border-l-2 border-white/10 pl-2 block my-1">${inner}</span>`
      })
    } else {
      processedText = processedText.replace(/\[if (STR|DEX|INT|LUK|FOR|CON)([><]=?|=)(\d+)\]([\s\S]*?)\[\/if\]/g, (match, stat, op, val, inner) => {
        const playerVal = stats[stat as keyof PlayerStats] || 0
        const threshold = parseInt(val)
        
        let met = false
        if (op === '>') met = playerVal > threshold
        else if (op === '<') met = playerVal < threshold
        else if (op === '>=') met = playerVal >= threshold
        else if (op === '<=') met = playerVal <= threshold
        else if (op === '=') met = playerVal === threshold

        if (met) {
          return `<span class="text-blue-400 font-bold border-l-2 border-blue-500 pl-2 block my-1 animate-pulse-slow">${inner}</span>`
        }
        return `<span class="opacity-30 line-through decoration-white/20 block my-1 text-xs">${inner}</span>`
      })
    }

    // 2. Handle Snippet-based requirements (The New System)
    if (requirements && requirements.length > 0) {
      requirements.forEach(req => {
        if (!req.affectedTextSnippet) return

        const playerVal = stats ? (stats[req.stat] || 0) : 0
        const met = playerVal >= req.value

        // Escape regex special chars in the snippet
        const escapedSnippet = req.affectedTextSnippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedSnippet, 'g');

        if (met) {
          processedText = processedText.replace(regex, `<span class="text-amber-400 font-bold drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] transition-all duration-500">${req.affectedTextSnippet}</span>`)
        } else {
          processedText = processedText.replace(regex, `<span class="opacity-30 grayscale blur-[0.5px] line-through decoration-amber-900/40 select-none cursor-not-allowed" title="Requires ${req.value} ${req.stat}">${req.affectedTextSnippet}</span>`)
        }
      })
    }

    // 3. Handle Scaling Requirements: {n} substitution
    if (requirements && requirements.length > 0) {
      requirements.forEach(req => {
        if (req.template && req.template.includes('{n}')) {
          const playerVal = stats ? (stats[req.stat as keyof PlayerStats] || 0) : 0
          const divisor = req.divisor || 1
          const nValue = Math.floor(playerVal / divisor)
          
          // Use green/emerald for scaling
          const nStyled = `<span class="text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">${nValue}</span>`
          const scalingText = req.template.replace('{n}', nStyled)
          
          // Append as a dedicated UI block
          processedText += `<div class="mt-2 p-2 bg-emerald-900/20 border border-emerald-500/30 rounded text-xs text-emerald-100/90 italic animate-in fade-in slide-in-from-bottom-1 duration-700">${scalingText}</div>`
        }
      })
    }

    return processedText
  }

  const processedContent = processConditions(content)
  
  // Handle Class Embedding: {class:Name}
  // Handle Card Embedding: {card:ID}
  
  const parts = processedContent.split(/(\{class:.*?\}|\{card:.*?\})/g)

  const Component = inline ? 'span' : 'div'

  return (
    <Component className={`rich-text-content leading-relaxed ${inline ? 'inline' : ''}`}>
      {parts.map((part, i) => {
        if (part.startsWith('{class:')) {
          const className = part.replace('{class:', '').replace('}', '')
          return <Icon key={i} name={className} className="inline-block w-6 h-6 object-contain -mt-1 ml-1" />
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

        return <span key={i} dangerouslySetInnerHTML={{ __html: part }} />
      })}
    </Component>
  )
}

