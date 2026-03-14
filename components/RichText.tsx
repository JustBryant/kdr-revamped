// Simple Markdown-to-HTML parser for Patch Notes
// Optimized for KDR Revamped with class/card embedding support

import ClassImage from './common/ClassImage'
import Icon from './Icon'

export interface StatRequirement {
  stat: 'STR' | 'DEX' | 'INT' | 'LUK' | 'FOR' | 'CON'
  // Optional: compute `n` from multiple stats by taking the max
  statOptions?: Array<'STR' | 'DEX' | 'INT' | 'LUK' | 'FOR' | 'CON'>
  // mode: 'max' -> use max(selected stats) / divisor (default)
  // 'threshold_count' -> count how many selected stats meet >= threshold
  // 'per_stat' -> use per-stat divisors in `perStatDivisors` and take the max of floor(stat/divisor)
  mode?: 'max' | 'threshold_count' | 'per_stat'
  threshold?: number
  perStatDivisors?: Record<string, number>
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
  // Small safe expression evaluator for inline {expr} where `n` and stat
  // variables (STR, DEX, INT, CHA, LUK, FOR, CON) are available. Also
  // supports `max(a,b,...)` and `min(a,b,...)` via the provided args.
  const safeEvalExpr = (expr: string, nVal: number, statsObj?: PlayerStats): string | null => {
    if (!expr || typeof expr !== 'string') return null
    const cleaned = expr.trim()
    // Basic allowed characters (numbers, letters, operators, parentheses, commas, spaces, dot)
    if (!/^[0-9A-Za-z_+\-*/().,\s]+$/.test(cleaned)) return null
    // Disallow suspicious tokens
    const forbidden = ['__proto__', 'constructor', 'process', 'global', 'window', 'eval', 'Function']
    for (const f of forbidden) if (cleaned.includes(f)) return null

    // Allowed variable names
    const vars = ['n','STR','DEX','INT','CHA','LUK','FOR','CON','max','min']
    const args = vars
    const values: any[] = [Number(nVal)]
    const upperStats: Record<string, number> = {}
    const statKeys = statsObj ? Object.keys(statsObj) : []
    statKeys.forEach(k => { upperStats[k.toUpperCase()] = Number((statsObj as any)[k] || 0) })
    for (let i=1;i<vars.length-2;i++) {
      values.push(upperStats[vars[i]] || 0)
    }
    // push helper functions
    values.push(Math.max)
    values.push(Math.min)

    try {
      // Create function with named args for safety
      // eslint-disable-next-line no-new-func
      const fn = Function(...args, 'return (' + cleaned + ')')
      const result = fn(...values)
      if (typeof result === 'number' && isFinite(result)) return String(Math.floor(result))
      if (typeof result === 'string') return result
      return null
    } catch (e) {
      return null
    }
  }

  // Compute the base stat value for a requirement. If `statOptions` is
  // present, return the maximum value among those stats (defaults to 0).
  const computeStatValue = (req: StatRequirement, statsObj?: PlayerStats): number => {
    if (!statsObj) return 0
    const opts = (req as any).statOptions as string[] | undefined
    if (opts && Array.isArray(opts) && opts.length > 0) {
      const vals = opts.map(s => {
        const key = s.toUpperCase()
        return Number((statsObj as any)[key] || (statsObj as any)[s] || 0)
      })
      return Math.max(...vals, 0)
    }
    const key = req.stat as keyof PlayerStats
    return Number((statsObj as any)[key] || 0)
  }

