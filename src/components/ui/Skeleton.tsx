type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-xl border border-white/10 bg-white/5",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[sweep_1.4s_ease-in-out_infinite] before:bg-linear-to-r before:from-transparent before:via-white/10 before:to-transparent",
        className,
      ].join(" ")}
      aria-hidden="true"
    />
  );
}
