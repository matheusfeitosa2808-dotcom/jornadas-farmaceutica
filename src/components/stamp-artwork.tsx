import type { CSSProperties } from "react";
import FarmaArenaStamp from "@/components/farma-arena-stamp";
import { isLegacyFarmaArenaStamp } from "@/lib/farma-arena";

export function resolvedStampColor(category: any, activity?: any) {
  return (
    activity?.stampColor ||
    category?.stampColor ||
    category?.color ||
    "#174f58"
  );
}

export function StampArtwork({
  src,
  color,
  alt,
  className = "",
}: {
  src?: string | null;
  color?: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) return null;
  if (isLegacyFarmaArenaStamp(src))
    return <FarmaArenaStamp className={className} alt={alt} />;

  return (
    <span
      className={`tinted-stamp ${className}`.trim()}
      role="img"
      aria-label={alt}
      style={
        {
          "--stamp-image": `url("${src}")`,
          "--stamp-color": color || "#174f58",
        } as CSSProperties
      }
    >
      <img src={src} alt="" aria-hidden="true" />
    </span>
  );
}
