const fs = require('node:fs/promises')
const path = require('node:path')
const { inflateRawSync } = require('node:zlib')

function extractPng(archive) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (archive.subarray(0, 8).equals(signature)) {
    return archive
  }
  for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65557); offset--) {
    if (archive.readUInt32LE(offset) !== 0x06054b50) {
      continue
    }
    const entryCount = archive.readUInt16LE(offset + 10)
    let entryOffset = archive.readUInt32LE(offset + 16)
    for (let index = 0; index < entryCount; index++) {
      if (archive.readUInt32LE(entryOffset) !== 0x02014b50) {
        throw new Error('Invalid image archive')
      }
      const method = archive.readUInt16LE(entryOffset + 10)
      const compressedBytes = archive.readUInt32LE(entryOffset + 20)
      const nameBytes = archive.readUInt16LE(entryOffset + 28)
      const extraBytes = archive.readUInt16LE(entryOffset + 30)
      const commentBytes = archive.readUInt16LE(entryOffset + 32)
      const localOffset = archive.readUInt32LE(entryOffset + 42)
      entryOffset += 46 + nameBytes + extraBytes + commentBytes
      const contentOffset =
        localOffset +
        30 +
        archive.readUInt16LE(localOffset + 26) +
        archive.readUInt16LE(localOffset + 28)
      const content = archive.subarray(contentOffset, contentOffset + compressedBytes)
      let image
      if (method === 0) {
        image = content
      } else if (method === 8) {
        image = inflateRawSync(content)
      }
      if (image?.subarray(0, 8).equals(signature)) {
        return image
      }
    }
    break
  }
  throw new Error('No PNG in generation response')
}

