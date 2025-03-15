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
        // make sure there are no duplicate function names
        const existingFunctions = this.agents[name].functions;
        const newFunctions = functions.filter(
            (func) => !existingFunctions.some((f) => f.name === func.name)
        );
        this.agents[name].functions = [...existingFunctions, ...newFunctions];
        console.log(`Added ${newFunctions.length} functions to ${name}`);
    }
}