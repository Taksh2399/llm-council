import { useState, useRef, useEffect } from "react";
import "./App.css";
import { api } from "./api";

const SUGGESTIONS = [
  "What is the best mental model for making hard decisions under uncertainty?",
  "Explain the core ideas of antifragility and where they apply in real life",
  "How should a high-performer structure their week for deep work and recovery?",
];

const MODELS_SHORT = ["nemotron", "gpt-oss", "gemma", "llama"];

function Sidebar({ conversations, activeId, onSelect, onNew }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-mark">⟡</div>
          <span className="logo-text">Council</span>
        </div>
        <button className="new-chat-btn" onClick={onNew}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          New query
        </button>
      </div>

      {conversations.length > 0 && (
        <>
          <div className="sidebar-section-label">Recent</div>
          <div className="conversation-list">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`conversation-item ${c.id === activeId ? "active" : ""}`}
                onClick={() => onSelect(c.id)}
              >
                <div className="conv-title">{c.title || "Untitled"}</div>
                <div className="conv-meta">{c.message_count} msg</div>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}

function LoadingStages({ status }) {
  const stages = [
    { key: "stage1", label: "Individual responses", done: status === "stage2" || status === "stage3" || status === "done" },
    { key: "stage2", label: "Peer rankings", done: status === "stage3" || status === "done" },
    { key: "stage3", label: "Final synthesis", done: status === "done" },
  ];
  const current = status === "stage1" ? 0 : status === "stage2" ? 1 : status === "stage3" ? 2 : 3;

  return (
    <div className="loading-stage">
      {stages.map((s, i) => (
        <div className="loading-row" key={s.key}>
          <span className="loading-label">{s.label}</span>
          <div className="loading-bar" style={{
            background: s.done ? "var(--bg-4)" : i === current ? undefined : "var(--bg-4)"
          }}>
            {i === current && <span />}
            {s.done && (
              <div style={{ width: "100%", height: "100%", background: "var(--stage1)", borderRadius: "1px" }} />
            )}
          </div>
        </div>
      ))}
      <div className="loading-status">
        {status === "stage1" && "Consulting the council..."}
        {status === "stage2" && "Models reviewing each other..."}
        {status === "stage3" && "Chairman synthesizing..."}
      </div>
    </div>
  );
}

function ModelCard({ model, response }) {
  const [expanded, setExpanded] = useState(false);
  const shortName = model.split("/").pop().replace(/:free$/, "");
  return (
    <div className={`model-card ${expanded ? "expanded" : ""}`}>
      <div className="model-card-header" onClick={() => setExpanded(!expanded)}>
        <span className="model-name">{shortName}</span>
        <span className="expand-icon">{expanded ? "▲" : "▼"}</span>
      </div>
      <div className="model-card-body">{response}</div>
    </div>
  );
}

function RankingView({ stage2, metadata }) {
  const agg = metadata?.aggregate_rankings || [];
  if (!agg.length) {
    return (
      <div className="ranking-list">
        {stage2.map((r, i) => (
          <div className="ranking-item" key={i}>
            <span className="rank-num">{i + 1}</span>
            <span className="rank-model">{r.model.split("/").pop().replace(/:free$/, "")}</span>
          </div>
        ))}
      </div>
    );
  }
  const worst = agg[agg.length - 1]?.average_rank || 1;
  return (
    <div className="ranking-list">
      {agg.map((r, i) => (
        <div className="ranking-item" key={i}>
          <span className={`rank-num ${i === 0 ? "top" : ""}`}>#{i + 1}</span>
          <span className="rank-model">{r.model.split("/").pop().replace(/:free$/, "")}</span>
          <div className="rank-bar-wrap">
            <div className="rank-bar" style={{ width: `${((worst - r.average_rank + 1) / worst) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CouncilResponse({ msg }) {
  const [activeTab, setActiveTab] = useState("s3");
  const { stage1 = [], stage2 = [], stage3 = {}, metadata = {}, loadingStatus } = msg;
  const isLoading = !!loadingStatus && loadingStatus !== "done";

  if (isLoading && stage1.length === 0) {
    return (
      <div className="council-response">
        <div className="stage-content">
          <LoadingStages status={loadingStatus} />
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "s1", label: "Individual", color: "s1", available: stage1.length > 0 },
    { id: "s2", label: "Rankings", color: "s2", available: stage2.length > 0 },
    { id: "s3", label: "Final answer", color: "s3", available: !!stage3?.response },
  ].filter(t => t.available);

  if (!tabs.length) {
    return (
      <div className="council-response">
        <div className="stage-content">
          <LoadingStages status={loadingStatus || "stage1"} />
        </div>
      </div>
    );
  }

  const current = tabs.find(t => t.id === activeTab) ? activeTab : tabs[tabs.length - 1]?.id;

  return (
    <div className="council-response">
      <div className="stage-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`stage-tab ${tab.color} ${current === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className={`stage-dot ${tab.color}`} />
            {tab.label}
            {isLoading && tab.id === (loadingStatus === "stage1" ? "s1" : loadingStatus === "stage2" ? "s2" : "s3") && (
              <span style={{ marginLeft: 4, opacity: 0.5, fontSize: 10 }}>…</span>
            )}
          </button>
        ))}
      </div>
      <div className="stage-content">
        {current === "s1" && (
          <div className="model-cards">
            {stage1.map((r, i) => (
              <ModelCard key={i} model={r.model} response={r.response} />
            ))}
          </div>
        )}
        {current === "s2" && (
          <RankingView stage2={stage2} metadata={metadata} />
        )}
        {current === "s3" && stage3?.response && (
          <div>
            <div className="chairman-header">
              <span className="chairman-badge">Chairman</span>
              <span className="chairman-model">
                {stage3.model?.split("/").pop().replace(/:free$/, "")}
              </span>
            </div>
            <div className="final-answer">
              {stage3.response.split("\n").filter(Boolean).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        )}
        {current === "s3" && !stage3?.response && (
          <LoadingStages status={loadingStatus || "stage3"} />
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    api.listConversations().then(setConversations).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversation = async (id) => {
    setActiveId(id);
    try {
      const conv = await api.getConversation(id);
      const msgs = [];
      for (const m of conv.messages) {
        if (m.role === "user") msgs.push({ type: "user", content: m.content });
        else if (m.role === "assistant") {
          msgs.push({
            type: "council",
            stage1: m.stage1 || [],
            stage2: m.stage2 || [],
            stage3: m.stage3 || {},
            metadata: m.metadata || {},
          });
        }
      }
      setMessages(msgs);
    } catch (e) {
      console.error(e);
    }
  };

  const startNew = async () => {
    try {
      const conv = await api.createConversation();
      setActiveId(conv.id);
      setMessages([]);
      setConversations(prev => [{ id: conv.id, title: "New query", message_count: 0 }, ...prev]);
    } catch (e) {
      console.error(e);
    }
  };

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || sending) return;
    setInput("");

    let convId = activeId;
    if (!convId) {
      try {
        const conv = await api.createConversation();
        convId = conv.id;
        setActiveId(conv.id);
        setConversations(prev => [{ id: conv.id, title: "New query", message_count: 0 }, ...prev]);
      } catch (e) {
        console.error(e);
        return;
      }
    }

    setSending(true);
    setMessages(prev => [
      ...prev,
      { type: "user", content: q },
      { type: "council", stage1: [], stage2: [], stage3: null, metadata: {}, loadingStatus: "stage1" }
    ]);

    try {
      await api.sendMessageStream(convId, q, (type, data) => {
        setMessages(prev => {
          const msgs = [...prev];
          const last = { ...msgs[msgs.length - 1] };
          if (type === "stage1_complete") {
            last.stage1 = data.data || [];
            last.loadingStatus = "stage2";
          } else if (type === "stage2_complete") {
            last.stage2 = data.data || [];
            last.metadata = data.metadata || {};
            last.loadingStatus = "stage3";
          } else if (type === "stage3_complete") {
            last.stage3 = data.data || {};
            last.loadingStatus = "done";
          } else if (type === "title_complete") {
            setConversations(p => p.map(c =>
              c.id === convId ? { ...c, title: data.data?.title || c.title } : c
            ));
          }
          msgs[msgs.length - 1] = last;
          return msgs;
        });
      });
    } catch (e) {
      setMessages(prev => {
        const msgs = [...prev];
        const last = { ...msgs[msgs.length - 1] };
        last.stage3 = { model: "error", response: "Failed to reach the council. Check your connection." };
        last.loadingStatus = "done";
        msgs[msgs.length - 1] = last;
        return msgs;
      });
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={loadConversation}
        onNew={startNew}
      />
      <main className="main">
        <div className="ambient" />
        <div className="topbar">
          <span className="topbar-title">LLM Council</span>
          <div className="topbar-models">
            {MODELS_SHORT.map(m => (
              <span key={m} className="model-pill">{m}</span>
            ))}
          </div>
        </div>

        <div className="messages">
          <div className="messages-inner">
            {messages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-mark">⟡</div>
                <h1 className="empty-title">Ask the council</h1>
                <p className="empty-sub">Your query goes to four models simultaneously. They rank each other. A chairman synthesizes the final answer.</p>
                <div className="empty-suggestions">
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} className="suggestion-btn" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className="message-pair">
                  {msg.type === "user" ? (
                    <div className="user-message">
                      <div className="user-bubble">{msg.content}</div>
                    </div>
                  ) : (
                    <CouncilResponse msg={msg} />
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="input-area">
          <div className="input-wrap">
            <textarea
              ref={textareaRef}
              className="input-box"
              placeholder="Ask the council anything..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              disabled={sending}
            />
            <button
              className="send-btn"
              onClick={() => send()}
              disabled={!input.trim() || sending}
            >
              {sending ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 8" strokeLinecap="round">
                    <animateTransform attributeName="transform" type="rotate" from="0 7 7" to="360 7 7" dur="0.8s" repeatCount="indefinite"/>
                  </circle>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>
          <div className="input-footer">
            <span className="input-hint">↵ send</span>
            <span className="input-dot" />
            <span className="input-hint">⇧↵ newline</span>
            <span className="input-dot" />
            <span className="input-hint">free tier · 200 req/day</span>
          </div>
        </div>
      </main>
    </div>
  );
}
