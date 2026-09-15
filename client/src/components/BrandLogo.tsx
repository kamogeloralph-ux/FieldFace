type BrandLogoProps = {
  inverse?: boolean;
  className?: string;
};

export default function BrandLogo({ inverse = false, className = "" }: BrandLogoProps) {
  return (
    <img
      src={inverse ? "/fieldface-logo-white.png" : "/fieldface-logo-transparent.png"}
      alt="FieldFace"
      width={971}
      height={227}
      loading="eager"
      decoding="sync"
      fetchPriority="high"
      className={`block h-8 w-auto object-contain ${className}`}
    />
  );
}
