import React from "react";

export function Skeleton({ className = "", style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ backgroundColor: "var(--border)", ...style }}
      {...props}
    />
  );
}
