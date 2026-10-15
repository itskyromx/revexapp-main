import React from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children, showBack = false }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      {showBack && typeof document !== "undefined" && createPortal(
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          title="Go back"
          style={{ top: "max(1rem, env(safe-area-inset-top))", right: "1rem", zIndex: 1000 }}
          className="sticker !fixed bg-card w-9 h-9 rounded-full flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>,
        document.body
      )}
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Icon className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}
