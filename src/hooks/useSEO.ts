import { useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";

interface SEOProps {
  title: string;
  description?: string;
}

export function useSEO({ title, description }: SEOProps) {
  const { tenant } = useTenant();
  const suffix = tenant?.name || "Engios";

  useEffect(() => {
    document.title = title === suffix ? title : `${title} — ${suffix}`;

    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (meta) {
        meta.setAttribute("content", description);
      }
    }
  }, [title, description, suffix]);
}