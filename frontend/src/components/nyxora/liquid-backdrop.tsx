export function LiquidBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background"
    >
      <div
        className="nyxora-orb-1 absolute -top-[18vmax] -left-[14vmax] h-[62vmax] w-[72vmax] rounded-[44%] opacity-55 blur-[100px]"
        style={{
          background:
            "radial-gradient(circle at 40% 45%, color-mix(in srgb, var(--primary) 60%, transparent) 0%, color-mix(in srgb, var(--accent) 45%, transparent) 46%, transparent 74%)",
        }}
      />
      <div
        className="nyxora-orb-2 absolute -top-[10vmax] -right-[16vmax] h-[60vmax] w-[68vmax] rounded-[46%] opacity-45 blur-[110px]"
        style={{
          background:
            "radial-gradient(circle at 55% 45%, color-mix(in srgb, var(--highlight) 35%, transparent) 0%, color-mix(in srgb, var(--primary) 35%, transparent) 48%, transparent 74%)",
        }}
      />
      <div
        className="nyxora-orb-3 absolute -bottom-[18vmax] left-[6vmax] h-[58vmax] w-[66vmax] rounded-[42%] opacity-45 blur-[110px]"
        style={{
          background:
            "radial-gradient(circle at 50% 55%, color-mix(in srgb, var(--ring) 42%, transparent) 0%, color-mix(in srgb, var(--accent) 40%, transparent) 50%, transparent 75%)",
        }}
      />
      <div
        className="nyxora-orb-4 absolute -bottom-[14vmax] -right-[10vmax] h-[56vmax] w-[64vmax] rounded-[48%] opacity-40 blur-[105px]"
        style={{
          background:
            "radial-gradient(circle at 45% 50%, color-mix(in srgb, var(--highlight) 30%, transparent) 0%, color-mix(in srgb, var(--primary) 32%, transparent) 48%, transparent 74%)",
        }}
      />
    </div>
  );
}