  // Compute the `n` value for a requirement according to different modes.
  // - 'max' (default): floor(max(selectedStats) / divisor)
  // - 'threshold_count': count(stats >= threshold)
  // - 'per_stat': for each stat, compute floor(stat / perStatDivisors[stat]||divisor) and take max
  const computeN = (req: StatRequirement, statsObj?: PlayerStats): number => {
    if (!req) return 0
    const mode = (req as any).mode || 'max'
    if (mode === 'threshold_count') {
      const threshold = (req as any).threshold ?? (req.value ?? 1)
      const opts = (req as any).statOptions && (req as any).statOptions.length > 0 ? (req as any).statOptions : [req.stat && String(req.stat).toUpperCase()].filter(Boolean)
      let count = 0
      for (const s of opts) {
        const val = Number(statsObj?.[s] ?? statsObj?.[String(s).toLowerCase()] ?? 0)
        if (val >= threshold) count++
      }
      return count
    }

    if (mode === 'per_stat') {
      const opts = (req as any).statOptions && (req as any).statOptions.length > 0 ? (req as any).statOptions : [req.stat && String(req.stat).toUpperCase()].filter(Boolean)
      const per = (req as any).perStatDivisors || {}
      let best = 0
      for (const s of opts) {
        const statVal = Number(statsObj?.[s] ?? statsObj?.[String(s).toLowerCase()] ?? 0)
        const div = per[s] ?? req.divisor ?? 1
        const n = Math.floor(Number(statVal) / Number(div || 1))
        if (n > best) best = n
      }
      return best
    }

    // default 'max' behavior
    const base = computeStatValue(req, statsObj)
    return Math.floor(Number(base) / Number(req.divisor || 1))
  }

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

        const playerVal = computeStatValue(req, stats)
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
          const nValue = computeN(req, stats)

          // Replace any {expr} occurrences inside the template using nValue
          const templateRendered = req.template.replace(/\{([^}]+)\}/g, (m, expr) => {
            const val = safeEvalExpr(expr, nValue, stats)
            if (val !== null) {
              return `<span class="text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">${val}</span>`
            }
            return m
          })

          // Append as a dedicated UI block
          processedText += `<div class="mt-2 p-2 bg-emerald-900/20 border border-emerald-500/30 rounded text-xs text-emerald-100/90 italic animate-in fade-in slide-in-from-bottom-1 duration-700">${templateRendered}</div>`
        }
      })
    }

    return processedText
  }

  const processedContent = processConditions(content)

  // Build a small visible summary for stat requirements so editors / admin UIs
  // (which may not have a player `stats` object) can still show what the
  // skill/card scaling or hard requirements would look like. When no
  // `stats` are provided we default numeric values (n) to 0 as requested.
  let requirementsSummary = ''
  if (requirements && requirements.length > 0) {
    const parts: string[] = []
    for (const req of requirements) {
      const statKey = req.stat
      // Prefer explicit value (threshold) when present
      if (typeof (req as any).value === 'number') {
        parts.push(`Requires ${ (req as any).value } ${ statKey }`)
      } else if (req.template) {
        const nValue = computeN(req, stats)
        const rendered = req.template.replace(/\{([^}]+)\}/g, (m, expr) => {
          const v = safeEvalExpr(expr, nValue, stats)
          return v !== null ? v : m
        })
        parts.push(rendered)
      } else if (typeof (req as any).divisor === 'number' && req.template) {
        const nValue = computeN(req, stats)
        parts.push(req.template.replace('{n}', String(nValue)))
      }
    }

    if (parts.length > 0) {
      requirementsSummary = `<div class="mb-2 p-2 bg-gray-800/30 dark:bg-gray-200/5 border border-gray-700 dark:border-gray-600 rounded text-xs text-gray-200/90 dark:text-gray-300 italic">${parts.map(p=>`<div class=\"leading-tight\">${p}</div>`).join('')}</div>`
    }
  }
  
  

  // Replace inline expression occurrences like {n*100} in the main content.
  // Use the first requirement to derive `n` when available; default n=0.
  let processedContentWithExpr = processedContent
  if (requirements && requirements.length > 0) {
    const primary = requirements[0]
    const primaryN = computeN(primary, stats)
    processedContentWithExpr = processedContent.replace(/\{(?!class:)(?!card:)([^}]+)\}/g, (m, expr) => {
      const out = safeEvalExpr(expr, primaryN, stats)
      return out !== null ? out : m
    })
  } else {
    // no requirements -> n = 0
    processedContentWithExpr = processedContent.replace(/\{(?!class:)(?!card:)([^}]+)\}/g, (m, expr) => {
      const out = safeEvalExpr(expr, 0, stats)
      return out !== null ? out : m
    })
  }
  
  // Handle Class Embedding: {class:Name}
  // Handle Card Embedding: {card:ID}
  
  const finalContent = requirementsSummary + processedContentWithExpr
  const parts = finalContent.split(/(\{class:.*?\}|\{card:.*?\})/g)

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

