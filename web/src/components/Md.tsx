import ReactMarkdown from 'react-markdown'

/** Renders stored markdown as styled content. Source of truth stays markdown. */
export default function Md({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`md-body ${className}`}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  )
}
