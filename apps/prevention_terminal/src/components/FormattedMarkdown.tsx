import React from "react";

/**
 * Robust markdown formatter for AI replies.
 * Supports:
 * - Headings (###, ##, #)
 * - Numbered lists (1., 2.)
 * - Bullet lists (*, -, •)
 * - Nested list items / mixed lines
 * - Bold (**text**), italics (*text*)
 * - Safe word-wrapping and layout containment
 */
export function FormattedMarkdown({ content }: { content: string }) {
  if (!content) return null;

  // Split by double newlines into logical blocks
  const blocks = content.split(/\n\s*\n/);

  return (
    <div className="ai-reply-formatted">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Check for headers
        if (/^#{1,4}\s+/.test(trimmed)) {
          const headerMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
          if (headerMatch) {
            const level = headerMatch[1].length;
            const text = headerMatch[2];
            const HeadingTag = `h${Math.min(level + 2, 6)}` as "h3" | "h4" | "h5" | "h6";
            return (
              <HeadingTag key={idx} className="ai-reply-heading">
                {formatInlineMarkdown(text)}
              </HeadingTag>
            );
          }
        }

        const lines = trimmed.split("\n");

        // Check if block contains list items
        const hasListItems = lines.some((l) => /^\s*[\*•\-]\s+/.test(l) || /^\s*\d+[\.\)]\s+/.test(l));

        if (hasListItems) {
          const renderedItems: React.ReactNode[] = [];
          let currentList: { type: "ul" | "ol"; items: string[] } | null = null;
          let paraLines: string[] = [];

          const flushList = () => {
            if (currentList) {
              const Tag = currentList.type;
              const className = currentList.type === "ul" ? "ai-reply-list" : "ai-reply-list ai-reply-ordered";
              renderedItems.push(
                <Tag key={`list-${renderedItems.length}`} className={className}>
                  {currentList.items.map((it, iIdx) => (
                    <li key={iIdx}>{formatInlineMarkdown(it)}</li>
                  ))}
                </Tag>
              );
              currentList = null;
            }
          };

          const flushPara = () => {
            if (paraLines.length > 0) {
              renderedItems.push(
                <p key={`p-${renderedItems.length}`} className="ai-reply-p">
                  {paraLines.map((l, pIdx) => (
                    <span key={pIdx}>
                      {pIdx > 0 && <br />}
                      {formatInlineMarkdown(l)}
                    </span>
                  ))}
                </p>
              );
              paraLines = [];
            }
          };

          for (const line of lines) {
            const isBullet = /^\s*[\*•\-]\s+/.test(line);
            const isNumber = /^\s*\d+[\.\)]\s+/.test(line);

            if (isBullet || isNumber) {
              flushPara();
              const listType = isBullet ? "ul" : "ol";
              const cleanText = line.replace(/^\s*[\*•\-]\s+/, "").replace(/^\s*\d+[\.\)]\s+/, "");

              if (!currentList || currentList.type !== listType) {
                flushList();
                currentList = { type: listType, items: [cleanText] };
              } else {
                currentList.items.push(cleanText);
              }
            } else {
              // Continuation or regular text line
              if (currentList && /^\s{2,}/.test(line)) {
                // Indented line continuing the previous list item
                currentList.items[currentList.items.length - 1] += "\n" + line.trim();
              } else {
                flushList();
                paraLines.push(line);
              }
            }
          }

          flushList();
          flushPara();

          return <div key={idx} className="ai-reply-block">{renderedItems}</div>;
        }

        // Standard paragraph
        return (
          <p key={idx} className="ai-reply-p">
            {lines.map((line, lIdx) => (
              <span key={lIdx}>
                {lIdx > 0 && <br />}
                {formatInlineMarkdown(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function formatInlineMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  // Split by bold (**text**)
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);

  return boldParts.map((bPart, bIdx) => {
    if (bPart.startsWith("**") && bPart.endsWith("**") && bPart.length > 4) {
      return (
        <strong key={bIdx} className="ai-reply-strong">
          {bPart.slice(2, -2)}
        </strong>
      );
    }

    // Process italics (*text*)
    const italicParts = bPart.split(/(?<!\*)\*([^*]+)\*(?!\*)/g);
    if (italicParts.length > 1) {
      return (
        <span key={bIdx}>
          {italicParts.map((iPart, iIdx) => {
            if (iIdx % 2 === 1) {
              return <em key={iIdx}>{iPart}</em>;
            }
            return iPart;
          })}
        </span>
      );
    }

    return bPart;
  });
}
