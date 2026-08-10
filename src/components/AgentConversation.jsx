import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";
import { Loader2, Send, Paperclip, X, Bot, User as UserIcon, ChevronDown, ChevronRight, Sparkles } from "lucide-react";

export default function AgentConversation({ agentName, title }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await base44.agents.listConversations({ agent_name: agentName });
        let conv = list && list[0];
        if (!conv) {
          conv = await base44.agents.createConversation({ agent_name: agentName, metadata: { name: title, description: title } });
        }
        if (!mounted) return;
        setConversation(conv);
        setMessages(conv.messages || []);
      } catch {
        /* ignore */
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [agentName]);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });
    return () => unsubscribe();
  }, [conversation?.id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === "user";
  const thinking = sending || lastIsUser;

  const send = async () => {
    if ((!input.trim() && !pendingFile) || !conversation || sending) return;
    setSending(true);
    try {
      let fileUrls;
      if (pendingFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: pendingFile });
        fileUrls = [file_url];
      }
      const conv = await base44.agents.addMessage(conversation, {
        role: "user",
        content: input.trim() || "Tolong proses struk ini.",
        ...(fileUrls ? { file_urls: fileUrls } : {}),
      });
      setConversation(conv);
      setMessages(conv.messages || []);
      setInput("");
      setPendingFile(null);
    } catch {
      /* ignore */
    }
    setSending(false);
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setPendingFile(f);
    e.target.value = "";
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Sparkles className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Asisten Struk AI</p>
            <p className="text-xs mt-1 max-w-xs">Kirim foto bon/struk, saya akan kategorikan transaksi & perbarui aset terkait secara otomatis.</p>
          </div>
        )}

        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}

        {thinking && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2.5">
              <Bot className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Asisten sedang berpikir</span>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {pendingFile && (
        <div className="px-4 pb-2 flex items-center gap-2">
          <div className="relative">
            <img src={URL.createObjectURL(pendingFile)} alt="preview" className="w-14 h-14 object-cover rounded-xl border border-border" />
            <button onClick={() => setPendingFile(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center">
              <X className="w-3 h-3" />
            </button>
          </div>
          <span className="text-xs text-muted-foreground truncate">{pendingFile.name}</span>
        </div>
      )}

      <div className="px-4 py-3 border-t border-border bg-background flex items-center gap-2">
        <button onClick={() => fileRef.current?.click()} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 active:scale-95 transition-transform">
          <Paperclip className="w-5 h-5 text-muted-foreground" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Tulis pesan atau kirim foto bon..."
          className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary/30 bg-transparent"
        />
        <button onClick={send} disabled={sending || (!input.trim() && !pendingFile)} className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-50 active:scale-95 transition-transform">
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div className={`max-w-[85%] ${isUser ? "" : ""}`}>
        <div className={`flex items-end gap-1.5 ${isUser ? "flex-row-reverse" : ""}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4 text-muted-foreground" />}
          </div>
          <div className={`rounded-2xl px-3.5 py-2.5 ${isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            {message.content ? (
              isUser ? (
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              ) : (
                <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              )
            ) : null}
          </div>
        </div>
        {message.tool_calls?.map((tc, idx) => <ToolCallDisplay key={idx} toolCall={tc} />)}
      </div>
    </div>
  );
}

function ToolCallDisplay({ toolCall }) {
  const [expanded, setExpanded] = useState(false);
  const status = tc_status(toolCall);
  const failed = ["failed", "error"].includes(status);
  const hide = toolCall.display_projection?.hide_details && toolCall.display_projection?.details_redacted;

  let parsedArgs = null;
  try { parsedArgs = JSON.parse(toolCall.arguments_string); } catch { parsedArgs = toolCall.arguments_string; }
  let parsedResults = null;
  try { parsedResults = JSON.parse(toolCall.results); } catch { parsedResults = toolCall.results; }

  const label = toolCall.display_projection?.label || toolCall.name;
  const activeLabel = toolCall.display_projection?.active_label || "Memproses...";
  const errorLabel = toolCall.display_projection?.error_label || "Gagal";

  return (
    <div className="mt-1.5 ml-8.5 text-xs">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-muted-foreground">
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span className="font-medium">{label}</span>
        <span className={failed ? "text-red-500" : "text-emerald-600"}>
          {status === "pending" || status === "running" || status === "in_progress" ? activeLabel : failed ? errorLabel : "Selesai"}
        </span>
      </button>
      {expanded && !hide && (
        <div className="mt-1 space-y-1">
          {parsedArgs && (
            <div>
              <p className="text-[10px] text-muted-foreground">Parameter:</p>
              <pre className="bg-muted rounded-lg p-2 overflow-x-auto text-[10px]">{JSON.stringify(parsedArgs, null, 2)}</pre>
            </div>
          )}
          {parsedResults != null && (
            <div>
              <p className="text-[10px] text-muted-foreground">Hasil:</p>
              <pre className="bg-muted rounded-lg p-2 overflow-x-auto text-[10px]">{typeof parsedResults === "string" ? parsedResults : JSON.stringify(parsedResults, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function tc_status(tc) {
  return tc.status || (tc.results && /error|failed/i.test(typeof tc.results === "string" ? tc.results : JSON.stringify(tc.results)) ? "error" : "completed");
}