export function LiquidBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#07060c]"
    >
      <div
        className="nyxora-orb-1 absolute -top-40 -left-32 size-[38rem] rounded-full opacity-40 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(124, 92, 255, 0.72) 0%, rgba(100, 65, 165, 0.32) 48%, transparent 72%)",
        }}
      />
      <div
        className="nyxora-orb-2 absolute top-1/4 -right-40 size-[42rem] rounded-full opacity-35 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(155, 114, 235, 0.62) 0%, rgba(67, 56, 202, 0.28) 50%, transparent 74%)",
        }}
      />
      <div
        className="nyxora-orb-3 absolute -bottom-44 left-1/3 size-[36rem] rounded-full opacity-30 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle at center, rgba(168, 85, 247, 0.45) 0%, rgba(45, 27, 84, 0.4) 52%, transparent 75%)",
        }}
      />
    </div>
  );
}
