import logoSrc from "@/assets/finanzas-personales-logo.png";
import type { CSSProperties, ImgHTMLAttributes } from "react";

interface LogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  theme?: "light" | "dark";
}

export function Logo({ theme: _theme = "dark", className, style, ...props }: LogoProps) {
  return (
    <img
      src={logoSrc}
      alt="Finanzas Personales"
      className={className}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        objectFit: "contain",
        ...(style as CSSProperties | undefined),
      }}
      {...props}
    />
  );
}
