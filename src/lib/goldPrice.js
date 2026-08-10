import { base44 } from "@/api/base44Client";

export async function fetchGoldPricesMulti() {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt:
      "Carikan harga emas per gram di Indonesia saat ini dari beberapa sumber publik yang berbeda (mis. Antam/Aneka Logam, Pegadaian, Logam Mulia, Galeri24, EmasKita, atau situs lain). Untuk setiap sumber berikan: nama sumber, harga per gram dalam Rupiah, URL referensi, dan tanggal data. Jawab dalam JSON berisi array 'sources'. Pastikan harga realistis (ratusan ribu hingga jutaan rupiah per gram).",
    add_context_from_internet: true,
    response_json_schema: {
      type: "object",
      properties: {
        sources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source: { type: "string" },
              price_per_gram: { type: "number" },
              url: { type: "string" },
              date: { type: "string" },
            },
          },
        },
      },
    },
  });
  return (result.sources || []).filter((s) => s.price_per_gram > 0);
}