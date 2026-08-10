import Image from "next/image";

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
  surface?: "theme" | "light" | "dark";
}

export function BrandLogo({ className = "", priority = false, surface = "theme" }: BrandLogoProps) {
  return (
    <span
      role="img"
      aria-label="TreinaVISA"
      data-surface={surface}
      className={`brand-logo relative inline-block aspect-[398/109] w-[11.25rem] overflow-hidden ${className}`}
    >
      <Image
        src="/brand/treinavisa-logo-on-light.png"
        alt=""
        aria-hidden="true"
        width={500}
        height={500}
        priority={priority}
        unoptimized
        className="brand-logo-on-light absolute h-auto max-w-none"
      />
      <Image
        src="/brand/treinavisa-logo-on-dark.png"
        alt=""
        aria-hidden="true"
        width={433}
        height={314}
        priority={priority}
        unoptimized
        className="brand-logo-on-dark absolute h-auto max-w-none"
      />
    </span>
  );
}
