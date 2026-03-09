import { useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconPhoto } from '@tabler/icons-react';

interface PreviewPhotoTabProps {
  photos: string[];
}

/**
 * Shared photo carousel tab for preview panels.
 * Matches the Figma wireframe: rounded image with chevron nav buttons,
 * dot indicators at the bottom.
 */
export function PreviewPhotoTab({ photos }: PreviewPhotoTabProps) {
  const [photoIndex, setPhotoIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#fafafa]">
        <IconPhoto size={64} className="text-[#d4d4d4]" />
        <p className="text-sm text-[#a3a3a3] mt-2">写真なし</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center p-5">
      {/* Image container with rounded corners */}
      <div className="relative w-full flex-1 min-h-0 rounded-lg overflow-hidden">
        <img
          src={photos[photoIndex]}
          alt=""
          className="w-full h-full object-cover"
        />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-[#f5f5f5] rounded-full p-1 hover:bg-[#e5e5e5] transition-colors border-none cursor-pointer"
              onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
            >
              <IconChevronLeft size={24} />
            </button>
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#f5f5f5] rounded-full p-1 hover:bg-[#e5e5e5] transition-colors border-none cursor-pointer"
              onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
            >
              <IconChevronRight size={24} />
            </button>
          </>
        )}
      </div>
      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="flex items-center gap-1.5 mt-3">
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`size-2 rounded-full transition-colors border-none p-0 cursor-pointer ${i === photoIndex ? 'bg-[#0a0a0a]' : 'bg-[#d4d4d4]'}`}
              onClick={() => setPhotoIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
