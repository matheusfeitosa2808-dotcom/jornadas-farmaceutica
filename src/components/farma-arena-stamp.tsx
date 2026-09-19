import { FARMA_ARENA_STAMP_URL } from "@/lib/farma-arena";

export default function FarmaArenaStamp({
  className = "",
  alt = "Carimbo especial da Farma Arena",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <span className={`farma-arena-badge ${className}`.trim()}>
      <img
        className="farma-arena-badge__art"
        src={FARMA_ARENA_STAMP_URL}
        alt={alt}
      />
    </span>
  );
}