async function generateCharacter() {
  const referenceIndex = process.argv.indexOf('--reference')
  const referenceImage = referenceIndex >= 0 ? process.argv[referenceIndex + 1] : undefined
  if (referenceIndex >= 0 && (!referenceImage || referenceImage.startsWith('--'))) {
    throw new Error('--reference requires an image path')
  }
  const isEdit = process.argv.includes('--edit-current') || Boolean(referenceImage)
  const strongerEdit = process.argv.includes('--stronger-edit')
  let variant = 1
  if (referenceImage) {
    variant = 6
  } else if (strongerEdit) {
    variant = 3
  } else if (isEdit) {
    variant = 2
  }
  const outputPath = path.resolve(`public/assets/character-pixel-v${variant}.png`)
  try {
    await fs.access(outputPath)
    throw new Error('Output already exists; refusing to generate another billed image')
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
  const apiToken = process.env.NOVELAI_API_TOKEN
  if (!apiToken) {
    throw new Error('Set NOVELAI_API_TOKEN in the process environment')
  }
  const initialPrompt =
    'artist:ahiru_tokotoko, year 2025, masterpiece, best quality, very aesthetic, rating:general, pixel art, 16-bit, limited palette, crisp pixel edges, dithering, retro game character portrait, 1girl, solo, adult woman, blue hair, long hair, blue eyes, whale-shaped hair ornament, white jacket, blue sailor collar, long sleeves, fully clothed, holding a small blue notebook, upper body, looking at viewer, gentle confident smile, centered composition, light blue and white color palette, simple pale blue background, small pixel clouds, no text'
  const editPrompt =
    'artist:ahiru_tokotoko, year 2025, masterpiece, best quality, very aesthetic, rating:general, pixel art, 16-bit, limited palette, crisp pixel edges, dithering, retro game character portrait, 1girl, solo, adult woman, blue eyes, long blue hair fading to pale icy blue tips, gradient hair, {{whale-fin ears}}, {{white frilled maid headdress}}, {{navy blue and white maid dress}}, white apron, white frilled collar, small blue ribbon at neck, long sleeves, fully clothed, small blue whale tail visible beside shoulder, holding the same small blue notebook, upper body, looking at viewer, gentle confident smile, centered composition, same face and pose, light blue and white color palette, simple pale blue background, small pixel clouds, no text'
  let prompt = isEdit ? editPrompt : initialPrompt
  if (referenceImage) {
    prompt =
      'artist:ahiru_tokotoko, year 2025, rating:general, {{pixel art}}, low resolution pixel art, limited color palette, large flat color clusters, crisp stair-stepped outlines, hard cel shading, minimal shading, retro game portrait, 1girl, solo, adult woman, long blue hair, blue eyes, whale-fin ears, white frilled maid headdress, navy blue and white maid dress, white apron, dark blue bow at neck, long sleeves, fully clothed, blue whale tail, holding a small blue notebook against chest, upper body, looking at viewer, gentle smile, head tilt, light blue background, small pixel clouds, same character, same pose, no text'
  }
  const baseNegative =
    'nsfw, nude, child, loli, cleavage, underwear, bad anatomy, extra fingers, extra limbs, worst quality, low quality, blurry, photorealistic, 3d, text, watermark, signature, logo, multiple views, cropped head'
  let negative = isEdit
    ? baseNegative + ', sailor collar, sailor uniform, school uniform, whale hair clip'
    : baseNegative
  if (referenceImage) {
    negative +=
      ', smooth gradients, airbrush, painterly, glossy, complex shading, rainbow colors, excessive detail, smooth outlines'
  }
  const payload = {
    input: prompt,
    model: 'nai-diffusion-4-5-full',
    action: isEdit ? 'img2img' : 'generate',
    parameters: {
      params_version: 3,
      width: 832,
      height: 1024,
      steps: 28,
      scale: strongerEdit ? 6.5 : 5,
      cfg_rescale: 0.5,
      n_samples: 1,
      seed: 28662966,
      sampler: 'k_euler_ancestral',
      noise_schedule: 'karras',
      qualityToggle: false,
      ucPreset: 3,
      negative_prompt: negative,
      sm: false,
      sm_dyn: false,
      dynamic_thresholding: false,
      legacy: false,
      legacy_v3_extend: false,
      v4_prompt: {
        caption: { base_caption: prompt, char_captions: [] },
        use_coords: false,
        use_order: true,
      },
      v4_negative_prompt: {
        caption: { base_caption: negative, char_captions: [] },
        legacy_uc: false,
      },
    },
  }
  if (isEdit) {
    let strength = 0.57
    if (referenceImage) {
      strength = 0.45
    } else if (strongerEdit) {
      strength = 0.8
    }
    Object.assign(payload.parameters, {
      image: (await fs.readFile(referenceImage || 'public/assets/character-pixel-v1.png')).toString(
        'base64',
      ),
      strength,
      noise: referenceImage ? 0.02 : 0.08,
      extra_noise_seed: 28662967,
      deliberate_euler_ancestral_bug: false,
      prefer_brownian: true,
    })
  }
  const response = await fetch('https://image.novelai.net/ai/generate-image', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: 'application/zip',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(180000),
  })
  if (!response.ok) {
    const detail = (await response.text()).replace(/pst-[\w-]+/g, '[redacted]').slice(0, 250)
    throw new Error(`NovelAI HTTP ${response.status}: ${detail}`)
  }
  const image = extractPng(Buffer.from(await response.arrayBuffer()))
  await fs.writeFile(outputPath, image, { flag: 'wx' })
  await fs.mkdir('outputs', { recursive: true })
  await fs.writeFile(
    isEdit
      ? `outputs/pixel-character-v${variant}-recipe.json`
      : 'outputs/pixel-character-recipe.json',
    JSON.stringify(
      {
        provider: 'NovelAI',
        endpoint: 'https://image.novelai.net/ai/generate-image',
        ...payload,
        parameters: { ...payload.parameters, image: undefined },
        referenceImage: isEdit
          ? referenceImage || 'public/assets/character-pixel-v1.png'
          : undefined,
        outputPath,
      },
      null,
      2,
    ) + '\n',
  )
  console.log(JSON.stringify({ generated: true, outputPath, bytes: image.length }))
}

generateCharacter().catch((error) => {
  console.error(String(error.message).replace(/pst-[\w-]+/g, '[redacted]'))
  process.exitCode = 1
})
