import { Heart } from "lucide-react";
import { Image as SmartImage } from "@/components/ui/image";

// Foto bulat; tanpa foto → ikon hati (dipakai profil & profil pasangan).
export default function Avatar({ url, name, size = "w-14 h-14" }) {
  return (
    <div className={`${size} rounded-full overflow-hidden bg-primary/10 text-primary flex items-center justify-center shrink-0`}>
      {url ? <SmartImage src={url} alt={name || "foto"} className="w-full h-full" fittingType="fill" /> : <Heart className="w-6 h-6" />}
    </div>
  );
}
