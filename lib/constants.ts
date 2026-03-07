// Centralized constants and helpers for image URLs and other small utils.
export const CARD_IMAGE_BASE_URL = process.env.NEXT_PUBLIC_CARD_IMAGE_BASE_URL || '/cards';
export const CARD_FULL_IMAGE_BASE_URL = process.env.NEXT_PUBLIC_CARD_FULL_IMAGE_BASE_URL || '/card-fulls';
// Default card back image — use GitHub raw asset as canonical fallback
export const CARD_BACK_URL = process.env.NEXT_PUBLIC_CARD_BACK_URL || 'https://raw.githubusercontent.com/JustBryant/KDR-Revamped-Images/main/card_back/CardBack.jpg';
// Default to the GitHub raw URL for class images if not overridden by env
export const CLASS_IMAGE_BASE_URL = process.env.NEXT_PUBLIC_CLASS_IMAGE_BASE_URL || 'https://raw.githubusercontent.com/JustBryant/KDR-Revamped-Images/main/class_images';

export function getClassImageUrl(classKey: string | null | undefined) {
  if (!classKey) return `${CLASS_IMAGE_BASE_URL}/default.png`;
  // If the key already contains an extension, don't append .png
  if (/\.(png|jpg|jpeg|webp|gif)$/i.test(classKey)) {
    return `${CLASS_IMAGE_BASE_URL}/${classKey}`;
  }
  return `${CLASS_IMAGE_BASE_URL}/${classKey}.png`;
}
