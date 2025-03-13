import { Agent, AgentFunction } from "./agent";

export class AgentDirectory {
    private agents: Record<string, Agent> = {};

    constructor() {
        this.agents = {};
    }

    public getAgentByName(name: string): Agent {
        return this.agents[name];
    }

    public registerAgent(name: string, agent: Agent) {
        this.agents[name] = agent;
    }

    public addNewAgentFunctions(name: string, functions: AgentFunction[]) {
        this.agents[name].functions = [...this.agents[name].functions, ...functions];
        console.log(`Added ${functions.length} functions to ${name}`);
    }
}