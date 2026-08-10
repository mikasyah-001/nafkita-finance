import { useNavigate } from "react-router-dom";
import AgentConversation from "@/components/AgentConversation";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function AsistenStruk() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      <header className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-background">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-sm leading-tight">Asisten Struk AI</h1>
            <p className="text-[10px] text-muted-foreground">Kategorikan transaksi & perbarui aset</p>
          </div>
        </div>
      </header>
      <AgentConversation agentName="asisten_struk" title="Asisten Struk" />
    </div>
  );
}