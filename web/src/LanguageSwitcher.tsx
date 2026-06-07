import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("tr") ? "tr" : "en";
  const next = current === "tr" ? "en" : "tr";
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8"
      title={next === "tr" ? "Türkçe" : "English"}
      onClick={() => void i18n.changeLanguage(next)}
    >
      <span className="text-[11px] font-semibold uppercase">{current}</span>
    </Button>
  );
}
