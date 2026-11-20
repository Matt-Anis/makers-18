export function LiquidBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#07060c]"
    >
      <div
        className="nyxora-orb-1 absolute -top-[18vmax] -left-[14vmax] h-[62vmax] w-[72vmax] rounded-[44%] opacity-70 blur-[100px]"
        style={{
          background:
            "radial-gradient(circle at 40% 45%, rgba(124, 92, 255, 0.65) 0%, rgba(100, 65, 165, 0.38) 46%, transparent 74%)",
        }}
      />
      <div
        className="nyxora-orb-2 absolute -top-[10vmax] -right-[16vmax] h-[60vmax] w-[68vmax] rounded-[46%] opacity-65 blur-[110px]"
        style={{
          background:
            "radial-gradient(circle at 55% 45%, rgba(168, 85, 247, 0.55) 0%, rgba(67, 56, 202, 0.34) 48%, transparent 74%)",
        }}
      />
      <div
        className="nyxora-orb-3 absolute -bottom-[18vmax] left-[6vmax] h-[58vmax] w-[66vmax] rounded-[42%] opacity-60 blur-[110px]"
        style={{
          background:
            "radial-gradient(circle at 50% 55%, rgba(99, 102, 241, 0.52) 0%, rgba(45, 27, 84, 0.45) 50%, transparent 75%)",
        }}
      />
      <div
        className="nyxora-orb-4 absolute -bottom-[14vmax] -right-[10vmax] h-[56vmax] w-[64vmax] rounded-[48%] opacity-60 blur-[105px]"
        style={{
          background:
            "radial-gradient(circle at 45% 50%, rgba(155, 114, 235, 0.58) 0%, rgba(100, 65, 165, 0.32) 48%, transparent 74%)",
        }}
      />
    </div>
  );
}
