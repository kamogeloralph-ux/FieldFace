type BrandLogoProps = {
  inverse?: boolean;
  className?: string;
};

export default function BrandLogo({ inverse = false, className = "" }: BrandLogoProps) {
  return (
    <img
      src={inverse ? "/fieldface-logo-white.png" : "/fieldface-logo.png"}
      alt="FieldFace"
      className={`block h-8 w-auto object-contain ${className}`}
    />
  );
}
