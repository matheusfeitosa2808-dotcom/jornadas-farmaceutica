import {
  FARMA_ARENA_FIRE_URL,
  FARMA_ARENA_STAMP_URL,
} from "@/lib/farma-arena";

export default function FarmaArenaStamp({
  className = "",
  alt = "Carimbo especial da Farma Arena",
  animated = true,
}: {
  className?: string;
  alt?: string;
  animated?: boolean;
}) {
  return (
    <span className={`farma-arena-badge ${className}`.trim()}>
      {animated && (
        <img
          className="farma-arena-badge__fire"
          src={FARMA_ARENA_FIRE_URL}
          alt=""
          aria-hidden="true"
        />
      )}
      <img
        className="farma-arena-badge__art"
        src={FARMA_ARENA_STAMP_URL}
        alt={alt}
      />
    </span>
  );
}
