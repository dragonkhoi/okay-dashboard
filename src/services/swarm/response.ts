import { Agent } from "./agent"

export class Response {
    messages: any[] = []
    agent?: Agent
    context_variables: Record<string, any> = {}
}
    