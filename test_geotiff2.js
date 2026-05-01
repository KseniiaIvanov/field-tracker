import { fromArrayBuffer } from 'geotiff'
import fs from 'fs'

async function testFile(filePath) {
  console.log(`\nTesting: ${filePath.split('/').pop()}`)
  console.log('='.repeat(60))
  
  const buffer = fs.readFileSync(filePath)
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  
  const tiff = await fromArrayBuffer(arrayBuffer)
  const image = await tiff.getImage()
  
  console.log('\n✅ Methods available on image:')
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(image))
    .filter(m => typeof image[m] === 'function' && m.includes('Tiepoint') || m.includes('PixelScale') || m.includes('Geotransform'))
  console.log(`   ${methods.length > 0 ? methods.join(', ') : 'None found with those names'}`)
  
  // Try various methods
  console.log('\n🔧 Trying different methods:')
  
  if (typeof image.getTiePoints === 'function') {
    try {
      const tp = await image.getTiePoints()
      console.log(`   getTiePoints(): ${JSON.stringify(tp)}`)
    } catch (e) {
      console.log(`   getTiePoints(): Error - ${e.message}`)
    }
  }
  
  if (typeof image.getPixelScale === 'function') {
    try {
      const ps = await image.getPixelScale()
      console.log(`   getPixelScale(): ${JSON.stringify(ps)}`)
    } catch (e) {
      console.log(`   getPixelScale(): Error - ${e.message}`)
    }
  }
  
  if (typeof image.getBoundingBox === 'function') {
    try {
      const bb = await image.getBoundingBox()
      console.log(`   getBoundingBox(): ${JSON.stringify(bb)}`)
    } catch (e) {
      console.log(`   getBoundingBox(): Error - ${e.message}`)
    }
  }
  
  // Check fileDirectory
  if (image.fileDirectory) {
    console.log('\n📁 fileDirectory properties:')
    console.log(`   ModelTiepoint: ${image.fileDirectory.ModelTiepoint ? 'EXISTS' : 'missing'}`)
    console.log(`   ModelPixelScale: ${image.fileDirectory.ModelPixelScale ? 'EXISTS' : 'missing'}`)
    if (image.fileDirectory.ModelTiepoint) {
      console.log(`      Value: ${JSON.stringify(image.fileDirectory.ModelTiepoint.slice(0, 6))}`)
    }
    if (image.fileDirectory.ModelPixelScale) {
      console.log(`      Value: ${JSON.stringify(image.fileDirectory.ModelPixelScale)}`)
    }
  }
}

await testFile('/Users/kseniiaivanova/Library/Mobile Documents/com~apple~CloudDocs/MPI/Abisko2025/GIS/test/soc.tif')
await testFile('/Users/kseniiaivanova/Library/Mobile Documents/com~apple~CloudDocs/MPI/Abisko2025/GIS/test/veg_height.tif')
