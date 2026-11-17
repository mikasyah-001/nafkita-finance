// Pemeriksaan sementara: <select> asli + opsinya tetap ada di markup.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import NativeSelect from "@/components/NativeSelect";

const html = renderToStaticMarkup(
  React.createElement(
    NativeSelect,
    { id: "x", value: "b", onChange: () => {}, className: "w-full", sheetTitle: "T" },
    React.createElement("option", { value: "" }, "Kosong"),
    React.createElement("option", { value: "b" }, "Pilihan B")
  )
);

console.log(html);
const ok =
  html.includes('<select id="x"') &&
  html.includes('<option value="">Kosong</option>') &&
  html.includes('<option value="b" selected="">Pilihan B</option>');
console.log(ok ? "OK" : "FAIL");
process.exit(ok ? 0 : 1);