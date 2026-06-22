/**
 * Markdown 渲染组件
 * 将 AI 回复的 Markdown 文本渲染为 HTML
 */
import { useEffect, useRef } from 'react';

interface MarkdownRendererProps {
  content: string;
}

function renderMarkdown(text: string): string {
  let html = text;

  // 转义 HTML 特殊字符（防止 XSS）
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 代码块（````）
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="md-code-block"><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

  // 标题
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 粗体和斜体
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 删除线
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // 引用
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // 分割线
  html = html.replace(/^---$/gm, '<hr />');

  // 有序列表
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');

  // 无序列表
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, (match) => {
    if (match.includes('<ol>')) return match;
    return `<ul>${match}</ul>`;
  });

  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // 图片
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // 段落（双换行）
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;

  // 清理空段落
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[1-5]>)/g, '$1');
  html = html.replace(/(<\/h[1-5]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ol>)/g, '$1');
  html = html.replace(/(<\/ol>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<hr \/>)/g, '$1');
  html = html.replace(/(<hr \/>)<\/p>/g, '$1');
  html = html.replace(/<p>(<blockquote>)/g, '$1');
  html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');

  // 单换行转 <br>
  html = html.replace(/\n/g, '<br />');

  return html;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = renderMarkdown(content);
    }
  }, [content]);

  return (
    <div
      ref={containerRef}
      className="markdown-content"
      style={{
        lineHeight: 1.8,
        fontSize: '14px',
        color: 'var(--text-secondary, #333)',
        wordBreak: 'break-word',
      }}
    />
  );
}
