import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const response = await fetch('https://api.github.com/repos/JustBryant/KDR-Revamped-Images/contents/class_images', { headers: { Accept: 'application/vnd.github.v3+json' } })
    
    if (!response.ok) {
      console.error('GitHub API Error:', response.status, response.statusText)
      const errorBody = await response.text()
      console.error('GitHub API Response:', errorBody)
      throw new Error(`Failed to fetch images from GitHub: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    // Filter for image files and return their names
    const images = data
      .filter((item: any) => item.type === 'file' && /\.(jpg|jpeg|png|webp)$/i.test(item.name))
      .map((item: any) => item.name)

    // Cache for short period at CDN
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=59')
    return res.status(200).json(images)
  } catch (error) {
    console.error('Error fetching class images:', error)
    res.status(500).json({ message: 'Failed to fetch class images' })
  }
}
