import { SVGProps } from "react";

interface LogoProps extends SVGProps<SVGSVGElement> {
  theme?: "light" | "dark";
}

export function Logo({ theme = "dark", className, ...props }: LogoProps) {
  const isDark = theme === "dark";

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="grad-dollar" x1="0" y1="100" x2="60" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="grad-arrow" x1="20" y1="90" x2="90" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <linearGradient id="grad-bar" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>
      </defs>

      {/* Dollar sign — vertical bar */}
      <line
        x1="40" y1="8" x2="40" y2="82"
        stroke={isDark ? "url(#grad-dollar)" : "currentColor"}
        strokeWidth="9"
        strokeLinecap="round"
      />

      {/* Dollar sign — S curve */}
      <path
        d="M54,20 C66,20 70,30 70,36 C70,46 56,50 40,54 C24,58 18,64 18,72 C18,80 26,86 40,86 C50,86 58,81 62,76"
        stroke={isDark ? "url(#grad-dollar)" : "currentColor"}
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />

      {/* Main large arrow shaft — diagonal bottom-left → top-right */}
      {/* Masking layer behind arrow to create overlap effect */}
      <path
        d="M18 88 L80 16"
        stroke={isDark ? "#0f172a" : "#ffffff"}
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d="M18 88 L80 16"
        stroke={isDark ? "url(#grad-arrow)" : "currentColor"}
        strokeWidth="11"
        strokeLinecap="round"
      />

      {/* Main arrow head (filled triangle) */}
      <polygon
        points="80,16 58,22 74,38"
        fill={isDark ? "#10b981" : "currentColor"}
      />

      {/* Secondary smaller arrow */}
      <path
        d="M42 94 L92 40"
        stroke={isDark ? "url(#grad-arrow)" : "currentColor"}
        strokeWidth="5.5"
        strokeLinecap="round"
        opacity="0.6"
      />
      <polygon
        points="92,40 78,46 88,58"
        fill={isDark ? "#10b981" : "currentColor"}
        opacity="0.6"
      />

      {/* Bar chart — ascending bars bottom-right */}
      <rect x="66" y="76" width="5" height="10" rx="1.5" fill={isDark ? "url(#grad-arrow)" : "currentColor"} opacity="0.4" />
      <rect x="73" y="69" width="5" height="17" rx="1.5" fill={isDark ? "url(#grad-arrow)" : "currentColor"} opacity="0.55" />
      <rect x="80" y="61" width="5" height="25" rx="1.5" fill={isDark ? "url(#grad-arrow)" : "currentColor"} opacity="0.7" />
      <rect x="87" y="52" width="5" height="34" rx="1.5" fill={isDark ? "url(#grad-arrow)" : "currentColor"} opacity="0.9" />
    </svg>
  );
}
