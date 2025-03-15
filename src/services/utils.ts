export function cleanServerName(serverName: string): string {
  if (serverName) {
    return serverName.replace("@", "");
  }
  return serverName;
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
