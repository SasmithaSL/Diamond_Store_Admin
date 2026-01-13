/**
 * Get the base API URL without /api suffix
 */
export function getBaseApiUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  // Remove /api if present
  return apiUrl.replace(/\/api$/, '');
}

/**
 * Construct image URL from image path
 */
export function getImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  
  const baseUrl = getBaseApiUrl();
  // Remove any leading slashes from imagePath
  const cleanPath = imagePath.replace(/^\/+/, '');
  const url = `${baseUrl}/uploads/${cleanPath}`;
  
  // Add cache busting timestamp
  return `${url}?t=${Date.now()}`;
}

/**
 * Handle image load error with logging
 */
export function handleImageError(
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  imagePath: string | null | undefined,
  fallbackSvg?: string
) {
  const img = e.target as HTMLImageElement;
  const attemptedUrl = img.src;
  
  console.error('Failed to load image:', {
    imagePath,
    attemptedUrl,
    error: 'Image load failed'
  });
  
  // Set fallback SVG
  if (fallbackSvg) {
    img.src = fallbackSvg;
  } else {
    // Default fallback
    img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="128" height="128"%3E%3Crect fill="%23ddd" width="128" height="128" rx="64"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="48"%3E👤%3C/text%3E%3C/svg%3E';
  }
}



