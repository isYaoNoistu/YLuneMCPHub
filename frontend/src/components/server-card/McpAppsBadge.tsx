interface McpAppsBadgeProps {
  title: string;
}

const McpAppsBadge = ({ title }: McpAppsBadgeProps) => (
  <span className="hub-tag accent flex-shrink-0" title={title}>
    App
  </span>
);

export default McpAppsBadge;
