import React from 'react';

export function cleanServerName(serverName: string): string {
  if (serverName) {
    return serverName.replace("@", "");
  }
  return serverName;
}


// Helper function to filter out specified tags from message content
export const filterMessageContent = (content: string): string => {
  if (typeof content !== 'string') return content;
  
  // Check for unclosed tags
  if (content.includes('<') && !content.includes('>')) {
    return '';
  }
  
  // Remove <thinking> tags and their content, including surrounding newlines
  let filtered = content.replace(/\n?<thinking>[\s\S]*?<\/thinking>\n?/g, '');
  
  // Remove <request_analysis> tags and their content, including surrounding newlines
  filtered = filtered.replace(/\n?<request_analysis>[\s\S]*?<\/request_analysis>\n?/g, '');
  
  // Check for any other tags that might be partially open
  const tagRegex = /<[^>]*$/;
  if (tagRegex.test(filtered)) {
    return '';
  }
  
  // Remove any other custom tags but keep their content
  filtered = filtered.replace(/<[^>]*>/g, '');
  
  // Remove any consecutive newlines (more than 2) to clean up excessive spacing
  filtered = filtered.replace(/\n{3,}/g, '\n\n');
  
  return filtered.trim();
};

// Parse content for links and make them clickable
export const parseLinksInContent = (content: string): React.ReactNode => {
  if (typeof content !== 'string') return content;
  
  // Regular expression to match URLs and file paths
  // This matches:
  // - http:// or https:// URLs
  // - file:// URLs
  // - Paths starting with / or ~/ that are likely file paths (more strict)
  // - Paths like C:\ or D:\ (Windows)
  const linkRegex = /(https?:\/\/[^\s<]+|file:\/\/[^\s<]+|(?:\/[a-zA-Z0-9_-]+)+\.[a-zA-Z0-9]+|~\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+|[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]+)/g;
  
  // Find all matches with their positions
  const matches: Array<{
    link: string;
    index: number;
    length: number;
  }> = [];
  
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    matches.push({
      link: match[0],
      index: match.index,
      length: match[0].length
    });
  }
  
  // If no links found, return the content as is
  if (matches.length === 0) {
    return content;
  }
  
  // Create an array to hold the content with clickable links
  const result: React.ReactNode[] = [];
  
  // Keep track of the last position we've processed
  let lastIndex = 0;
  
  // Process each match
  matches.forEach((match, i) => {
    // Check if this match overlaps with the previous one
    if (i > 0 && match.index < matches[i-1].index + matches[i-1].length) {
      // Skip this match as it overlaps
      return;
    }
    
    // Add text before the link
    if (match.index > lastIndex) {
      result.push(content.substring(lastIndex, match.index));
    }
    
    // Add the link
    result.push(
      React.createElement(
        'a',
        {
          key: i,
          href: '#',
          onClick: (e: React.MouseEvent) => {
            e.preventDefault();
            window.electronAPI.openExternalLink(match.link);
          },
          className: 'text-blue-400 hover:underline',
          style: { wordBreak: 'break-all' }
        },
        match.link
      )
    );
    
    // Update the last index
    lastIndex = match.index + match.length;
  });
  
  // Add any remaining text after the last link
  if (lastIndex < content.length) {
    result.push(content.substring(lastIndex));
  }
  
  return result;
};

export function extractTextContent(content: any): string {
  if (typeof content === "string") {
    return content;
  }
  if (content[0] && content[0].type === "text") {
    return content[0].text;
  }
  if (content[0] && content[0].type === "tool_use") {
    return JSON.stringify(content[0]);
  }
  if (content[0] && content[0].type === "tool_result") {
    return extractTextContent(content[0].content);
  }
  return JSON.stringify(content);
}

// Takes a SNAKE_CASE string and returns a readable string with first letters capitalized
// also if there is something with _api_ or _API_ it should say API, same with _id_ or _ID_ it should say ID
export function snakeCaseToCapitalizedReadable(str: string): string {
  return str
    .split("_")
    .map((word) => {
      if (word === "api" || word === "API") {
        return "API";
      }
      if (word === "id" || word === "ID") {
        return "ID";
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
