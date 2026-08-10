import Image from "next/image";

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
}

export function BrandLogo({ className = "", priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/brand/treinavisa-logo-light.png"
      alt="TreinaVISA"
      width={500}
      height={157}
      priority={priority}
      className={`h-auto w-[9.75rem] ${className}`}
    />
  );
}
