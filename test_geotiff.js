import { fromArrayBuffer } from 'geotiff'
import fs from 'fs'

async function testFile(filePath) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Testing: ${filePath.split('/').pop()}`)
  console.log('='.repeat(60))
  
  const buffer = fs.readFileSync(filePath)
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  
  const tiff = await fromArrayBuffer(arrayBuffer)
  const image = await tiff.getImage()
  
  console.log('\n📊 Basic Info:')
  console.log(`   Width: ${image.getWidth()}`)
  console.log(`   Height: ${image.getHeight()}`)
  console.log(`   SamplesPerPixel: ${image.getSamplesPerPixel()}`)
  
  console.log('\n🔍 GeoKeys:')
  const geoKeys = image.geoKeys || {}
  console.log(`   ModelPixelScale: ${JSON.stringify(geoKeys.ModelPixelScale)}`)
  console.log(`   ModelTiepoint: ${JSON.stringify(geoKeys.ModelTiepoint)}`)
  console.log(`   ProjectedCSTypeGeoKey: ${geoKeys.ProjectedCSTypeGeoKey}`)
  
  console.log('\n📐 Geotransform Calculation:')
  const tiepoint = geoKeys.ModelTiepoint || []
  const pixelScale = geoKeys.ModelPixelScale || []
  
  if (tiepoint.length >= 5) {
    console.log(`   Tiepoint: [${tiepoint.slice(0, 5).join(', ')}]`)
    console.log(`   - pixelCol: ${tiepoint[0]}`)
    console.log(`   - pixelRow: ${tiepoint[1]}`)
    console.log(`   - worldX: ${tiepoint[3]}`)
    console.log(`   - worldY: ${tiepoint[4]}`)
  } else {
    console.log(`   Tiepoint: MISSING or INVALID`)
  }
  
  if (pixelScale.length >= 2) {
    console.log(`   PixelScale: [${pixelScale[0]}, ${pixelScale[1]}]`)
  } else {
    console.log(`   PixelScale: MISSING or INVALID`)
  }
  
  // Try getGeoKeys async method
  if (typeof image.getGeoKeys === 'function') {
    try {
      const asyncKeys = await image.getGeoKeys()
      console.log('\n🔑 Async getGeoKeys():')
      if (asyncKeys) {
        console.log(`   ProjectedCSTypeGeoKey: ${asyncKeys.ProjectedCSTypeGeoKey}`)
        console.log(`   GeographicTypeGeoKey: ${asyncKeys.GeographicTypeGeoKey}`)
      } else {
        console.log(`   Returned null`)
      }
    } catch (e) {
      console.log(`   Error: ${e.message}`)
    }
  }
}

await testFile('/Users/kseniiaivanova/Library/Mobile Documents/com~apple~CloudDocs/MPI/Abisko2025/GIS/test/soc.tif')
await testFile('/Users/kseniiaivanova/Library/Mobile Documents/com~apple~CloudDocs/MPI/Abisko2025/GIS/test/veg_height.tif')
