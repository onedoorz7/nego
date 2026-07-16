/**
 * Tiny markdown renderer for trusted-ish content (our own content files and
 * server-validated strings). Input is HTML-escaped FIRST, then a small set of
 * markdown features is applied — no raw HTML ever passes through.
 */

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function inline(md: string): string {
  return md
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="rounded bg-stone-100 px-1 text-[0.9em]">$1</code>');
}

export function mdToHtml(md: string): string {
  const lines = escapeHtml(md).split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)/);
    const ul = line.match(/^[-*]\s+(.*)/);
    const ol = line.match(/^\d+\.\s+(.*)/);
    if (line.trim() === "") {
      flushPara();
      closeList();
    } else if (h) {
      flushPara();
      closeList();
      const level = Math.min(4, h[1].length + 2);
      out.push(`<h${level} class="font-semibold mt-3">${inline(h[2])}</h${level}>`);
    } else if (ul || ol) {
      flushPara();
      const kind = ul ? "ul" : "ol";
      if (list !== kind) {
        closeList();
        list = kind;
        out.push(kind === "ul" ? '<ul class="list-disc pl-5 space-y-1">' : '<ol class="list-decimal pl-5 space-y-1">');
      }
      out.push(`<li>${inline((ul ?? ol)![1])}</li>`);
    } else {
      closeList();
      para.push(line);
    }
  }
  flushPara();
  closeList();
  return out.join("\n");
}

export default function Md({ text, className }: { text: string; className?: string }) {
  return (
    <div
      className={`space-y-2 leading-relaxed ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: mdToHtml(text) }}
    />
  );
}
