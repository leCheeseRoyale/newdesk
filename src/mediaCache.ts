const VIDEO_EXTS = /\.(mp4|webm|mov|avi|mkv|ogv)(\?.*)?$/i

export interface MediaEntry {
  element: HTMLImageElement | HTMLVideoElement
  loaded: boolean
  width: number
  height: number
  type: 'image' | 'video'
}

const cache = new Map<string, MediaEntry>()

export function getMedia(url: string): MediaEntry | null {
  const entry = cache.get(url)
  if (entry) return entry

  // Start loading
  loadMedia(url)
  return cache.get(url) ?? null
}

export function loadMedia(url: string): void {
  if (cache.has(url)) return

  const isVideo = VIDEO_EXTS.test(url)

  if (isVideo) {
    const video = document.createElement('video')
    const entry: MediaEntry = { element: video, loaded: false, width: 0, height: 0, type: 'video' }
    cache.set(url, entry)
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.onloadedmetadata = () => {
      entry.loaded = true
      entry.width = video.videoWidth
      entry.height = video.videoHeight
      video.play().catch(() => {})
    }
    video.src = url
  } else {
    const img = new Image()
    const entry: MediaEntry = { element: img, loaded: false, width: 0, height: 0, type: 'image' }
    cache.set(url, entry)
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      entry.loaded = true
      entry.width = img.naturalWidth
      entry.height = img.naturalHeight
    }
    img.src = url
  }
}
