import React from "react";
import BrandLogo from "@/components/BrandLogo";

export default function AuthLayout({ icon: _icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <BrandLogo variant="mark" markClassName="h-20 w-20 mx-auto" className="block mb-2" />
          <BrandLogo variant="wordmark" wordClassName="h-6" className="justify-center mb-6" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-3xl shadow-[0_20px_50px_-30px_hsl(var(--hero-from)/0.45)] border border-border p-7">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}
