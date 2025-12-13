import fs from 'fs'
import https from 'https'
import path from 'path'

const url = 'https://images.ygoprodeck.com/images/cards/7180418.jpg'
const filepath = path.join(process.cwd(), 'test_download.jpg')

const file = fs.createWriteStream(filepath)
https.get(url, (response) => {
  console.log('Status Code:', response.statusCode)
  response.pipe(file)
})
