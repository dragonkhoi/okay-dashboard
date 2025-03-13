export function cleanServerName(serverName: string): string {
  return serverName.replace("@","");
}

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
